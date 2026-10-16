import { tr, useInterfaceLanguage, interfaceLocale } from '../../i18n';
import { Plus, X, History, Trash2, LoaderCircle } from 'lucide-react';
import type { Conversation } from '../../agent/types';
const conversationTitle = (s: Conversation) => s.messages.length ? s.title : tr('新会话');
import { useAgent } from '../../agent/store';
export function SessionTabs(){
  useInterfaceLanguage();
  const a=useAgent();
  return <div className="agent-sessions"><div className="session-tabs">{a.sessions.filter(s=>!s.archived).map(s=><div key={s.id} className={s.id===a.activeId?'active':''}><button onClick={()=>a.switchSession(s.id)} title={conversationTitle(s)}>{s.running&&<LoaderCircle className="spin" size={10}/>}<span>{conversationTitle(s)}</span></button><button aria-label={tr("归档会话 {0}", conversationTitle(s))} disabled={s.running} onClick={()=>a.archiveSession(s.id)}><X size={10}/></button></div>)}</div><button className="session-new" aria-label={tr("创建新会话")} title={tr("创建独立会话")} onClick={a.newSession}><Plus size={14}/></button><button className="session-new" aria-label={tr("会话历史")} onClick={()=>a.set({historyOpen:!a.historyOpen})}><History size={14}/></button>{a.historyOpen&&<div className="session-history"><header><strong>{tr("工程会话")}</strong><span>{a.sessions.length}{tr(" 个")}</span></header>{[...a.sessions].reverse().map(s=><div key={s.id}><button onClick={()=>a.switchSession(s.id)}><strong>{conversationTitle(s)}</strong><small>{s.running?tr("正在运行"):s.archived?tr("已归档"):tr("{0} 条消息", s.messages.length)} · {new Date(s.createdAt).toLocaleDateString(interfaceLocale())}</small></button><button title={tr("删除会话记录")} aria-label={tr("删除会话 {0}", conversationTitle(s))} disabled={s.running} onClick={()=>{if(window.confirm(tr("删除“{0}”的本地会话记录？菜单文件会保留。", conversationTitle(s))))a.deleteSession(s.id);}}><Trash2 size={12}/></button></div>)}</div>}</div>;
}
