import { useEffect, useId } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/editor/editor.api.js';
import '../CodeEditor';

export function ConfigDiff({ before, after, path, afterLabel = '修改后' }: { before: string | null; after: string | null; path: string; afterLabel?: string }) {
  const id = useId(), original = `config-diff:///${encodeURIComponent(id)}/${encodeURIComponent(path)}/before`, modified = `${original}/after`;
  useEffect(() => () => { queueMicrotask(() => { for (const uri of [original, modified]) monaco.editor.getModel(monaco.Uri.parse(uri))?.dispose(); }); }, [original, modified]);
  return <div className="config-diff"><div className="config-diff-labels"><span>{before === null ? '当前不存在' : '当前配置'}</span><span>{after === null ? '将移除此文件' : afterLabel}</span></div><div className="config-diff-editor"><DiffEditor keepCurrentOriginalModel keepCurrentModifiedModel originalModelPath={original} modifiedModelPath={modified} original={before ?? ''} modified={after ?? ''} loading={<span className="field-hint">正在载入差异预览…</span>} language="yaml" theme="studio" options={{ readOnly: true, originalEditable: false, automaticLayout: true, renderSideBySide: true, useInlineViewWhenSpaceIsLimited: false, fontSize: 12, wordWrap: 'on', scrollBeyondLastLine: false, minimap: { enabled: false }, renderOverviewRuler: false }}/></div></div>;
}
