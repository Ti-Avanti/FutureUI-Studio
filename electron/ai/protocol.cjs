const { tr } = require('../i18n.cjs');
const anthropic=require('./anthropic.cjs');
function endpoint(settings, suffix) { return `${settings.baseURL}/${suffix}`; }
function redactError(value, key) { let text = String(value); if(key)text=text.split(key).join('[API Key]'); return text.slice(0,1200); }
async function request(settings, body, suffix, signal) {
  const timeout=AbortSignal.timeout(120000), combined=signal?AbortSignal.any([signal,timeout]):timeout;
  let response;
  try { response=await fetch(endpoint(settings,suffix),{method:body?'POST':'GET',redirect:'error',signal:combined,headers:{'Content-Type':'application/json',...(settings.protocol==='anthropic'?{'anthropic-version':'2023-06-01',...(settings.apiKey?{'x-api-key':settings.apiKey}:{})}:settings.apiKey?{Authorization:`Bearer ${settings.apiKey}`}:{})},...(body?{body:JSON.stringify(body)}:{})}); }
  catch(e){if(signal?.aborted)throw Error(tr("任务已停止"));throw Error(redactError(tr("连接失败：{0}", e.message),settings.apiKey));}
  if(!response.ok){const detail=(await response.text()).slice(0,2000);throw Error(redactError(`API ${response.status}：${detail}`,settings.apiKey));}
  return response;
}
async function* events(response) {
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',bytes=0;
  try {
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>20*1024*1024)throw Error(tr("流式响应超过大小限制"));buffer+=decoder.decode(value,{stream:true});
      let match;while((match=/\r?\n\r?\n/.exec(buffer))){const frame=buffer.slice(0,match.index);buffer=buffer.slice(match.index+match[0].length);const data=frame.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data)yield data;}
    }
    buffer+=decoder.decode();const data=buffer.split(/\r?\n/).filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data)yield data;
  } finally { await reader.cancel().catch(()=>{});reader.releaseLock(); }
}
function imageContent(text,images,protocol){if(protocol==='anthropic')return anthropic.content(text,images);return [{type:protocol==='responses'?'input_text':'text',text},...images.map(image=>protocol==='responses'?{type:'input_image',image_url:image,detail:'auto'}:{type:'image_url',image_url:{url:image,detail:'auto'}})];}
function makeSession(settings,system,user,history,images){
  if(settings.protocol==='responses')return{instructions:system,input:[...history,{role:'user',content:images.length?imageContent(user,images,'responses'):user}]};
  return{messages:[{role:'system',content:system},...history,{role:'user',content:images.length?imageContent(user,images,settings.protocol):user}]};
}
async function complete(settings,session,tools,emit,signal){
  if(!settings.model)throw Error(tr("请先设置模型 ID"));
  if(settings.protocol==='anthropic')return anthropic.complete(settings,session,tools,emit,signal,{request,events,redactError});
  const responses=settings.protocol==='responses';
  const body=responses?{model:settings.model,instructions:session.instructions,input:session.input,stream:true,store:false,max_output_tokens:settings.maxTokens,include:['reasoning.encrypted_content'],tools:tools.map(t=>({type:'function',...t,strict:false})),...(settings.reasoningSummary?{reasoning:{summary:'auto'}}:{})}:{model:settings.model,messages:session.messages,stream:true,stream_options:{include_usage:true},[settings.tokenField]:settings.maxTokens,...(tools.length?{tools:tools.map(t=>({type:'function',function:t})),tool_choice:'auto'}:{})};
  let response;try{response=await request(settings,body,responses?'responses':'chat/completions',signal);}catch(e){if(!responses&&/stream_options|include_usage/i.test(e.message)){delete body.stream_options;response=await request(settings,body,'chat/completions',signal);}else throw e;}
  let text='',thinking='',usage=null,final=null,finished=false,reasoningContent='';const calls=new Map();
  for await(const raw of events(response)){
    if(signal?.aborted)throw Error(tr("任务已停止"));
    if(raw==='[DONE]'){finished=true;continue;}
    let data;try{data=JSON.parse(raw);}catch{throw Error(tr("API 返回了无效的流式事件"));}
    if(data.error)throw Error(redactError(data.error.message??JSON.stringify(data.error),settings.apiKey));
    if(responses){
      if(data.type==='response.output_text.delta'){text+=data.delta??'';emit({type:'text',delta:data.delta??''});}
      if(data.type==='response.reasoning_summary_text.delta'||data.type==='response.reasoning_text.delta'){thinking+=data.delta??'';emit({type:'thinking',delta:data.delta??'',kind:data.type.includes('summary')?'summary':'provided'});}
      if(data.type==='response.completed'){final=data.response;usage=final.usage;finished=true;}
      if(['response.failed','response.incomplete','error'].includes(data.type))throw Error(redactError(data.response?.error?.message??data.message??tr("模型未完成输出；请调整输出上限或模型设置"),settings.apiKey));
    }else{
      const choice=data.choices?.[0],delta=choice?.delta??{};if(data.usage)usage=data.usage;
      if(delta.content){text+=delta.content;emit({type:'text',delta:delta.content});}
      const thought=delta.reasoning_content??delta.reasoning??'';
      if(typeof thought==='string'&&thought){reasoningContent+=thought;thinking+=thought;emit({type:'thinking',delta:thought,kind:'provided'});}
      for(const call of delta.tool_calls??[]){const existing=calls.get(call.index)??{id:'',name:'',arguments:''};if(call.id)existing.id=call.id;if(call.function?.name)existing.name+=call.function.name;existing.arguments+=call.function?.arguments??'';calls.set(call.index,existing);}
      if(choice?.finish_reason==='length')throw Error(tr("模型输出达到上限，请提高最大输出 Token 或缩小修改范围"));
      if(choice?.finish_reason==='content_filter')throw Error(tr("模型服务未完成此请求"));
      if(choice?.finish_reason)finished=true;
    }
  }
  if(!finished)throw Error(tr("流式连接提前结束，请重试；未应用任何修改"));
  if(responses){if(!final)throw Error(tr("Responses 未返回完整结果"));session.input.push(...(final.output??[]));return{text,thinking,usage,calls:(final.output??[]).filter(i=>i.type==='function_call').map(i=>({id:i.call_id,name:i.name,arguments:i.arguments}))};}
  const toolCalls=[...calls.values()];
  session.messages.push({role:'assistant',content:text||null,...(reasoningContent?{reasoning_content:reasoningContent}:{}),...(toolCalls.length?{tool_calls:toolCalls.map(c=>({id:c.id,type:'function',function:{name:c.name,arguments:c.arguments}}))}:{})});
  return{text,thinking,usage,calls:toolCalls};
}
function results(settings,session,outputs){
  if(settings.protocol==='anthropic')return anthropic.results(session,outputs);
  const images=[];
  for(const {call,result} of outputs){const content=JSON.stringify(result.value);images.push(...(result.images??[]));if(settings.protocol==='responses')session.input.push({type:'function_call_output',call_id:call.id,output:content});else session.messages.push({role:'tool',tool_call_id:call.id,content});}
  if(images.length){const message={role:'user',content:imageContent(tr("工具返回的资源图片，按上述资源 ID 顺序。"),images,settings.protocol)};if(settings.protocol==='responses')session.input.push(message);else session.messages.push(message);}
}
async function models(settings){const response=await request(settings,null,'models');const data=await response.json();return(data.data??[]).map(m=>String(m.id)).sort().slice(0,1000);}
module.exports={complete,makeSession,results,models,redactError};
