import { tr } from '../i18n';
import type { Change, FileEdit, ProjectFile } from '../model/types';

export function applyFileEdits(files: ProjectFile[], edits: FileEdit[], direction: 'before' | 'after', hashes: Record<string, string | null>): ProjectFile[] {
  const next = new Map(files.map(f => [f.path, f]));
  for (const edit of edits) {
    const text = edit[direction];
    if (text === null) next.delete(edit.path);
    else next.set(edit.path, { path: edit.path, text, hash: hashes[edit.path] ?? null });
  }
  return [...next.values()];
}

export function difference(current: { path: string; text: string }[], target: { path: string; text: string }[]): FileEdit[] {
  const before = new Map(current.map(f => [f.path, f.text])), after = new Map(target.map(f => [f.path, f.text]));
  return [...new Set([...before.keys(), ...after.keys()])].sort().flatMap(path => {
    const a = before.get(path) ?? null, b = after.get(path) ?? null;
    return a === b ? [] : [{ path, before: a, after: b }];
  });
}

export function timelineFiles(files: ProjectFile[], past: Change[], future: Change[], index: number, hashes: Record<string, string | null>): ProjectFile[] {
  if (!Number.isInteger(index) || index < 0 || index > past.length + future.length) throw Error(tr("操作节点已改变，请重新选择"));
  let result = files;
  if (index < past.length) for (const node of past.slice(index).reverse()) result = applyFileEdits(result, node.files, 'before', hashes);
  else for (const node of [...future].reverse().slice(0, index - past.length)) result = applyFileEdits(result, node.files, 'after', hashes);
  return result;
}

export function selectionAfter(files: ProjectFile[], active: string, tabs: string[]) {
  const available = new Set(files.map(f => f.path));
  const selected = available.has(active) ? active : files.find(f => f.path.startsWith('menus/'))?.path ?? files[0]?.path ?? '';
  const opened = tabs.filter(p => available.has(p));
  return { active: selected, tabs: opened.length ? opened : selected ? [selected] : [], selected: null, previewOverrides: null };
}
