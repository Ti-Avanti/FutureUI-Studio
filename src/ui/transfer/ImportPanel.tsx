import { useMemo, useState } from 'react';
import { FileInput, FolderOpen, Check, AlertTriangle, FileCode2, ArrowRight } from 'lucide-react';
import { useStudio } from '../../state/store';
import { useTransfer } from '../../transfer/store';
import { planImport } from '../../transfer/plan';
import type { ConflictChoice, ImportStrategy } from '../../transfer/types';
import { validateProject } from '../../model/validate';
import { applyFileEdits } from '../../state/history';
import { ConfigDiff } from '../shared/ConfigDiff';

const strategyLabels = { merge: '合并字段', replace: '替换文件', keep: '保留现有' };
const display = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2))?.slice(0, 800) ?? 'null';

export function ImportPanel() {
  const s = useStudio(), t = useTransfer(), [search, setSearch] = useState(''), [details, setDetails] = useState(false);
  const plan = useMemo(() => s.project && t.batch ? planImport(s.project, t.batch, t.choices) : null, [s.project, t.batch, t.choices]);
  const preview = plan?.previews.find(p => p.choice.id === t.selectedId), choice = preview?.choice;
  const validation = useMemo(() => {
    if (!s.project || !plan?.edits.length || plan.errors.length) return [];
    const baseline = new Set(validateProject(s.project).map(i => `${i.file}:${i.message}`));
    return validateProject({ ...s.project, files: applyFileEdits(s.project.files, plan.edits, 'after', s.savedHashes) }).filter(i => i.level === 'error' && !baseline.has(`${i.file}:${i.message}`));
  }, [s.project, s.savedHashes, plan]);
  function apply() {
    if (!plan || !s.project || plan.errors.length || validation.length) return;
    try {
      s.applyChanges(plan.edits, `导入并合并 ${plan.edits.length} 个配置`, t.projectId);
      s.set({ notice: `已导入 ${plan.edits.length} 个配置 · 可从历史节点整体回退，尚未写入磁盘` });
      t.set({ batch: null, choices: [], open: false, error: '' });
    } catch (error) { t.set({ error: (error as Error).message }); }
  }
  const chooseButtons = <><button className="secondary-button" disabled={t.busy} onClick={() => void t.choose('files')}><FileInput size={14}/>选择 YAML / ZIP</button><button className="secondary-button" disabled={t.busy} onClick={() => void t.choose('folder')}><FolderOpen size={14}/>选择目录</button></>;
  if (!t.batch || !plan) return <><div className="transfer-empty"><div className="transfer-symbol"><FileInput size={34}/></div><h3>把已有配置带进当前工程</h3><p>支持多个 YAML 文件、ZIP 配置包或整个配置目录。<br/>先选择文件、处理冲突，再一次性应用。</p><div className="button-row">{chooseButtons}</div><small>这里只导入 YAML；图片可从资源库导入，完整资源包可从导出页生成。</small></div><footer className="workbench-dialog-footer"><span>导入会成为一个可回退的操作节点</span></footer></>;
  return <>
    <div className="transfer-toolbar">{chooseButtons}<span className="spacer"/><span>已选 {t.choices.filter(c => c.selected).length} / {t.choices.length} 个文件</span><button className="text-action" onClick={() => t.set({ choices: t.choices.map(c => ({ ...c, selected: true })) })}>全选</button><button className="text-action" onClick={() => t.set({ choices: t.choices.map(c => ({ ...c, selected: false })) })}>清空</button></div>
    <div className="config-workbench-body"><aside className="config-file-sidebar"><input aria-label="筛选导入文件" placeholder="搜索文件…" value={search} onChange={e => setSearch(e.target.value)}/><div className="config-file-list">{plan.previews.filter(p => p.choice.path.toLowerCase().includes(search.toLowerCase())).map(p => <div className={`config-file-row ${p.choice.id === t.selectedId ? 'active' : ''}`} key={p.choice.id}><input aria-label={`导入 ${p.choice.path}`} type="checkbox" checked={p.choice.selected} onChange={e => t.change(p.choice.id, { selected: e.target.checked })}/><button onClick={() => t.set({ selectedId: p.choice.id })}><FileCode2 size={14}/><span title={p.choice.path}>{p.choice.path}</span><small className={p.error ? 'error-text' : ''}>{p.error ? '需处理' : p.before === null ? '新增' : p.before === p.after ? '无变化' : strategyLabels[p.choice.strategy]}</small></button></div>)}</div></aside>
    <section className="config-detail">{preview && choice && <>
      <div className="import-file-settings"><label><span>目标路径</span><input aria-label="导入目标路径" value={choice.path} onChange={e => t.change(choice.id, { path: e.target.value })}/></label><label><span>同名文件</span><select aria-label="同名文件处理方式" value={choice.strategy} disabled={preview.before === null} onChange={e => t.change(choice.id, { strategy: e.target.value as ImportStrategy })}>{Object.entries(strategyLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label></div>
      {choice.strategy === 'merge' && preview.before !== null && <div className="merge-options"><span>不同值如何处理</span><select aria-label="冲突默认处理" value={choice.preferred} onChange={e => t.change(choice.id, { preferred: e.target.value as ConflictChoice, conflicts: {} })}><option value="current">保留当前值</option><option value="incoming">使用导入值</option></select><button className="text-action" disabled={!preview.conflicts.length} onClick={() => setDetails(v => !v)}>{preview.conflicts.length} 处不同值 {details ? '收起' : '逐项选择'}</button></div>}
      {details && preview.conflicts.length > 0 && <div className="merge-conflicts">{preview.conflicts.map(c => <div key={c.key}><div><code>{c.label}</code><select aria-label={`处理 ${c.label}`} value={c.choice} onChange={e => t.change(choice.id, { conflicts: { ...choice.conflicts, [c.key]: e.target.value as ConflictChoice } })}><option value="current">保留当前</option><option value="incoming">使用导入</option></select></div><div className="conflict-values"><pre>{display(c.current)}</pre><ArrowRight size={13}/><pre>{display(c.incoming)}</pre></div></div>)}</div>}
      {preview.error ? <div className="config-error"><AlertTriangle size={17}/><p>{preview.error}</p></div> : <ConfigDiff path={choice.path} before={preview.before} after={preview.after} afterLabel="应用后的配置"/>}
    </>}</section></div>
    {(t.batch.ignored > 0 || t.batch.warnings.length > 0) && <div className="transfer-import-note">{t.batch.ignored > 0 && `已跳过 ${t.batch.ignored} 个非配置文件或目录。`}{t.batch.warnings[0]}</div>}
    {validation.length > 0 && <div className="config-validation-error"><AlertTriangle size={14}/>合并后出现 {validation.length} 个配置错误：{validation[0].file} · {validation[0].message}</div>}
    <footer className="workbench-dialog-footer"><span>{plan.errors.length ? `${plan.errors.length} 个选中文件需要处理` : `将修改 ${plan.edits.length} 个文件`}<small>按组件 ID 合并；没有 ID 的列表整体处理。应用后可回退。</small></span><button className="primary-button" disabled={t.busy || s.busy || !!t.error || !plan.edits.length || !!plan.errors.length || !!validation.length || s.project?.id !== t.projectId} onClick={apply}><Check size={14}/>应用导入</button></footer>
  </>;
}
