import { documentId, readYaml } from '../model/documents';
import type { Config, Project } from '../model/types';

export function indexProject(project: Project, locale: string) {
  const docs = new Map(project.files.map(file => [file.path, { file, data: readYaml(file).value }]));
  const templates = new Map([...docs.values()].filter(v => v.file.path.startsWith('templates/')).map(v => [v.file.path.replace(/^templates\//, '').replace(/\.ya?ml$/, ''), v]));
  const language: Record<string, unknown> = {};
  const flatten = (value: unknown, key: string) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) Object.entries(value).forEach(([k, v]) => flatten(v, key ? `${key}.${k}` : k));
    else language[key] = value;
  };
  for (const lang of [...['en_us', 'zh_cn'].filter(value => value !== locale), locale]) for (const [path, entry] of docs) {
    const prefix = `languages/${lang}/`;
    if (path.startsWith(prefix)) flatten(entry.data, path.slice(prefix.length).replace(/\.ya?ml$/, '').replaceAll('/', '.'));
  }
  return { docs, templates, language };
}
export function resolver(language: Record<string, unknown>, variables: Config) {
  return (input: unknown): any => {
    if (typeof input !== 'string') return input;
    let value = input;
    const seen = new Set<string>();
    for (let i = 0; i < 5 && !seen.has(value); i++) {
      seen.add(value);
      if (value.startsWith('@') && typeof language[value.slice(1)] === 'string') value = String(language[value.slice(1)]);
      const token = value.match(/^\{([^{}]+)\}$/);
      if (token && variables[token[1]] !== undefined && typeof variables[token[1]] !== 'string') return variables[token[1]];
      value = value.replace(/\{([^{}]+)\}/g, (full, key) => variables[key] === undefined ? full : String(variables[key]));
    }
    if (value.startsWith('@') && typeof language[value.slice(1)] === 'string' && !seen.has(String(language[value.slice(1)]))) value = String(language[value.slice(1)]);
    return value;
  };
}
export function condition(node: any, resolve: (input: unknown) => any, vars: Config): boolean {
  if (node === undefined || node === null) return true;
  if (typeof node === 'boolean') return node;
  const type = String(node.type ?? 'true');
  if (type.startsWith('!')) return !condition({ ...node, type: type.slice(1) }, resolve, vars);
  const a = resolve(node.input), b = resolve(node.output);
  switch (type) {
    case 'true': return true; case 'false': return false;
    case 'all': return (node.conditions ?? []).every((v: any) => condition(v, resolve, vars));
    case 'any': return (node.conditions ?? []).some((v: any) => condition(v, resolve, vars));
    case 'not': return !condition(node.condition, resolve, vars);
    case 'equals': case 'string-equals': case '==': return String(a) === String(b);
    case 'equals-ignore-case': return String(a).toLowerCase() === String(b).toLowerCase();
    case '!=': return String(a) !== String(b);
    case '>': return Number(a) > Number(b); case '>=': return Number(a) >= Number(b);
    case '<': return Number(a) < Number(b); case '<=': return Number(a) <= Number(b);
    case 'contains': return String(a).includes(String(b));
    case 'starts-with': return String(a).startsWith(String(b)); case 'ends-with': return String(a).endsWith(String(b));
    case 'exists': return a !== undefined && a !== null && !String(a).includes('{');
    case 'list-contains': { const list = resolve(node.list); return Array.isArray(list) && list.map(String).includes(String(resolve(node.value))); }
    case 'plugin': return vars[`plugin.${node.plugin}`] === true;
    case 'permission': case 'has-permission': return vars[`permission.${node.permission}`] === true;
    case 'data': return node.value === undefined ? vars[`data.${node.key}`] !== undefined : String(vars[`data.${node.key}`]) === String(resolve(node.value));
    case 'in': return (node.values ?? []).map((v: any) => String(resolve(v))).includes(String(a));
    default: return vars[`condition.${type}`] === true;
  }
}
export function shopRows(source: Config, docs: ReturnType<typeof indexProject>['docs'], variables: Config, language: Record<string, unknown>, locale: string): Config[] | null {
  const shopId = String(source.shop ?? 'system'), shop = [...docs.values()].find(v => v.file.path.startsWith('shops/') && (v.data.id ?? v.file.path.slice(6, -4)) === shopId)?.data;
  if (!shop) return null;
  const selected = variables.category, active = Array.isArray(selected) ? selected.map(String) : selected ? [String(selected)] : [];
  if (source.source === 'shop-categories') return (shop.categories ?? []).map((c: Config) => ({ ...c, selected: active.includes(c.id), icon: String(c.icon ?? '').toLowerCase() }));
  if (source.source !== 'shop-products') return null;
  const resolve = resolver(language, variables);
  return (shop.products ?? []).filter((p: Config) => !active.length || active.includes(p.category)).map((p: Config) => {
    const quantity = Number(variables[`quantity.${shopId}.${p.id}`] ?? p.quantity?.initial ?? 1);
    return { ...p, shop: shopId, name: resolve(p.name), icon: p.item?.icon ?? String(p.item?.material ?? 'paper').toLowerCase(), amount: p.amount ?? 1,
      quantity, initial: p.quantity?.initial ?? 1, minimum: p.quantity?.min ?? 1, maximum: p.quantity?.max ?? 64, step: p.quantity?.step ?? 1, decrement: -(p.quantity?.step ?? 1),
      'quantity-key': `quantity.${shopId}.${p.id}`, total: Number(p.price) * quantity, items: Number(p.amount ?? 1) * quantity, 'total-items':Number(p.amount??1)*quantity, currency: p.currency === 'vault' ? (language['currencies.vault'] ?? (locale.startsWith('zh') ? '金币' : 'Coins')) : p.currency, available: Number(variables.balance ?? 1280) >= Number(p.price) * quantity };
  });
}
