import { tr, useInterfaceLanguage } from '../i18n';
import { useMemo, useState } from 'react';
import { Search, Folder, ChevronRight, FileCode2, PanelTop, Braces } from 'lucide-react';
import { useStudio } from '../state/store';
import { shortName, readYaml } from '../model/documents';
import type { Config, Origin } from '../model/types';
import { useAgent } from '../agent/store';


export function Explorer() {
  const interfaceLanguage = useInterfaceLanguage(s => s.language);
  const names: Record<string, string> = { shop: tr("系统商店"), main: tr("玩家中心"), purchase: tr("购买确认"), quantity: tr("数量选择"), receipt: tr("购买结果"), settings: tr("个人设置"), search: tr("搜索商品"), wallet: tr("我的钱包"), language: tr("界面语言"), preferences: tr("偏好设置"), display: tr("显示设置"), services: tr("服务大厅"), profile: tr("玩家资料"), cart: tr("购物车"), recycle: tr("物品回收") };

  const { project, active, openFile, saved } = useStudio();
  const [query, setQuery] = useState(''), [scope, setScope] = useState('menus'), [expanded, setExpanded] = useState<Set<string>>(new Set(['menus/compact']));
  const groups = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const file of project?.files ?? []) {
      if (scope !== 'all' && !file.path.startsWith(`${scope}/`)) continue;
      if (!`${file.path} ${names[shortName(file.path)] ?? ''}`.toLowerCase().includes(query.toLowerCase())) continue;
      const key = file.path.split('/').slice(0, -1).join('/') || tr("工程"); map.set(key, [...(map.get(key) ?? []), file.path]);
    }
    return [...map.entries()].sort((a, b) => (a[0].includes('compact') ? -1 : b[0].includes('compact') ? 1 : a[0].localeCompare(b[0])));
  }, [project, query, scope, interfaceLanguage]);
  return <div className="explorer pane-scroll"><div className="project-heading"><img className="project-monogram-image" src="./studio-icon.png" alt=""/><div><strong>{project?.name ?? tr("未打开工程")}</strong><span>{tr("FutureUI 配置工程")}</span></div><span className="tiny-tag">1.0</span></div><div className="search-field"><Search size={14}/><input aria-label={tr("搜索工程文件")} placeholder={tr("搜索菜单、模板…")} value={query} onChange={e => setQuery(e.target.value)}/><kbd>⌕</kbd></div><div className="segment-tabs">{[['menus',tr("菜单")],['templates',tr("模板")],['all',tr("全部文件")]].map(([key,label]) => <button key={key} className={scope === key ? 'active' : ''} onClick={() => setScope(key)}>{label}</button>)}</div><div className="file-groups">{groups.map(([folder, files]) => <div key={folder}><button className="folder-row" onClick={() => setExpanded(s => { const n = new Set(s); n.has(folder) ? n.delete(folder) : n.add(folder); return n; })}><ChevronRight size={12} className={expanded.has(folder) || query ? 'expanded' : ''}/><Folder size={13}/><span>{folder.replace(/^menus\//,'')}</span><small>{files.length}</small></button>{(expanded.has(folder) || query) && files.map(path => <button title={tr("{0} · 右键发送给 Agent", path)} key={path} draggable onDragStart={e=>e.dataTransfer.setData('application/futureui-file',JSON.stringify({id:`file:${path}`,kind:'file',name:shortName(path)+'.yml',path}))} onContextMenu={e=>{e.preventDefault();useAgent.getState().compose(undefined,{id:`file:${path}`,kind:'file',name:shortName(path)+'.yml',path});}} className={`file-row ${active === path ? 'selected' : ''}`} onClick={() => openFile(path)}>{path.startsWith('menus/') ? <PanelTop size={13}/> : <FileCode2 size={13}/>}<span>{names[shortName(path)] ?? shortName(path)}</span><small>{saved[path] !== project?.files.find(f => f.path === path)?.text ? '●' : shortName(path)}</small></button>)}</div>)}</div><div className="pane-footnote">{project?.files.filter(f => f.path.startsWith('menus/')).length ?? 0}{tr(" 个菜单 · 配置与视图同步")}</div></div>;
}

export function Layers() {
  useInterfaceLanguage();
  const typeNames: Record<string, string> = { row:tr("横向布局"),column:tr("纵向布局"),grid:tr("网格"),list:tr("数据列表"),text:tr("文字"),image:tr("图片"),button:tr("按钮"),spacer:tr("间距"),toggle:tr("开关"),canvas:tr("画布"),viewport:tr("滚动视口"),progress:tr("进度条"),chart:tr("图表") };

  const { project, active, selected, set, move } = useStudio();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const data = readYaml(project?.files.find(f => f.path === active)).value;
  function rows(nodes: Config[], parent: (string | number)[], depth: number, root = false): React.ReactNode {
    return nodes.map((node, i) => {
      const path = root ? [] : [...parent, i], key = JSON.stringify(path), origin: Origin = { file: active, path }, chosen = selected?.file === active && JSON.stringify(selected.path) === key;
      return <div key={key}><div draggable={!root} className={`layer-row ${chosen ? 'selected' : ''}`} style={{ paddingLeft: 10 + depth * 14 }} onClick={() => set({ selected: origin })} onDragStart={e => e.dataTransfer.setData('application/futureui-node', JSON.stringify(origin))} onDragOver={e => { if (e.dataTransfer.types.includes('application/futureui-node')) e.preventDefault(); }} onDrop={e => { e.preventDefault(); e.stopPropagation(); const raw = e.dataTransfer.getData('application/futureui-node'); if (raw) move(JSON.parse(raw), { file: active, path: parent }, i); }}><button className="tree-caret" onClick={e => { e.stopPropagation(); setCollapsed(s => { const next = new Set(s); next.has(key) ? next.delete(key) : next.add(key); return next; }); }}>{node.children ? <ChevronRight size={11} className={!collapsed.has(key) ? 'expanded' : ''}/> : <span/>}</button>{node.template ? <Braces size={13}/> : <span className="node-symbol">{node.type === 'text' ? 'T' : node.type === 'image' ? '▧' : node.type === 'button' ? '▭' : '▥'}</span>}<span>{node.id ?? node.template}</span><small>{node.template ? tr("模板") : typeNames[node.type] ?? node.type}</small></div>{node.children && !collapsed.has(key) && rows(node.children, [...path,'children'], depth + 1)}{node.item && !collapsed.has(key) && <div className="layer-template" style={{ paddingLeft: 36 + depth * 14 }}><Braces size={11}/>{node.item.template ?? tr("列表条目模板")}</div>}</div>;
    });
  }
  return <div className="pane-scroll"><div className="layer-heading"><span>{shortName(active)}</span><small>{tr("拖动调整顺序")}</small></div>{rows(data.components ?? (data.type ? [data] : []), data.components ? ['components'] : [], 0, !data.components)}<div className="pane-footnote">{tr("点击画布可定位共享模板中的组件")}</div></div>;
}
