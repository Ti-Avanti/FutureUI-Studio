import { tr, useInterfaceLanguage } from '../../i18n';
import { useMemo, useState } from 'react';
import { FileOutput, FileCode2, Package, CheckCircle2 } from 'lucide-react';
import { useStudio, dirtyFiles } from '../../state/store';
import { useTransfer } from '../../transfer/store';
import { yamlError } from '../../transfer/merge';

export function ExportPanel() {
  useInterfaceLanguage();
  const s = useStudio(), t = useTransfer();
  const [selected, setSelected] = useState<Set<string>>(() => new Set(s.active ? [s.active] : []));
  const [search, setSearch] = useState(''), [format, setFormat] = useState<'yaml' | 'zip'>('yaml'), [assets, setAssets] = useState(false), [output, setOutput] = useState('');
  const files = s.project?.files ?? [], chosen = files.filter(f => selected.has(f.path));
  const invalid = useMemo(() => chosen.find(f => yamlError(f.text)), [chosen]);
  function select(paths: string[]) { setSelected(new Set(paths)); if (paths.length !== 1) setFormat('zip'); setOutput(''); }
  async function exportSelected() {
    if (!s.project || !chosen.length) return;
    const id = s.project.id;
    t.set({ busy: true, error: '' });
    try {
      const result = await window.studio.transfer.export(id, chosen, format, assets);
      if (result) { setOutput(result); s.set({ notice: tr("已导出 {0} 个配置：{1}", chosen.length, result) }); }
    } catch (error) { t.set({ error: (error as Error).message }); }
    finally { t.set({ busy: false }); }
  }
  return <>
    <div className="transfer-toolbar"><button className="secondary-button" disabled={t.busy} onClick={() => select(s.active ? [s.active] : [])}>{tr("当前文件")}</button><button className="secondary-button" disabled={t.busy} onClick={() => select(files.map(f => f.path))}>{tr("全部配置")}</button><button className="secondary-button" disabled={t.busy} onClick={() => select(dirtyFiles(s).filter(f => f.text !== null).map(f => f.path))}>{tr("未保存的修改")}</button><button className="text-action" disabled={t.busy} onClick={() => select([])}>{tr("清空选择")}</button><span className="spacer"/><span>{tr("已选 ")}{chosen.length} / {files.length}{tr(" 个文件")}</span></div>
    <div className="config-workbench-body export-body"><aside className="config-file-sidebar"><input aria-label={tr("筛选导出文件")} value={search} placeholder={tr("搜索文件…")} onChange={e => setSearch(e.target.value)}/><div className="config-file-list">{files.filter(f => f.path.toLowerCase().includes(search.toLowerCase())).map(f => <label className={`export-file-row ${selected.has(f.path) ? 'active' : ''}`} key={f.path}><input type="checkbox" aria-label={tr("导出 {0}", f.path)} disabled={t.busy} checked={selected.has(f.path)} onChange={e => { const next = new Set(selected); e.target.checked ? next.add(f.path) : next.delete(f.path); select([...next]); }}/><FileCode2 size={14}/><span title={f.path}>{f.path}</span></label>)}</div></aside>
    <section className="export-options"><div className="export-summary-icon">{format === 'yaml' ? <FileOutput size={31}/> : <Package size={31}/>}</div><h3>{tr("{0} 个配置文件",chosen.length)}</h3><p>{tr("导出当前编辑内容，包括尚未保存的修改。")}<br/>{tr("原工程不会因此被覆盖。")}</p><label><span>{tr("导出格式")}</span><select aria-label={tr("导出格式")} disabled={t.busy} value={format} onChange={e => setFormat(e.target.value as 'yaml' | 'zip')}><option value="yaml" disabled={chosen.length !== 1}>{tr("单个 YAML 文件")}</option><option value="zip">{tr("ZIP 配置包 · 保留目录结构")}</option></select></label>{format === 'zip' && <label className="export-assets"><input type="checkbox" checked={assets} disabled={t.busy} onChange={e => setAssets(e.target.checked)}/><span>{tr("同时包含工程里的图片、着色器和其他资源")}</span></label>}<div className="export-help">{tr("选择少量文件用于分享或合并；选择全部配置并包含资源，可导出完整配置包。不会包含玩家数据、编辑器模型密钥、Agent 会话或回退记录；配置文件内原有内容会保留。")}</div>{invalid && <p className="error-text">{invalid.path}{tr(" 存在 YAML 错误，请先修复再导出。")}</p>}{output && <div className="export-success"><CheckCircle2 size={16}/><span>{tr("导出完成")}<code>{output}</code></span></div>}</section></div>
    <footer className="workbench-dialog-footer"><span>{tr("UTF-8 无 BOM")}<small>{tr("ZIP 保留工程相对路径，方便再次导入和合并。")}</small></span><button className="primary-button" disabled={t.busy || !chosen.length || !!invalid || s.project?.id !== t.projectId || format === 'yaml' && chosen.length !== 1} onClick={() => void exportSelected()}><FileOutput size={14}/>{t.busy ? tr("正在导出…") : tr("导出所选配置")}</button></footer>
  </>;
}
