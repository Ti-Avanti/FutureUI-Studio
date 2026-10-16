export interface PixelGlyph { rows: number[]; width: number; scale: number; advance: number; top: number; left: number }
const masks = new Map<string, OffscreenCanvas>();

// A 16-row glyph cannot be snapped to fewer than 16 device rows without losing strokes.
// Rasterize its full mask first and filter it when the view is smaller than one pixel per bit.
export function drawMinifiedGlyph(ctx: CanvasRenderingContext2D, glyph: PixelGlyph, char: string, x: number, y: number, color: string, bold: boolean) {
  const key = `${char}:${color}:${bold}`;
  let mask = masks.get(key);
  if (!mask) {
    mask = new OffscreenCanvas(Math.max(1, glyph.width - glyph.left + (bold ? 1 : 0)), glyph.rows.length);
    const target = mask.getContext('2d')!;
    target.fillStyle = color;
    for (let row = 0; row < glyph.rows.length; row++) {
      for (let col = glyph.left; col < glyph.width; col++) {
        if ((glyph.rows[row] >>> (glyph.width - col - 1)) & 1) target.fillRect(col - glyph.left, row, bold ? 2 : 1, 1);
      }
    }
    if (masks.size >= 768) masks.delete(masks.keys().next().value!);
    masks.set(key, mask);
  }
  const smoothing = ctx.imageSmoothingEnabled, quality = ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mask, x, y + glyph.top, mask.width * glyph.scale, mask.height * glyph.scale);
  ctx.imageSmoothingEnabled = smoothing;
  ctx.imageSmoothingQuality = quality;
}
