import { tr } from '../i18n';
import type { FileEdit, Project } from '../model/types';
import { configPathError } from '../model/paths';
import { mergeConfiguration, yamlError, type MergeConflict } from './merge';
import type { ImportBatch, ImportChoice } from './types';

export interface ImportPreview { choice: ImportChoice; before: string | null; after: string | null; error: string; conflicts: MergeConflict[] }
export function planImport(project: Project, batch: ImportBatch, choices: ImportChoice[]) {
  const originals = new Map(project.files.map(f => [f.path, f.text]));
  const casingPaths = new Map(project.files.map(f => [f.path.toLowerCase(), f.path]));
  const byId = new Map(choices.map(c => [c.id, c]));
  const paths = new Map<string, number>();
  for (const c of choices.filter(c => c.selected)) paths.set(c.path.toLowerCase(), (paths.get(c.path.toLowerCase()) ?? 0) + 1);
  const previews: ImportPreview[] = batch.entries.map(entry => {
    const choice = byId.get(entry.id)!;
    const before = originals.get(choice.path) ?? null;
    const preview: ImportPreview = { choice, before, after: before, error: '', conflicts: [] };
    try {
      const casing = casingPaths.get(choice.path.toLowerCase());
      const error = entry.error || configPathError(choice.path) || (casing && casing !== choice.path ? tr("与现有文件的大小写冲突，请使用原路径") : '') || ((paths.get(choice.path.toLowerCase()) ?? 0) > 1 && choice.selected ? tr("多个导入文件指向同一路径，请取消选择或更改路径") : '') || yamlError(entry.text);
      if (error) throw Error(error);
      if (before === null) preview.after = entry.text;
      else if (choice.strategy === 'replace') preview.after = entry.text;
      else if (choice.strategy === 'merge') { const result = mergeConfiguration(before, entry.text, choice.preferred, choice.conflicts); preview.after = result.text; preview.conflicts = result.conflicts; }
    } catch (error) { preview.error = (error as Error).message; }
    return preview;
  });
  const edits: FileEdit[] = previews.filter(p => p.choice.selected && !p.error && p.before !== p.after).map(p => ({ path: p.choice.path, before: p.before, after: p.after }));
  return { previews, edits, errors: previews.filter(p => p.choice.selected && p.error) };
}
