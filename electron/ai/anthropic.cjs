const { tr } = require('../i18n.cjs');
function imageBlock(url){
  const match=/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(url);
  if(!match)throw Error(tr("Anthropic 图片格式不支持"));
  return{type:'image',source:{type:'base64',media_type:match[1],data:match[2]}};
}
function content(text,images){return[{type:'text',text},...images.map(imageBlock)];}
async function complete(settings,session,tools,emit,signal,transport){
  const body={model:settings.model,system:session.messages[0].content,messages:session.messages.slice(1),stream:true,max_tokens:settings.maxTokens,...(tools.length?{tools:tools.map(t=>({name:t.name,description:t.description,input_schema:t.parameters}))}:{})};
  if(settings.anthropicThinking==='adaptive')body.thinking={type:'adaptive'};
  if(settings.anthropicThinking==='enabled'){
    if(settings.maxTokens<=settings.thinkingBudget)throw Error(tr("最大输出空间必须大于 Anthropic 思考预算，请提高输出或上下文上限"));
    body.thinking={type:'enabled',budget_tokens:settings.thinkingBudget};
  }
  const response=await transport.request(settings,body,'messages',signal),blocks=new Map(),partial=new Map();
  let text='',thinking='',usage={},finished=false,stopReason='';
  for await(const raw of transport.events(response)){
    if(signal?.aborted)throw Error(tr("任务已停止"));
    if(raw==='[DONE]')continue;
    const event=JSON.parse(raw);
    if(event.type==='error')throw Error(transport.redactError(event.error?.message??tr("Anthropic 流式响应错误"),settings.apiKey));
    if(event.type==='message_start')usage={...event.message?.usage};
    if(event.type==='content_block_start'){
      const block={...event.content_block};blocks.set(event.index,block);
      if(block.type==='text'&&block.text){text+=block.text;emit({type:'text',delta:block.text});}
      if(block.type==='thinking'&&block.thinking){thinking+=block.thinking;emit({type:'thinking',delta:block.thinking,kind:'provided'});}
    }
    if(event.type==='content_block_delta'){
      const block=blocks.get(event.index),delta=event.delta??{};if(!block)continue;
      if(delta.type==='text_delta'){block.text=(block.text??'')+(delta.text??'');text+=delta.text??'';emit({type:'text',delta:delta.text??''});}
      if(delta.type==='thinking_delta'){block.thinking=(block.thinking??'')+(delta.thinking??'');thinking+=delta.thinking??'';emit({type:'thinking',delta:delta.thinking??'',kind:'provided'});}
      if(delta.type==='signature_delta')block.signature=(block.signature??'')+(delta.signature??'');
      if(delta.type==='input_json_delta')partial.set(event.index,(partial.get(event.index)??'')+(delta.partial_json??''));
    }
    if(event.type==='message_delta'){usage={...usage,...event.usage};stopReason=event.delta?.stop_reason??stopReason;}
    if(event.type==='message_stop')finished=true;
  }
  if(!finished)throw Error(tr("Anthropic 流式连接提前结束，未应用修改"));
  if(stopReason==='max_tokens')throw Error(tr("Anthropic 输出达到 Token 上限，请增加最大输出或减少思考预算"));
  const output=[...blocks.entries()].sort(([a],[b])=>a-b).map(([index,block])=>{if(block.type==='tool_use'&&partial.has(index))block.input=JSON.parse(partial.get(index));return block;});
  session.messages.push({role:'assistant',content:output});
  const input=Number(usage.input_tokens??0)+Number(usage.cache_creation_input_tokens??0)+Number(usage.cache_read_input_tokens??0),out=Number(usage.output_tokens??0);
  return{text,thinking,usage:{input_tokens:input,output_tokens:out,total_tokens:input+out},calls:output.filter(b=>b.type==='tool_use').map(b=>({id:b.id,name:b.name,arguments:JSON.stringify(b.input??{})}))};
}
function results(session,outputs){
  session.messages.push({role:'user',content:outputs.map(({call,result})=>({type:'tool_result',tool_use_id:call.id,is_error:!!result.value?.error,content:content(JSON.stringify(result.value),result.images??[])}))});
}
module.exports={complete,content,results};
