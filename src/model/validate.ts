import catalog from '../../resources/capabilities.json';
import { documentId, readYaml } from './documents';
import type { Config, Issue, Project } from './types';

export function validateProject(project: Project): Issue[] {
  const issues: Issue[] = [], ids = new Map<string, string>();
  const menus = new Set(project.files.filter(f => f.path.startsWith('menus/')).map(documentId));
  const templates = new Set(project.files.filter(f => f.path.startsWith('templates/')).map(f => f.path.replace(/^templates\//, '').replace(/\.ya?ml$/, '')));
  for (const file of project.files) {
    const parsed = readYaml(file);
    if (parsed.error) { issues.push({ level: 'error', file: file.path, message: parsed.error }); continue; }
    if (!/^(menus|templates)\//.test(file.path)) continue;
    const root = parsed.value, id = file.path.startsWith('templates/') ? file.path.replace(/^templates\//, '').replace(/\.ya?ml$/, '') : documentId(file), key = `${file.path.split('/')[0]}:${id}`;
    if (ids.has(key)) issues.push({ level: 'error', file: file.path, message: `重复 ID ${id}，也在 ${ids.get(key)}` }); ids.set(key, file.path);
    const seen = new Set<string>();
    function walk(node: Config, path: (string | number)[], depth: number) {
      if (!node || typeof node !== 'object' || depth > 24) return;
      if (node.template && !templates.has(node.template)) issues.push({ level: 'error', file: file.path, path, message: `模板不存在：${node.template}` });
      if (node.type === 'open-menu' && typeof node.menu === 'string' && !node.menu.includes('{') && !menus.has(node.menu)) issues.push({ level: 'error', file: file.path, path, message: `目标菜单不存在：${node.menu}` });
      for (const [k, v] of Object.entries(node)) if (Array.isArray(v)) v.forEach((entry, i) => walk(entry, [...path, k, i], depth + 1)); else if (v && typeof v === 'object') walk(v, [...path, k], depth + 1);
    }
    function components(nodes: Config[], path: (string | number)[], depth = 0) {
      if (depth > 24) return;
      nodes.forEach((node, i) => {
        if (!node || typeof node !== 'object') return;
        const current = [...path, i];
        if (typeof node.id === 'string') {
          if (seen.has(node.id)) issues.push({ level: 'error', file: file.path, path: current, message: `重复组件 ID：${node.id}` });
          seen.add(node.id);
        }
        for (const key of ['children', 'after-items']) if (Array.isArray(node[key])) components(node[key], [...current, key], depth + 1);
      });
    }
    walk(root, [], 0);
    if (Array.isArray(root.components)) components(root.components, ['components']);
    else if (Array.isArray(root.children)) components(root.children, ['children']);
  }
  return issues;
}
export const capabilities = catalog;
