import { tr } from '../i18n';
import { isSeq, parseDocument } from 'yaml';
import type { ConflictChoice } from './types';

export interface MergeConflict { key: string; label: string; current: unknown; incoming: unknown; choice: ConflictChoice }
const mapping = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const equal = (a: unknown, b: unknown): boolean => {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if (mapping(a) && mapping(b)) return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
  return false;
};
const identified = (values: unknown[]): values is Record<string, unknown>[] => values.every(v => mapping(v) && typeof v.id === 'string' && v.id.length > 0) && new Set(values.map(v => (v as Record<string, unknown>).id)).size === values.length;

function document(text: string) {
  const doc = parseDocument(text, { uniqueKeys: true, keepSourceTokens: true });
  if (doc.errors.length) throw Error(doc.errors[0].message);
  const data = doc.toJS({ maxAliasCount: 100 });
  if (!mapping(data)) throw Error(tr("配置根节点必须是映射"));
  return { doc, data };
}

export function yamlError(text: string): string {
  try { document(text); return ''; } catch (error) { return (error as Error).message; }
}

export function mergeConfiguration(currentText: string, incomingText: string, preferred: ConflictChoice, choices: Record<string, ConflictChoice>) {
  const { doc, data: current } = document(currentText), incoming = document(incomingText).data;
  const conflicts: MergeConflict[] = [];
  let changed = false;
  function replace(path: (string | number)[], value: unknown) { doc.setIn(path, value); changed = true; }
  function visit(a: unknown, b: unknown, path: (string | number)[], labels: string[]) {
    if (equal(a, b)) return;
    if (mapping(a) && mapping(b)) {
      for (const [key, value] of Object.entries(b)) {
        if (Object.hasOwn(a, key)) visit(a[key], value, [...path, key], [...labels, key]);
        else replace([...path, key], value);
      }
      return;
    }
    if (Array.isArray(a) && Array.isArray(b) && identified(a) && identified(b)) {
      const indices = new Map(a.map((v, i) => [v.id, i]));
      for (const item of b) {
        const index = indices.get(item.id);
        if (index !== undefined) visit(a[index], item, [...path, index], [...labels, `[${item.id}]`]);
        else { const sequence = doc.getIn(path, true); if (!isSeq(sequence)) throw Error(tr("组件列表无法合并")); sequence.add(doc.createNode(item)); changed = true; }
      }
      return;
    }
    const key = JSON.stringify(labels), choice = choices[key] ?? preferred;
    conflicts.push({ key, label: labels.join(' › '), current: a, incoming: b, choice });
    if (choice === 'incoming') replace(path, b);
  }
  visit(current, incoming, [], []);
  let text = changed ? doc.toString({ lineWidth: 0 }) : currentText;
  if (changed && currentText.includes('\r\n')) text = text.replace(/\r?\n/g, '\r\n');
  const error = yamlError(text); if (error) throw Error(error);
  return { text, conflicts };
}
