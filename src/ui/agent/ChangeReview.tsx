import { tr, useInterfaceLanguage } from '../../i18n';
import { useEffect, useState } from 'react';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import { createPortal } from 'react-dom';
import { DiffEditor } from '@monaco-editor/react';
import { Check, X, Eye, FileDiff, FileCode2 } from 'lucide-react';
import { useAgent } from '../../agent/store';
import { useStudio } from '../../state/store';
import '../CodeEditor';

export function ChangeReview(){
  useInterfaceLanguage();
  const a=useAgent(),s=useStudio(),[index,setIndex]=useState<number|null>(null),proposal=index===null?null:a.proposals[index];
  const originalPath=proposal?`studio-diff:///${a.runId}/${proposal.path}/before`:undefined,modifiedPath=proposal?`studio-diff:///${a.runId}/${proposal.path}/after`:undefined;
  useEffect(()=>()=>{queueMicrotask(()=>{for(const path of [originalPath,modifiedPath])if(path)monaco.editor.getModel(monaco.Uri.parse(path))?.dispose();});},[originalPath,modifiedPath]);
  if(!a.proposals.length)return null;
  const stale=s.project?.id!==a.projectId||a.proposals.some(p=>(s.project?.files.find(f=>f.path===p.path)?.text??null)!==p.before);
  return <><div className="agent-review"><div className="agent-review-title"><FileDiff size={14}/><strong>{a.proposals.length}{tr(" 个待审文件")}</strong><span>{tr("尚未应用")}</span></div><div className="agent-change-list">{a.proposals.map((p,i)=><button key={p.path} onClick={()=>setIndex(i)} title={p.summary}><FileCode2 size={12}/><span>{p.path}</span><small>{p.before===null?tr("新增"):tr("修改")}</small></button>)}</div>{stale&&<p className="agent-inline-error">{tr("原配置已变更，请查看差异后重新生成。")}</p>}<div className="button-row"><button className={`secondary-button ${s.previewOverrides?'active':''}`} onClick={a.preview} disabled={stale}><Eye size={13}/>{s.previewOverrides?tr("退出预览"):tr("画布预览")}</button><button className="primary-button" disabled={stale} onClick={a.apply}><Check size={13}/>{tr("应用方案")}</button><button className="agent-text-button" onClick={a.discard}>{tr("放弃")}</button></div></div>{proposal&&createPortal(<div className="agent-diff-shade"><div className="agent-diff"><header><FileDiff size={16}/><strong>{tr("审阅修改")}</strong><select aria-label={tr("待审文件")} value={index!} onChange={e=>setIndex(Number(e.target.value))}>{a.proposals.map((p,i)=><option value={i} key={p.path}>{p.path}</option>)}</select><button aria-label={tr("关闭差异")} onClick={()=>setIndex(null)}><X size={17}/></button></header><p>{proposal.summary}</p><div className="diff-labels"><span>{tr("原配置")}</span><span>{tr("Agent 方案")}</span></div><div className="agent-diff-editor"><DiffEditor keepCurrentOriginalModel keepCurrentModifiedModel originalModelPath={originalPath} modifiedModelPath={modifiedPath} original={proposal.before??''} modified={proposal.after} language="yaml" theme="studio" options={{readOnly:true,automaticLayout:true,renderSideBySide:true,minimap:{enabled:false},fontSize:12,wordWrap:'on',scrollBeyondLastLine:false}}/></div><footer><span>{tr("应用后可撤销，保存后才会写入磁盘")}</span><button className="primary-button" disabled={stale} onClick={()=>{a.apply();setIndex(null);}}>{tr("应用全部修改")}</button></footer></div></div>,document.body)}</>;
}
