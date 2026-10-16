import { useTransfer } from '../../transfer/store';
import { WorkbenchDialog } from '../shared/WorkbenchDialog';
import { ImportPanel } from './ImportPanel';
import { ExportPanel } from './ExportPanel';

export function TransferDialog() {
  const t = useTransfer();
  if (!t.open) return null;
  return <WorkbenchDialog title="配置导入与导出" subtitle="选择文件、预览差异，再应用到工程" busy={t.busy} close={t.close}>
    <div className="workbench-tabs"><button disabled={t.busy} className={t.mode === 'import' ? 'active' : ''} onClick={() => t.set({ mode: 'import', error: '' })}>导入与合并</button><button disabled={t.busy} className={t.mode === 'export' ? 'active' : ''} onClick={() => t.set({ mode: 'export', error: '' })}>快捷导出</button></div>
    {t.error && <div className="config-validation-error" role="alert">{t.error}</div>}
    {t.mode === 'import' ? <ImportPanel/> : <ExportPanel key={t.projectId}/>}
  </WorkbenchDialog>;
}
