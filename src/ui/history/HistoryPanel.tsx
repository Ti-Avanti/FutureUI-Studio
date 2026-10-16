import { historyLabel } from '../../history/labels';
import { tr, useInterfaceLanguage, interfaceLocale } from '../../i18n';
import { History, ArrowUpRight } from 'lucide-react';
import { useStudio } from '../../state/store';
import { useHistoryDialog } from '../../history/store';

export function HistoryPanel() {
  useInterfaceLanguage();
  const s = useStudio(), h = useHistoryDialog();
  return <div className="history-compact"><button className="history-open-button" onClick={h.show}><History size={15}/><span>{tr("查看操作节点与保存节点")}</span><ArrowUpRight size={14}/></button><div className="history-list">{[...s.past].reverse().map(item => <button key={item.id} onClick={h.show}><History size={13}/><strong>{historyLabel(item.label)}</strong><span>{historyLabel(item.path)}</span><small>{new Date(item.time).toLocaleTimeString(interfaceLocale())}</small></button>)}{!s.past.length && <div className="inline-empty">{tr("修改、导入和 Agent 操作会记录在这里。")}</div>}</div></div>;
}
