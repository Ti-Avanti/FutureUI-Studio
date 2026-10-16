import { tr } from '../i18n';
import { create } from 'zustand';
import { useStudio } from '../state/store';
import { compile } from '../preview/compile';
import { validateProject } from '../model/validate';
import { newConversation, snapshot, restore, reduceEvent } from './conversations';
import type { AgentEvent, AgentMessage, AISettings, Attachment, Proposal, Skill, Conversation } from './types';

interface AgentState extends Conversation {
  settings:AISettings|null;skills:Skill[];sessions:Conversation[];activeId:string;loadedProjectId:string|null;loadedRoot:string;
  view:'chat'|'settings'|'skills';floating:boolean;vision:boolean;initialized:boolean;historyOpen:boolean;
  set:(value:Partial<AgentState>)=>void;initialize:()=>Promise<void>;receive:(event:AgentEvent)=>void;
  openProject:(id:string)=>Promise<void>;newSession:()=>void;switchSession:(id:string)=>void;archiveSession:(id:string)=>void;deleteSession:(id:string)=>void;
  send:()=>Promise<void>;stop:()=>void;compose:(prompt?:string,attachment?:Attachment)=>void;
  preview:()=>void;apply:()=>void;discard:()=>void;clear:()=>void;
  flush:()=>Promise<void>;
}
let unsubscribe:(()=>void)|undefined;
export function showAgent(){window.dispatchEvent(new CustomEvent('studio:agent'));}
let persistenceTimer:ReturnType<typeof setTimeout>|undefined,projectGeneration=0;
export const useAgent=create<AgentState>((rawSet,get)=>{
  const first=newConversation(null);
  const persist=(immediate=false)=>{
    clearTimeout(persistenceTimer);
    const save=()=>{const s=get();if(s.loadedProjectId)window.studio.ai.saveConversations(s.loadedProjectId,{activeId:s.activeId,sessions:s.sessions}).catch(e=>rawSet({error:tr("会话保存失败：{0}", e.message)}));};
    if(immediate)save();else persistenceTimer=setTimeout(save,650);
  };
  const set=(value:Partial<AgentState>|((state:AgentState)=>Partial<AgentState>))=>{
    rawSet(previous=>{const patch=typeof value==='function'?value(previous):value,next={...previous,...patch};return{...patch,sessions:next.sessions.map(session=>session.id===next.activeId?snapshot(next):session)};});persist();
  };
  const patchSession=(id:string,patch:Partial<Conversation>)=>{
    rawSet(s=>({...(s.activeId===id?patch:{}),sessions:s.sessions.map(c=>c.id===id?{...c,...patch}:c)}));persist();
  };
  return{
  ...first,settings:null,skills:[],sessions:[first],activeId:first.id,loadedProjectId:null,loadedRoot:'',view:'chat',floating:false,vision:true,initialized:false,historyOpen:false,
  set,
  flush:async()=>{
    clearTimeout(persistenceTimer);
    const current=get();
    if(current.loadedProjectId)await window.studio.ai.saveConversations(current.loadedProjectId,{activeId:current.activeId,sessions:current.sessions});
  },
  openProject:async id=>{
    const project=useStudio.getState().project;if(!project||project.id!==id||get().loadedProjectId===id)return;
    const generation=++projectGeneration;
    if(get().loadedRoot===project.root){rawSet(s=>({loadedProjectId:id,projectId:id,sessions:s.sessions.map(c=>({...c,projectId:id}))}));return;}
    const previous=get();clearTimeout(persistenceTimer);
    if(previous.loadedProjectId)await window.studio.ai.saveConversations(previous.loadedProjectId,{activeId:previous.activeId,sessions:previous.sessions}).catch(()=>{});
    for(const session of previous.sessions)if(session.running&&session.runId)window.studio.ai.cancel(session.runId).catch(()=>{});
    try{const saved=await window.studio.ai.conversations(id);if(generation!==projectGeneration)return;
      const sessions=saved?.sessions?.length?saved.sessions.map(c=>restore(c,id)):[newConversation(id)];
      const active=sessions.find(c=>c.id===saved?.activeId&&!c.archived)??sessions.find(c=>!c.archived)??newConversation(id);if(!sessions.some(c=>c.id===active.id))sessions.push(active);
      rawSet({...active,sessions,activeId:active.id,loadedProjectId:id,loadedRoot:project.root});
    }catch(e){rawSet({error:(e as Error).message});}
  },
  newSession:()=>{const s=get();if(s.sessions.length>=100){set({error:tr("每个工程最多 100 个会话，请在历史列表中删除不再需要的记录")});return;}const session=newConversation(useStudio.getState().project?.id??null);useStudio.getState().set({previewOverrides:null});rawSet({...session,sessions:[...s.sessions,session],activeId:session.id,view:'chat',historyOpen:false});persist(true);},
  switchSession:id=>{const session=get().sessions.find(s=>s.id===id);if(!session)return;useStudio.getState().set({previewOverrides:null});rawSet({...session,archived:false,activeId:id,view:'chat',historyOpen:false,sessions:get().sessions.map(s=>s.id===id?{...s,archived:false}:s)});persist(true);},
  archiveSession:id=>{const session=get().sessions.find(s=>s.id===id);if(!session)return;if(session.running){set({error:tr("请先停止这个会话的任务，再归档")});return;}rawSet(s=>({sessions:s.sessions.map(c=>c.id===id?{...c,archived:true}:c)}));if(get().activeId===id){const next=get().sessions.find(c=>!c.archived);if(next)get().switchSession(next.id);else get().newSession();}persist(true);},
  deleteSession:id=>{const session=get().sessions.find(s=>s.id===id);if(!session||session.running)return;rawSet(s=>({sessions:s.sessions.filter(c=>c.id!==id)}));if(get().activeId===id){const next=get().sessions.find(c=>!c.archived);if(next)get().switchSession(next.id);else get().newSession();}persist(true);},
  initialize:async()=>{
    if(get().initialized)return;set({initialized:true});
    unsubscribe?.();unsubscribe=window.studio.ai.onEvent(event=>get().receive(event));
    try{const [settings,skills]=await Promise.all([window.studio.ai.settings(),window.studio.ai.skills()]);set({settings,skills});}catch(e){set({error:(e as Error).message,initialized:false});}
  },
  receive:event=>{
    const session=get().sessions.find(s=>s.runId===event.runId);if(!session)return;
    patchSession(session.id,reduceEvent(session,event));
    if(['done','error','cancelled','compaction'].includes(event.type))persist(true);
  },
  compose:(prompt,attachment)=>{
    if(attachment&&get().attachments.length>=8){set({error:tr("最多添加 8 个附件")});showAgent();return;}
    set(s=>({view:'chat',...(prompt?{draft:prompt}:{}),...(attachment?{attachments:[...s.attachments.filter(a=>a.id!==attachment.id),attachment]}:{})}));showAgent();
  },
  send:async()=>{
    let a=get();const s=useStudio.getState();if(a.running||!a.draft.trim()||!s.project)return;
    if(a.loadedProjectId!==s.project.id){await a.openProject(s.project.id);a=get();if(!a.draft.trim())return;}
    if(!a.settings?.model){set({view:'settings',error:tr("请先填写 Base URL 和模型 ID")});return;}
    if(a.proposals.length){set({error:tr("请先应用或放弃当前方案，再开始下一次修改")});return;}
    if(a.skills.filter(k=>k.enabled).length>8){set({error:tr("一次任务最多启用 8 个 Skill，请先调整选择")});return;}
    const runId=crypto.randomUUID();let preview;
    try{preview=compile(s.project,s.active,s.locale,s.variables,s.time);}catch(e){set({error:tr("当前预览无法解析：{0}", (e as Error).message)});return;}
    const user:AgentMessage={id:crypto.randomUUID(),role:'user',text:a.draft.trim(),attachments:a.attachments};
    set({title:a.messages.length?a.title:user.text.slice(0,18),messages:[...a.messages,user,{id:runId,role:'assistant',text:'',thinking:'',tools:[],status:'running'}],draft:'',attachments:[],running:true,runId,projectId:s.project.id,error:'',status:tr("正在连接模型"),step:0,tokens:0});
    try{await window.studio.ai.start({runId,conversationId:a.id,summary:a.summary,compressions:a.context?.compressions??0,projectId:s.project.id,prompt:user.text,files:s.project.files,active:s.active,selected:s.selected,locale:s.locale,issues:[...preview.issues,...validateProject(s.project)],skills:a.skills.filter(k=>k.enabled).map(k=>k.id),vision:a.vision,attachments:user.attachments??[],assets:Object.entries(preview.images).map(([id,url])=>({id,url,path:s.project!.images.find(i=>i.url===url)?.path??id})),history:a.messages.slice(a.historyStart).filter(m=>m.text).map(m=>({role:m.role,content:m.text}))});}
    catch(e){patchSession(a.id,{running:false,error:(e as Error).message});}
  },
  stop:()=>{const id=get().runId;if(id)window.studio.ai.cancel(id).catch(e=>set({error:e.message}));},
  preview:()=>{const a=get(),s=useStudio.getState();if(s.project?.id!==a.projectId){set({error:tr("工程已切换，请重新生成方案")});return;}s.set({previewOverrides:s.previewOverrides?null:Object.fromEntries(a.proposals.map(p=>[p.path,p.after])),workspace:'design',view:'canvas'});},
  apply:()=>{const a=get(),s=useStudio.getState();try{
    if(!s.project||s.project.id!==a.projectId)throw Error(tr("工程已切换，请重新生成方案"));
    const files=new Map(s.project.files.map(f=>[f.path,f]));for(const p of a.proposals)files.set(p.path,{path:p.path,text:p.after,hash:files.get(p.path)?.hash??null});
    const baseline=new Set(validateProject(s.project).map(i=>`${i.file}:${i.message}`));
    const errors=validateProject({...s.project,files:[...files.values()]}).filter(i=>i.level==='error'&&!baseline.has(`${i.file}:${i.message}`));
    if(errors.length)throw Error(tr("方案还有配置错误：{0}", errors[0].message));
    s.applyProposals(a.proposals,a.projectId!);set({proposals:[],error:'',status:tr("已应用到工程")});
  }catch(e){set({error:(e as Error).message});}},
  discard:()=>{useStudio.getState().set({previewOverrides:null});set({proposals:[],error:'',status:tr("已放弃方案")});},
  clear:()=>{if(get().running)return;useStudio.getState().set({previewOverrides:null});set({messages:[],proposals:[],attachments:[],draft:'',error:'',status:'',tokens:0,summary:'',historyStart:0,context:null});}
};});
