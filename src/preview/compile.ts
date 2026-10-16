import { documentId, merge, readYaml } from '../model/documents';
import type { Config, Element, Issue, Origin, Preview, Project } from '../model/types';
import { keyOf } from '../model/types';
import { condition, indexProject, resolver, shopRows } from './environment';
import { layout } from './layout';

export function compile(project: Project, active: string, locale: string, variables: Config, time: number): Preview {
  const { docs, templates, language } = indexProject(project, locale), issues: Issue[] = [];
  const file = project.files.find(f => f.path === active), parsed = readYaml(file), variablesCopy = { ...variables };
  if (parsed.error) issues.push({ level: 'error', file: active, message: parsed.error });
  const origin: Origin = { file: active, path: [] };
  function expand(raw: Config, source: Origin, stack: string[] = []): Element {
    let base: Config = {};
    if (raw.template) {
      const name = String(raw.template), entry = templates.get(name);
      if (stack.includes(name)) issues.push({ level: 'error', file: source.file, path: source.path, message: `模板循环引用：${[...stack, name].join(' → ')}` });
      else if (!entry) issues.push({ level: 'error', file: source.file, path: source.path, message: `缺少模板：${name}` });
      else base = expand(entry.data, { file: entry.file.path, path: [] }, [...stack, name]);
    }
    const node = merge(base, { ...raw, _origin: source, _key: keyOf(source) }) as Element;
    for (const prop of ['children', 'components', 'after-items']) if (Array.isArray(raw[prop])) node[prop] = raw[prop].map((child: Config, i: number) => expand(child, { file: source.file, path: [...source.path, prop, i] }, stack));
    if (raw.item && typeof raw.item === 'object') node.item = expand(raw.item, { file: source.file, path: [...source.path, 'item'] }, stack);
    return node;
  }
  const menu = expand(parsed.value, origin);
  Object.assign(variablesCopy, menu.defaults ?? {}, variables);
  variablesCopy['player.display'] ??= variablesCopy['player.name'];
  variablesCopy['shop.balance'] ??= variablesCopy.balance;
  for (const [key, binding] of Object.entries(menu.bindings ?? {}) as [string, Config][]) {
    const resolve = resolver(language, variablesCopy);
    if (variablesCopy[key] !== undefined) continue;
    if (binding.type === 'currency') variablesCopy[key] = variablesCopy.balance;
    else if (binding.type === 'condition') variablesCopy[key] = condition(binding.condition, resolve, variablesCopy);
    else if (binding.value !== undefined) variablesCopy[key] = resolve(binding.value);
    else if (binding.default !== undefined) variablesCopy[key] = binding.default;
  }
  const warnSources = new Set<string>();
  function bind(nodes: Element[], context: Config, instance = '', depth = 0): Element[] {
    if (depth > 20) return [];
    return nodes.flatMap(original => {
      let node = { ...original }, scoped = { ...context };
      const initial = resolver(language, scoped);
      for (const [key, value] of Object.entries(node.context ?? {})) scoped[key] = initial(value);
      const resolve = resolver(language, scoped);
      const frames = node.animation?.frames;
      if (frames?.length) { const index = Math.floor(time / 50 / Math.max(1, Number(node.animation['interval-ticks'] ?? 20))); node = merge(node, frames[node.animation.loop === false ? Math.min(index, frames.length - 1) : index % frames.length]) as Element; }
      if (node.states?.length) {
        const state = [...node.states].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)).find(state => condition(state.visible, resolve, scoped));
        if (!state) return []; node = merge(node, state) as Element;
      }
      if (!condition(node.visible, resolve, scoped)) return [];
      if (node.type === 'list') {
        let rows = shopRows(node, docs, scoped, language) ?? scoped[`list.${node.id}`];
        if (!Array.isArray(rows)) {
          if (!warnSources.has(node.source)) { issues.push({ level: 'info', file: node._origin.file, path: node._origin.path, message: `数据源 ${node.source} 需要服务器；可在「数据」中提供 list.${node.id} 示例数组` }); warnSources.add(node.source); }
          rows = [];
        }
        if (node.paginate !== false) { const size = Number(node['page-size'] ?? 9); scoped.pages = Math.max(1, Math.ceil(rows.length / size)); rows = rows.slice((Number(scoped.page ?? 1) - 1) * size, Number(scoped.page ?? 1) * size); variablesCopy.pages = scoped.pages; }
        const children = rows.flatMap((row: Config, i: number) => bind(node.item ? [node.item] : [], { ...scoped, ...Object.fromEntries(Object.entries(row).map(([k, v]) => [`item.${k}`, v])) }, `${instance}/${node.id}:${i}`, depth + 1));
        children.push(...bind(node['after-items'] ?? [], scoped, instance, depth + 1));
        if (!children.length) children.push({ id: `${node.id}_empty`, type: 'text', text: '暂无预览数据', height: 27, padding: 9, _origin: node._origin, _key: `${node._key}/empty` });
        const grouped = ['layout', 'width', 'height', 'min-height', 'padding', 'skin'].some(k => node[k] !== undefined);
        return grouped ? [{ ...node, ...node.layout, type: node.layout?.type ?? 'column', children, _key: `${instance}/${node._key}` }] : children;
      }
      for (const [key, value] of Object.entries(node)) if (typeof value === 'string' && !['id', 'template', '_key', 'type'].includes(key)) node[key] = resolve(value);
      node._key = `${instance}/${original._key}`;
      node._variables = scoped;
      node._enabled = condition(node.enabled, resolve, scoped) && condition(node.requirements, resolve, scoped);
      if (node.children) node.children = bind(node.children, scoped, instance, depth + 1);
      if (node.type === 'viewport') {
        const motion = node.motion;
        let p = Math.max(0, time / 50 - Number(motion?.['delay-ticks'] ?? 0)) / Math.max(1, Number(motion?.['duration-ticks'] ?? 80));
        p = motion?.loop ? p % 1 : Math.min(1, p);
        p = motion?.easing === 'ease-in' ? p ** 3 : motion?.easing === 'ease-out' ? 1 - (1 - p) ** 3 : motion?.easing === 'ease-in-out' ? p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2 : p;
        node._position = motion ? Number(resolve(motion.from ?? 0)) + (Number(resolve(motion.to ?? 1)) - Number(resolve(motion.from ?? 0))) * p : Number(resolve(node.position ?? 0));
      }
      return [node];
    });
  }
  const elements = bind(menu.components ?? (menu.type ? [menu] : []), variablesCopy);
  const settings = menu.layout ?? { type: 'column', width: 540, gap: 9 };
  if (menu.renderer && menu.renderer !== 'canvas') issues.push({ level: 'info', file: active, message: '原生控件使用近似布局预览，最终尺寸与字体请在游戏中确认' });
  const result = layout(elements, settings, issues);
  const baseTheme = docs.get('assets/theme.yml')?.data ?? {}, extraTheme = docs.get(`assets/themes/${settings.theme}.yml`)?.data ?? {};
  const theme = merge(baseTheme, extraTheme), images: Record<string, string> = {};
  for (const [path, item] of docs) if (path === 'assets/images.yml' || path.startsWith('assets/images/')) for (const [id, source] of Object.entries(item.data.images ?? {}) as [string, Config][]) {
    const texture = source.file ? project.images.find(image => image.path === `assets/textures/${source.file}`) : null;
    if (texture) images[id] = texture.url;
  }
  for (const name of ['assets/themes/compact.yml']) if (active === name) issues.push({ level: 'info', file: active, message: '主题配置请在源码中编辑，然后打开使用该主题的菜单查看效果' });
  return { ...result, elements, theme, images, title: String(resolver(language, variablesCopy)(menu.title ?? documentId(file ?? { path: active, text: '', hash: null }))), issues };
}
