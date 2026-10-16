import bitmapGlyphs from './font-data/bitmap.json';
import { drawMinifiedGlyph, type PixelGlyph as Glyph } from './glyph-raster';

const bitmap = bitmapGlyphs as Record<string, Glyph>;
const unicode = new Map<number, string>(), glyphCache = new Map<string, Glyph>();
let loading: Promise<void> | undefined;

export function loadPixelFont() {
  return loading ??= import('./font-data/unifont-bmp.hex?raw').then(({ default: source }) => {
    for (const line of source.split('\n')) {
      const colon = line.indexOf(':');
      if (colon > 0) unicode.set(parseInt(line.slice(0, colon), 16), line.slice(colon + 1));
    }
  });
}

function glyphFor(char: string): Glyph | undefined {
  if (bitmap[char]) return bitmap[char];
  if (glyphCache.has(char)) return glyphCache.get(char);
  const code = char.codePointAt(0)!, hex = unicode.get(code);
  if (!hex) return;
  const digits = hex.length / 16, width = digits * 4;
  const rows = Array.from({ length: 16 }, (_, row) => parseInt(hex.slice(row * digits, (row + 1) * digits), 16));
  let left = width, right = -1;
  for (const row of rows) for (let x = 0; x < width; x++) if ((row >>> (width - x - 1)) & 1) { left = Math.min(left, x); right = Math.max(right, x); }
  if ([[0x3001,0x30ff],[0x3200,0x9fff],[0x1100,0x11ff],[0x3130,0x318f],[0xa960,0xa97f],[0xd7b0,0xd7ff],[0xf900,0xfaff],[0xff01,0xff5e]].some(([a,b]) => code >= a && code <= b)) { left = 0; right = 15; }
  if (code >= 0xac00 && code <= 0xd7af) { left = 1; right = 15; }
  const glyph = { rows, width, scale: .5, advance: right < left ? 4 : (right - left + 1) / 2 + 1, top: 0, left: Math.min(left, width - 1) };
  glyphCache.set(char, glyph); return glyph;
}

export function glyphAdvance(char: string, bold = false) {
  if (char === ' ') return 4;
  if (char === '\u200c') return 0;
  return (glyphFor(char)?.advance ?? (char.codePointAt(0)! > 255 ? 9 : 6)) + (bold ? 1 : 0);
}

export function drawGlyph(ctx: CanvasRenderingContext2D, char: string, x: number, y: number, color: string, bold: boolean) {
  if (char === ' ' || char === '\u200c') return;
  ctx.fillStyle = color;
  const glyph = glyphFor(char);
  if (!glyph) { ctx.font = `${bold ? 'bold ' : ''}9px "Microsoft YaHei", monospace`; ctx.textBaseline = 'top'; ctx.fillText(char, x, y); return; }
  const transform = ctx.getTransform();
  if (glyph.scale * Math.min(Math.abs(transform.a), Math.abs(transform.d)) < 1) {
    drawMinifiedGlyph(ctx, glyph, char, x, y, color, bold);
    return;
  }
  const snapX = (value: number) => Math.round(value * transform.a + transform.e) / transform.a - transform.e / transform.a;
  const snapY = (value: number) => Math.round(value * transform.d + transform.f) / transform.d - transform.f / transform.d;
  for (let row = 0; row < glyph.rows.length; row++) {
    let start = -1;
    for (let col = glyph.left; col <= glyph.width; col++) {
      const on = col < glyph.width && ((glyph.rows[row] >>> (glyph.width - col - 1)) & 1);
      if (on && start < 0) start = col;
      if (!on && start >= 0) {
        const left = snapX(x + (start - glyph.left) * glyph.scale), top = snapY(y + glyph.top + row * glyph.scale);
        const right = snapX(x + (col - glyph.left) * glyph.scale + (bold ? glyph.scale : 0)), bottom = snapY(y + glyph.top + (row + 1) * glyph.scale);
        ctx.fillRect(left, top, right - left, bottom - top);
        start = -1;
      }
    }
  }
}
