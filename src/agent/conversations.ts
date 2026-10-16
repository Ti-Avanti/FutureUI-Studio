import type { AgentEvent, AgentMessage, Conversation } from './types';
export function newConversation(projectId:string|null):Conversation{return{id:crypto.randomUUID(),title:'新会话',archived:false,createdAt:Date.now(),messages:[],draft:'',attachments:[],running:false,runId:null,projectId,proposals:[],tokens:0,step:0,limit:0,status:'',error:'',summary:'',historyStart:0,context:null,compacting:false};}
const keys=Object.keys(newConversation(null)) as (keyof Conversation)[];
export function snapshot(state:Conversation):Conversation{return Object.fromEntries(keys.map(key=>[key,state[key]])) as unknown as Conversation;}
export function restore(session:Conversation,projectId:string):Conversation{
  return{...newConversation(projectId),...session,projectId,running:false,compacting:false,status:session.running?'上次任务已中断':session.status,messages:session.messages.map(m=>m.status==='running'?{...m,status:'cancelled'}:m)};
}
export function reduceEvent(session:Conversation,event:AgentEvent):Partial<Conversation>{
  const message=session.messages.find(m=>m.id===event.runId);
  const patch=(value:Partial<AgentMessage>)=>({messages:session.messages.map(m=>m.id===event.runId?{...m,...value}:m)});
  switch(event.type){
    case'text':return patch({text:(message?.text??'')+(event.delta??'')});
    case'thinking':return patch({thinking:(message?.thinking??'')+(event.delta??''),thinkingKind:event.kind});
    case'tool':{const tools=message?.tools??[],tool={callId:event.callId!,name:event.name!,target:event.target??'',status:event.status!,message:event.message};return patch({tools:tools.some(t=>t.callId===tool.callId)?tools.map(t=>t.callId===tool.callId?tool:t):[...tools,tool]});}
    case'step':return{step:event.step,limit:event.limit};
    case'usage':return{tokens:event.tokens};
    case'context':return{context:event.context};
    case'compaction':return event.status==='running'?{compacting:true,status:event.message}:{compacting:false,summary:event.summary??'',historyStart:Math.max(0,session.messages.length-2),status:event.message,context:session.context?{...session.context,compressions:event.compressions??session.context.compressions}:null};
    case'status':return{status:event.message};
    case'done':return{running:false,compacting:false,proposals:event.proposals??[],status:'方案已生成',tokens:event.tokens??0,...patch({status:'done'})};
    case'cancelled':return{running:false,compacting:false,status:'已停止',...patch({status:'cancelled'})};
    case'error':return{running:false,compacting:false,error:event.message??'Agent 请求失败',status:'请求失败',...patch({status:'error'})};
    default:return{};
  }
}
