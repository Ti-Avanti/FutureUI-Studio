import { historyLabel } from '../../history/labels';
import { tr, useInterfaceLanguage, interfaceLocale } from '../../i18n';
import { useEffect, useMemo, useState } from 'react';
import { History, Save, RotateCcw, ArrowLeft, ArrowRight, CheckCircle2, FileDiff } from 'lucide-react';
import { useStudio } from '../../state/store';
import { difference, timelineFiles } from '../../state/history';
import { useHistoryDialog } from '../../history/store';
import type { SavedNode } from '../../history/types';
import { WorkbenchDialog } from '../shared/WorkbenchDialog';
import { ConfigDiff } from '../shared/ConfigDiff';

const date = (time: number) => new Date(time).toLocaleString(interfaceLocale(), { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

function HistoryWorkspace() {
  useInterfaceLanguage();
  const s = useStudio(), [tab, setTab] = useState<'session' | 'saved'>('session');
  const [nodeId, setNodeId] = useState(s.past.at(-1)?.id ?? 'baseline'), [savedId, setSavedId] = useState('');
  const [saved, setSaved] = useState<SavedNode[]>([]), [snapshot, setSnapshot] = useState<{ id: string; files: { path: string; text: string }[] } | null>(null);
  const [loading, setLoading] = useState(false), [error, setError] = useState(''), [filePath, setFilePath] = useState('');
  const all = useMemo(() => [...s.past, ...[...s.future].reverse()], [s.past, s.future]);
  const index = nodeId === 'baseline' ? 0 : all.findIndex(n => n.id === nodeId) + 1;
  useEffect(() => {
    if (!s.project) return;
    let alive = true;
    window.studio.history.list(s.project.id).then(nodes => { if (alive) setSaved(nodes); }).catch(e => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [s.project?.id, s.historyRevision]);
  useEffect(() => {
    if (!s.project || tab !== 'saved' || !savedId) { setSnapshot(null); return; }
    let alive = true; setLoading(true); setError(''); setSnapshot(null);
    window.studio.history.read(s.project.id, savedId).then(files => { if (alive) setSnapshot({ id: savedId, files }); }).catch(e => { if (alive) setError(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [s.project?.id, tab, savedId]);
  const target = useMemo(() => {
    if (!s.project) return null;
    if (tab === 'saved') return snapshot?.id === savedId ? snapshot.files : null;
    if (nodeId !== 'baseline' && !all.some(n => n.id === nodeId)) return null;
    return timelineFiles(s.project.files, s.past, s.future, index, s.savedHashes);
  }, [s.project, s.past, s.future, s.savedHashes, tab, snapshot, savedId, nodeId, index, all]);
  const edits = useMemo(() => s.project && target ? difference(s.project.files, target) : [], [s.project, target]);
  const focused = edits.find(e => e.path === filePath) ?? edits[0];
  const label = tab === 'session' ? index ? all[index - 1]?.label : s.historyTruncated ? tr("最早保留状态") : tr("本次打开工程") : saved.find(n => n.id === savedId)?.label ?? tr("选择保存节点");
  function restore() {
    if (!s.project || !target || s.busy) return;
    try {
      if (tab === 'session') s.restoreOperation(index);
      else { s.applyChanges(edits, tr("回退至保存节点 {0}", date(saved.find(n => n.id === savedId)!.time)), s.project.id); s.set({ notice: tr("已恢复保存节点的配置 · 可撤销，保存后才写入磁盘") }); }
      setError('');
    } catch (error) { setError((error as Error).message); }
  }
  const nodes = [{ id: 'baseline', label: s.historyTruncated ? tr("最早保留状态") : tr("本次打开工程"), time: 0, count: 0 }, ...all.map(n => ({ ...n, count: n.files.length }))];
  return <>
    <div className="workbench-tabs"><button className={tab === 'session' ? 'active' : ''} onClick={() => { setTab('session'); setError(''); }}>{tr("本次操作 ")}<small>{all.length}</small></button><button className={tab === 'saved' ? 'active' : ''} onClick={() => { setTab('saved'); if (!savedId) setSavedId(saved.at(-1)?.id ?? ''); }}>{tr("保存节点 ")}<small>{saved.length}</small></button><span className="spacer"/><button title={tr("后退一步")} disabled={!s.past.length || s.busy} onClick={() => { const id = s.past.at(-2)?.id ?? 'baseline'; s.undo(); setNodeId(id); setTab('session'); }}><ArrowLeft size={14}/></button><button title={tr("前进一步")} disabled={!s.future.length || s.busy} onClick={() => { const id = s.future.at(-1)!.id; s.redo(); setNodeId(id); setTab('session'); }}><ArrowRight size={14}/></button></div>
    {error && <div className="config-validation-error" role="alert">{error}</div>}
    <div className="config-workbench-body"><aside className="history-node-sidebar"><div className="history-list-heading">{tab === 'session' ? tr("选择一个操作完成后的状态") : tr("保存时自动创建 · 重启后仍可用")}</div><div className="history-node-list">{tab === 'session' ? nodes.map((node, i) => <button key={node.id} className={`${nodeId === node.id ? 'active' : ''} ${i > s.past.length ? 'ahead' : ''}`} onClick={() => { setNodeId(node.id); setFilePath(''); }}><i className={i === s.past.length ? 'current' : ''}/><div><strong>{historyLabel(node.label)}</strong><span>{node.time ? date(node.time) : tr("起始节点")}{node.count > 0 && tr(" · {0} 个文件", node.count)}</span></div>{i === s.past.length && <small>{tr("当前")}</small>}</button>) : [...saved].reverse().map(node => <button key={node.id} className={savedId === node.id ? 'active' : ''} onClick={() => { setSavedId(node.id); setFilePath(''); }}><Save size={14}/><div><strong>{historyLabel(node.label)}</strong><span>{date(node.time)} · {node.count}{tr(" 个配置")}</span></div></button>)}{tab === 'saved' && !saved.length && <p className="history-empty-note">{tr("第一次保存修改时，会自动记录保存前后的完整配置。")}</p>}</div><div className="history-retention">{tab === 'session' ? tr("最多保留本次打开期间的 200 个操作；连续输入会合并成一个节点。") : tr("保留最近 30 个保存节点，合计最多 256 MB。节点只包含 YAML 配置。")}</div></aside>
    <section className="config-detail"><div className="history-preview-heading"><div><History size={16}/><strong>{historyLabel(label ?? '')}</strong></div><p>{loading ? tr("正在读取节点…") : edits.length ? tr("将新增 {0}、修改 {1}、移除 {2} 个文件", edits.filter(e => e.before === null).length, edits.filter(e => e.before !== null && e.after !== null).length, edits.filter(e => e.after === null).length) : target ? tr("与当前配置一致") : tr("选择左侧节点查看变化")}</p></div>{focused && !loading ? <><div className="history-file-picker"><FileDiff size={14}/><select aria-label={tr("回退差异文件")} value={focused.path} onChange={e => setFilePath(e.target.value)}>{edits.map(e => <option key={e.path} value={e.path}>{e.after === null ? tr("移除") : e.before === null ? tr("新增") : tr("修改")} · {e.path}</option>)}</select></div><ConfigDiff path={focused.path} before={focused.before} after={focused.after} afterLabel={tr("回退后的配置")}/></> : <div className="history-no-diff"><CheckCircle2 size={32}/><strong>{loading ? tr("正在读取保存节点") : target ? tr("配置保持一致") : tr("查看历史，放心修改")}</strong><span>{tr("先查看差异，再选择回到哪个节点。")}</span></div>}</section></div>
    <footer className="workbench-dialog-footer"><span>{tr("回退先作用于编辑器")}<small>{tr("点击保存才会写入工程；回退本身也可以撤销或前进。")}</small></span><button className="primary-button" disabled={s.busy || loading || !target || (!edits.length && (tab === 'saved' || index === s.past.length))} onClick={restore}><RotateCcw size={14}/>{tr("回到此节点")}</button></footer>
  </>;
}

export function HistoryDialog() {
  useInterfaceLanguage();
  const h = useHistoryDialog(), project = useStudio(s => s.project);
  if (!h.open || !project) return null;
  return <WorkbenchDialog title={tr("操作与回退")} subtitle={tr("选中节点预览差异，一次回到需要的状态")} close={h.close}><HistoryWorkspace key={project.id}/></WorkbenchDialog>;
}
