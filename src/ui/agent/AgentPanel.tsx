import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Settings2, BookOpen, Maximize2, Minimize2, Plus, ArrowUp, Square, X, MousePointer2, ImagePlus, FileCode2, ScanLine, RotateCcw, Images, AlertCircle } from 'lucide-react';
import { useAgent } from '../../agent/store';
import { useStudio } from '../../state/store';
import { at, readYaml, shortName } from '../../model/documents';
import { usePreview } from '../context';
import { IconButton } from '../controls';
import { Messages } from './Messages';
import { ModelSettings } from './ModelSettings';
import { SkillManager } from './SkillManager';
import { ChangeReview } from './ChangeReview';
import { FloatingAgent } from './FloatingAgent';
import { SessionTabs } from './SessionTabs';
import { ContextMeter } from './ContextMeter';
import type { Attachment } from '../../agent/types';

const shortcuts=[
  {name:'/创建',detail:'依据当前主题创建页面',prompt:'参考当前工程主题和 Skill，新建一个菜单。先与我确认用途和实际业务内容。'},
  {name:'/优化',detail:'优化选中组件或当前页面',prompt:'优化当前选中组件；没有选中组件时优化当前页面。改善布局、对齐和可读性，保持现有功能与风格。'},
  {name:'/修复',detail:'检查并修复配置问题',prompt:'读取当前页面与问题列表，修复能够确定的配置错误，保留其他功能。'},
  {name:'/解释',detail:'解释当前组件与交互',prompt:'解释当前选中组件的结构、变量和交互；没有选中组件时解释当前页面。此次不修改文件。'},
  {name:'/翻译',detail:'同步当前页面的语言文件',prompt:'检查当前页面和模板用到的语言键，补齐 zh_cn 与 en_us，保持占位符一致。'}
];
export function attachCurrentSelection(){
  const s=useStudio.getState(),origin=s.selected;if(!origin)return;
  const node=at(readYaml(s.project?.files.find(f=>f.path===origin.file)).value,origin.path);
  useAgent.getState().compose(undefined,{id:`selection:${origin.file}:${JSON.stringify(origin.path)}`,kind:'selection',name:node?.id??'选中组件',path:origin.file});
}
function AgentContent(){
  const a=useAgent(),s=useStudio(),preview=usePreview(),input=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{a.initialize();},[]);
  useEffect(()=>{if(s.project)a.openProject(s.project.id);},[s.project?.id]);
  const chosen=s.selected?at(readYaml(s.project?.files.find(f=>f.path===s.selected!.file)).value,s.selected.path):null;
  const slash=a.draft.startsWith('/')?shortcuts.filter(c=>c.name.startsWith(a.draft.trim())||a.draft==='/'):[];
  function capture(){const canvas=document.querySelector('.artboard-wrap canvas') as HTMLCanvasElement|null;if(!canvas){a.set({error:'请先打开画布，再附加预览'});return;}a.compose(undefined,{id:`preview:${Date.now()}`,kind:'preview',name:`${shortName(s.active)} · 当前预览`,path:s.active,url:canvas.toDataURL('image/png')});}
  function drop(event:React.DragEvent){event.preventDefault();try{const raw=event.dataTransfer.getData('application/futureui-asset')||event.dataTransfer.getData('application/futureui-file');if(raw)a.compose(undefined,JSON.parse(raw) as Attachment);}catch{a.set({error:'无法读取拖入资源'});}}
  return <div className={`agent-panel ${a.floating?'floating-agent':''}`}><div className="agent-toolbar"><Sparkles size={15}/><strong>Agent</strong><span className="agent-model-label" title={a.settings?.model}>{a.settings?.model||'未连接模型'}</span><IconButton icon={RotateCcw} title="清空当前会话" disabled={a.running} onClick={()=>{if(a.proposals.length&&!window.confirm('当前还有未应用方案，清空对话并放弃方案？'))return;a.clear();}}/><IconButton icon={BookOpen} title="管理 Skill" active={a.view==='skills'} onClick={()=>a.set({view:a.view==='skills'?'chat':'skills'})}/><IconButton icon={Settings2} title="Agent 模型设置" active={a.view==='settings'} onClick={()=>a.set({view:a.view==='settings'?'chat':'settings'})}/><IconButton icon={a.floating?Minimize2:Maximize2} title={a.floating?'回到侧边栏':'展开 Agent 浮窗'} onClick={()=>a.set({floating:!a.floating})}/></div>{a.view==='settings'?<ModelSettings/>:a.view==='skills'?<SkillManager/>:<><SessionTabs/><div className="agent-context"><span title={s.active}><FileCode2 size={11}/>{shortName(s.active)||'未打开菜单'}</span>{chosen&&<button title="将选中组件加入本次需求" onClick={attachCurrentSelection}><MousePointer2 size={11}/>{chosen.id??'选中组件'}</button>}<button onClick={()=>a.set({view:'skills'})}><BookOpen size={11}/>{a.skills.filter(k=>k.enabled).length} Skills</button></div><Messages/><ChangeReview/><div className="agent-composer" onDragOver={e=>{if(e.dataTransfer.types.some(t=>t.startsWith('application/futureui-')))e.preventDefault();}} onDrop={drop}>{a.attachments.length>0&&<div className="attachment-chips">{a.attachments.map(item=><div key={item.id} title={item.path??item.name}>{item.url?<img src={item.url} alt=""/>:<FileCode2 size={13}/>}<span>{item.name}</span><button aria-label={`移除附件 ${item.name}`} onClick={()=>a.set({attachments:a.attachments.filter(v=>v.id!==item.id)})}><X size={11}/></button></div>)}</div>}{slash.length>0&&<div className="slash-commands">{slash.map(c=><button key={c.name} onClick={()=>{a.set({draft:c.prompt});input.current?.focus();}}><strong>{c.name}</strong><span>{c.detail}</span></button>)}</div>}<textarea ref={input} aria-label="给 Agent 的需求" disabled={a.loadedProjectId!==s.project?.id} placeholder="描述需求，或拖入资源…（/ 快捷操作）" value={a.draft} rows={3} onChange={e=>a.set({draft:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();a.send();}}}/><div className="composer-toolbar"><IconButton icon={MousePointer2} title="附加选中组件" disabled={!s.selected} onClick={attachCurrentSelection}/><IconButton icon={FileCode2} title="附加当前配置" disabled={!s.active} onClick={()=>a.compose(undefined,{id:`file:${s.active}`,kind:'file',name:shortName(s.active)+'.yml',path:s.active})}/><IconButton icon={ScanLine} title="附加当前预览图片" onClick={capture}/><IconButton icon={Images} title="从资源库选择图片" onClick={()=>s.set({bottom:'assets'})}/><span className="spacer"/><button className={`vision-button ${a.vision?'active':''}`} title="将所选图片发送给支持视觉的模型；关闭后只发送资源引用" onClick={()=>a.set({vision:!a.vision})}><ImagePlus size={12}/>{a.vision?'图片已启用':'仅引用'}</button>{a.running?<button className="agent-send stop" aria-label="停止 Agent" onClick={a.stop}><Square size={12}/></button>:<button className="agent-send" aria-label="发送给 Agent" disabled={!a.draft.trim()||!s.project} onClick={a.send}><ArrowUp size={17}/></button>}</div></div><div className="agent-context-footer"><ContextMeter/><span>{a.sessions.filter(c=>c.running).length?`${a.sessions.filter(c=>c.running).length} 个会话运行中`:a.summary?'已使用压缩记忆':'会话自动保存在本机'}</span></div><div className="agent-status"><span>{a.running?`处理中 · ${a.step}/${a.limit||a.settings?.maxSteps||16}`:a.status||'按需读取工程 · 修改先预览'}</span><span>{a.tokens?`${a.tokens.toLocaleString()} tokens`:'Enter 发送'}</span></div></>}{a.error&&<div className="agent-error"><AlertCircle size={14}/><span>{a.error}</span><button aria-label="关闭 Agent 错误" onClick={()=>a.set({error:''})}><X size={13}/></button></div>}</div>;
}
export function AgentPanel(){const floating=useAgent(s=>s.floating);return floating?<><div className="agent-detached"><Sparkles size={22}/><p>Agent 已在浮窗中打开</p><button className="secondary-button" onClick={()=>useAgent.getState().set({floating:false})}>返回侧边栏</button></div>{createPortal(<FloatingAgent><AgentContent/></FloatingAgent>,document.body)}</>:<AgentContent/>;}
