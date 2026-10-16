import { tr, useInterfaceLanguage } from '../i18n';
import { useMemo } from 'react';
import { Image, AlertCircle, History, Clapperboard, FileCode2, CheckCircle2, Sparkles } from 'lucide-react';
import { useStudio } from '../state/store';
import { validateProject } from '../model/validate';
import { usePreview } from './context';
import { Assets } from './Assets';
import { Timeline } from './Timeline';
import { useAgent } from '../agent/store';
import { HistoryPanel } from './history/HistoryPanel';

export function BottomPanel(){
  const interfaceLanguage = useInterfaceLanguage(s => s.language);
  const s=useStudio(),preview=usePreview(),validation=useMemo(()=>s.project?validateProject(s.project):[],[s.project,interfaceLanguage]);
  const issues=[...validation,...preview.issues];
  return <div className="bottom-panel"><div className="bottom-tabs">{[['assets',tr("资源库"),Image],['timeline',tr("时间轴"),Clapperboard],['problems',tr("问题"),AlertCircle],['history',tr("历史记录"),History]].map(([id,label,Icon]:any)=><button key={id} className={s.bottom===id?'active':''} onClick={()=>s.set({bottom:id})}><Icon size={13}/>{label}{id==='problems'&&<small>{issues.length}</small>}</button>)}<span className="spacer"/>{s.bottom==='problems'&&issues.length>0&&<button onClick={()=>useAgent.getState().compose(tr("检查当前问题列表，读取相关文件并修复能够确定的配置问题。"))}><Sparkles size={12}/>{tr("交给 Agent 修复")}</button>}<span className="bottom-caption">{s.bottom==='assets'?tr("{0} 个已注册图片", Object.keys(preview.images).length):s.bottom==='history'?tr("{0} 次可撤销编辑", s.past.length):'FutureUI 1.0.0'}</span></div><div className="bottom-body">{s.bottom==='assets'?<Assets/>:s.bottom==='timeline'?<Timeline/>:s.bottom==='history'?<HistoryPanel/>:<div className="issue-list">{issues.map((issue,i)=><button key={i} onClick={()=>{s.openFile(issue.file);s.set({workspace:'design',view:'code',selected:issue.path?{file:issue.file,path:issue.path}:null});}}><AlertCircle className={issue.level} size={14}/><span>{issue.message}</span><small>{issue.file}</small><FileCode2 size={12}/></button>)}{!issues.length&&<div className="inline-empty"><CheckCircle2 size={17}/>{tr("离线语法与静态引用检查通过 · 游戏运行时行为需另外确认")}</div>}</div>}</div></div>;
}
