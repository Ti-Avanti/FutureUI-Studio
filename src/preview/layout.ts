import { tr } from '../i18n';
import type { Box, Config, Element, Issue } from '../model/types';

const integer = (value: unknown, fallback: number) => Number.isFinite(Number(value)) && value !== undefined ? Math.floor(Number(value)) : fallback;
const naturalHeight = (node: Element) => {
  switch (node.type) {
    case 'button': case 'toggle': return 27;
    case 'image': return integer(node.size, 72);
    case 'chart': case 'raster': return 108;
    case 'text': return 9 + integer(node.padding, 0) * 2;
    case 'text-input': case 'number-input': case 'slider': case 'checkbox': case 'select': case 'multi-select': return 36;
    default: return 9;
  }
};
export function layout(elements: Element[], settings: Config, issues: Issue[]) {
  const boxes: Box[] = [], width = Math.max(18, integer(settings.width, 576));
  const report = (node: Element, message: string) => issues.push({ level: 'error', file: node._origin.file, path: node._origin.path, message });
  const shift = (list: Box[], extra: number, align: string) => { const amount = align === 'center' ? Math.floor(extra / 18) * 9 : align === 'end' ? extra : 0; list.forEach(b => b.y += amount); };
  function place(nodes: Element[], config: Config, x: number, y: number, available: number, output: Box[], depth: number): number {
    if (depth > 20) return 9;
    const padding = integer(config.padding, 0), gap = integer(config.gap, 9), inner = available - padding * 2, mode = config.type ?? 'column';
    const columns = mode === 'row' ? Math.max(1, nodes.length) : mode === 'grid' ? Math.max(1, integer(config.columns, 2)) : 1;
    const cell = Math.floor((inner - gap * (columns - 1)) / columns);
    const fixed = nodes.filter(n => n.width !== undefined).reduce((sum, n) => sum + integer(n.width, 0), 0), auto = nodes.filter(n => n.width === undefined).length;
    const remaining = inner - gap * Math.max(0, nodes.length - 1) - fixed;
    if (mode === 'row' && remaining < 0 && nodes[0]) report(nodes[0], tr("横向容器内容超出可用宽度"));
    let rowHeight = 0, rowY = y + padding, cursor = x + padding;
    nodes.forEach((node, i) => {
      if (i % columns === 0 && i > 0) { rowY += rowHeight + gap; rowHeight = 0; cursor = x + padding; }
      const rawWidth = mode === 'row' ? node.width === undefined ? Math.floor(remaining / Math.max(1, auto)) : integer(node.width, 0) : Math.min(mode === 'grid' ? cell : inner, integer(node.width, mode === 'grid' ? cell : inner));
      const w = Math.max(9, rawWidth);
      let bx = mode === 'grid' ? x + padding + i % columns * (cell + gap) : cursor;
      const slot = mode === 'grid' ? cell : mode === 'column' ? inner : w;
      if (node.align === 'center') bx += Math.floor((slot - w) / 2); if (node.align === 'end') bx += slot - w;
      const childBoxes: Box[] = [];
      const intrinsic = node.type === 'viewport' ? integer(node.height, 99) : node.children ? place(node.children, node.type === 'canvas' ? { ...node.layout, type: node.layout?.type ?? 'column' } : node, bx, rowY, w, childBoxes, depth + 1) : naturalHeight(node);
      const h = Math.max(integer(node['min-height'], 0), integer(node.height, intrinsic));
      if (h < intrinsic && node.children && node.type !== 'viewport') report(node, tr("{0} 的高度 {1} 小于内容高度 {2}", node.id, h, intrinsic));
      if (h > intrinsic) shift(childBoxes, h - intrinsic, node['vertical-align'] ?? 'start');
      for (const key of ['height', 'padding', 'gap', 'min-height']) if (node[key] !== undefined && Number.isFinite(Number(node[key])) && Number(node[key]) % 9 !== 0) report(node, tr("{0}.{1} 应为 9 的倍数", node.id, key));
      const box = { key: node._key, x: bx, y: rowY, width: w, height: Math.max(0, h), node, depth };
      output.push(box, ...childBoxes);
      if (node.type === 'viewport' && node.children) {
        const children: Box[] = [];
        place(node.children, { type: 'row', gap: node['item-gap'] ?? 9 }, bx - Number(node._position ?? 0) * (Number(node['item-width'] ?? 72) + Number(node['item-gap'] ?? 9)), rowY, Math.max(w, node.children.length * (Number(node['item-width'] ?? 72) + 9)), children, depth + 1);
        children.forEach(b => { b.clip = { x: bx, y: rowY, width: w, height: h }; }); output.push(...children);
      }
      rowHeight = Math.max(rowHeight, h); cursor += w + gap;
    });
    return Math.max(integer(config['min-height'], 0), nodes.length ? rowY - y + rowHeight + padding : padding * 2);
  }
  const intrinsic = place(elements, settings, 0, 0, width, boxes, 0), height = Math.max(9, integer(settings.height, intrinsic));
  if (height > intrinsic) shift(boxes, height - intrinsic, settings['vertical-align'] ?? 'start');
  return { boxes, width, height };
}
