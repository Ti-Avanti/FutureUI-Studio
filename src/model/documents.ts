import { parseDocument, isSeq } from 'yaml';
import type { Config, PathKey, ProjectFile } from './types';

const cache = new Map<string, { text: string; value: Config; error: string | null }>();
export function readYaml(file?: ProjectFile): { value: Config; error: string | null } {
  if (!file) return { value: {}, error: null };
  const cached = cache.get(file.path);
  if (cached?.text === file.text) return cached;
  try {
    const doc = parseDocument(file.text, { keepSourceTokens: true, uniqueKeys: true });
    if (doc.errors.length) throw Error(doc.errors[0].message);
    const value = doc.toJS({ maxAliasCount: 100 }) ?? {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('配置根节点必须是映射');
    const result = { text: file.text, value, error: null };
    cache.set(file.path, result); return result;
  } catch (e) { return { value: {}, error: String(e instanceof Error ? e.message : e) }; }
}
export function at(value: any, path: PathKey[]): any { return path.reduce((v, key) => v?.[key], value); }
export function editYaml(text: string, path: PathKey[], value: unknown, remove = false): string {
  const doc = parseDocument(text, { keepSourceTokens: true, uniqueKeys: true });
  if (doc.errors.length) throw Error('请先修复 YAML 语法错误');
  if (remove) doc.deleteIn(path); else doc.setIn(path, value);
  const result = doc.toString({ lineWidth: 0 });
  return text.includes('\r\n') ? result.replace(/\r?\n/g, '\r\n') : result;
}
export function moveYaml(text: string, from: PathKey[], to: PathKey[], before?: number): string {
  const doc = parseDocument(text, { keepSourceTokens: true });
  if (doc.errors.length) throw Error('请先修复 YAML 语法错误');
  if (JSON.stringify(to).startsWith(JSON.stringify(from).slice(0, -1) + ',')) throw Error('组件不能移入自己的子节点');
  const parentPath = from.slice(0, -1), source = doc.getIn(parentPath, true), target = doc.getIn(to, true);
  if (!isSeq(source) || !isSeq(target)) throw Error('请选择一个已有容器');
  const index = Number(from.at(-1));
  let insertion = before ?? target.items.length;
  const node = source.items[index];
  if (!node) throw Error('组件已改变，请重新选择');
  source.items.splice(index, 1);
  if (source === target && insertion > index) insertion--;
  target.items.splice(insertion, 0, node);
  const result = doc.toString({ lineWidth: 0 });
  return text.includes('\r\n') ? result.replace(/\r?\n/g, '\r\n') : result;
}
export function merge(base: Config, override: Config): Config {
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) out[key] = merge(base[key], value);
    else out[key] = value;
  }
  return out;
}
export function documentId(file: ProjectFile) { const data = readYaml(file).value; return String(data.id ?? file.path.replace(/^(menus|templates|shops|functions|rules|hud)\//, '').replace(/\.ya?ml$/, '')); }
export function shortName(file: string) { return file.split('/').pop()?.replace(/\.ya?ml$/, '') ?? file; }
