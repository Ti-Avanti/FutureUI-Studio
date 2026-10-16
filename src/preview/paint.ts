import type { Box, Config, Preview } from '../model/types';
import { textSegments, plain } from './text';
import { drawGlyph, glyphAdvance } from './pixel-font';
const cache = new Map<string, HTMLImageElement>();
export function bitmap(url: string, repaint: () => void) {
  if (!cache.has(url)) { const image = new Image(); image.onload = repaint; image.src = url; cache.set(url, image); }
  return cache.get(url)!;
}
export function skinFor(theme: Config, name: string) { const key = theme['skin-aliases']?.[name] ?? name; return theme.canvas?.styles?.[key] ?? {}; }
export function drawSkin(ctx: CanvasRenderingContext2D, box: Box, style: Config) {
  if (!style.fill && !style.outline) return;
  const { x, y, width: w, height: h } = box;
  ctx.fillStyle = style.outline ?? '#292b2e'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = style.fill ?? '#535759'; ctx.fillRect(x + 1, y + 1, Math.max(0, w - 2), Math.max(0, h - 2));
  if (style.bevel !== false) {
    ctx.fillStyle = style.light ?? '#818785'; ctx.fillRect(x + 1, y + 1, w - 2, 1); ctx.fillRect(x + 1, y + 1, 1, h - 2);
    ctx.fillStyle = style.shadow ?? '#303437'; ctx.fillRect(x + 1, y + h - 2, w - 2, 1); ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
  }
}
function drawText(ctx: CanvasRenderingContext2D, box: Box, input: unknown, color?: string) {
  const padding = Number(box.node.padding ?? 0), max = box.width - 2 * padding;
  if (max <= 0) return;
  const glyphs = textSegments(input).flatMap(s => [...s.text].map(text => ({ ...s, text })));
  const lines: { glyphs: typeof glyphs; width: number }[] = [{ glyphs: [], width: 0 }];
  for (const g of glyphs) {
    const size = glyphAdvance(g.text, g.bold), row = lines.at(-1)!;
    if (g.text === '\n') { lines.push({ glyphs: [], width: 0 }); continue; }
    if (row.width + size > max && row.glyphs.length) lines.push({ glyphs: [], width: 0 });
    lines.at(-1)!.glyphs.push(g); lines.at(-1)!.width += size;
  }
  const rows = lines.slice(0, Math.max(1, Math.floor((box.height - padding * 2) / 9)));
  const extra = box.height - padding * 2 - rows.length * 9, align = box.node['text-align'] ?? (box.node.type === 'button' ? 'center' : 'start');
  let y = box.y + padding + (box.node['vertical-align'] === 'end' ? extra : box.node['vertical-align'] === 'center' || box.node.type === 'button' ? Math.floor(Math.max(0, extra) / 18) * 9 : 0);
  ctx.textBaseline = 'top';
  for (const row of rows) {
    let x = box.x + padding + (align === 'center' ? Math.floor((max - row.width) / 2) : align === 'end' ? max - row.width : 0);
    for (const g of row.glyphs) { drawGlyph(ctx, g.text, x, y, color ?? g.color, g.bold); x += glyphAdvance(g.text, g.bold); }
    y += 9;
  }
}
export function paint(ctx: CanvasRenderingContext2D, preview: Preview, hovered: string | null, state: string, repaint: () => void) {
  ctx.clearRect(0, 0, preview.width, preview.height); ctx.imageSmoothingEnabled = false;
  for (const box of preview.boxes) {
    if (box.width <= 0 || box.height <= 0) continue;
    ctx.save();
    if (box.clip) { ctx.beginPath(); ctx.rect(box.clip.x, box.clip.y, box.clip.width, box.clip.height); ctx.clip(); }
    ctx.beginPath(); ctx.rect(box.x, box.y, box.width, box.height); ctx.clip();
    const n = box.node, button = ['button', 'toggle'].includes(n.type), disabled = n._enabled === false || button && state === 'disabled';
    const name = disabled ? n['disabled-skin'] ?? 'readout' : button && state === 'selected' ? 'selected' : n.skin ?? (button ? 'button' : '');
    let style = skinFor(preview.theme, name);
    if (button && !disabled && (hovered === box.key || state === 'hover') && style.hover) style = { ...style, ...style.hover, light: style.hover.outline };
    drawSkin(ctx, box, style);
    if (n.type === 'image' || n['background-image']) {
      const id = String(n.image ?? n['background-image']), url = preview.images[id] ?? preview.images[n['fallback-image']];
      if (url) { const image = bitmap(url, repaint); if (image.complete && image.naturalWidth) { const size = Math.min(Number(n.size ?? n['background-size'] ?? 72), box.height, box.width); const w = Math.min(size * image.width / image.height, box.width), h = w * image.height / image.width; ctx.drawImage(image, Math.round(box.x + (box.width - w) / 2), Math.round(box.y + (box.height - h) / 2), w, h); } }
      else { ctx.strokeStyle = '#717b7d'; ctx.setLineDash([3, 3]); ctx.strokeRect(box.x + 4, box.y + 4, box.width - 8, box.height - 8); drawText(ctx, { ...box, node: { ...n, padding: 9, 'vertical-align': 'center', 'text-align': 'center' } }, id || '图片'); }
    }
    if (['text', 'button', 'toggle'].includes(n.type)) drawText(ctx, box, n.text, disabled ? '#8d9392' : undefined);
    if (n.type === 'progress') { drawSkin(ctx, box, skinFor(preview.theme, n['track-skin'] ?? 'readout')); const width = Math.round(box.width * Math.min(1, Math.max(0, Number(n.value) || 0))); drawSkin(ctx, { ...box, width }, skinFor(preview.theme, n['fill-skin'] ?? 'selected')); }
    if (n.type === 'raster') { drawText(ctx, { ...box, node: { ...n, padding: 9, 'text-align': 'center', 'vertical-align': 'center' } }, n['empty-text'] ?? '动态图片 · 需要提供器数据'); }
    if (n.type === 'chart') {
      const values = (n.series ?? n.data ?? []).map((v: any) => ({ label: plain(v.label ?? v.name ?? ''), value: Number(v.value) || 0 }));
      if (!values.length) drawText(ctx, { ...box, node: { ...n, padding: 9 } }, '图表 · 请绑定数据');
      const max = Math.max(1, ...values.map((v: any) => v.value));
      values.forEach((v: any, i: number) => { const y = box.y + 9 + i * 36; drawText(ctx, { ...box, y, height: 18, node: { ...n, padding: 0 } }, `${v.label}  ${v.value}`); ctx.fillStyle = '#648e41'; ctx.fillRect(box.x, y + 18, box.width * v.value / max, 9); });
    }
    if (['text-input', 'number-input', 'slider', 'checkbox', 'select', 'multi-select'].includes(n.type)) {
      drawText(ctx, { ...box, height: 9, node: { ...n, padding: 0 } }, n.label ?? n.id);
      const field = { ...box, y: box.y + 12, height: 21 };
      drawSkin(ctx, field, { fill: '#202522', outline: '#8e9793', bevel: false });
      drawText(ctx, { ...field, node: { ...n, padding: 4 } }, String(n.initial ?? n.value ?? ''));
    }
    ctx.restore();
  }
}
