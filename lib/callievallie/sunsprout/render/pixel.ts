// Tiny pixel-art drawing helpers. All coordinates are snapped to integers
// so canvas rasterisation produces crisp blocky pixels. We avoid sub-pixel
// fills entirely — even radii and dimensions are floored before use.

export function drawPixelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iw = Math.max(0, Math.floor(w));
  const ih = Math.max(0, Math.floor(h));
  if (iw === 0 || ih === 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(ix, iy, iw, ih);
}

/**
 * Outline-only rectangle, useful for tile-debug borders and crop outlines.
 * Width is always 1 device pixel.
 */
export function drawPixelStroke(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iw = Math.max(0, Math.floor(w));
  const ih = Math.max(0, Math.floor(h));
  if (iw === 0 || ih === 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(ix, iy, iw, 1);
  ctx.fillRect(ix, iy + ih - 1, iw, 1);
  ctx.fillRect(ix, iy, 1, ih);
  ctx.fillRect(ix + iw - 1, iy, 1, ih);
}

/**
 * Draw pixel-perfect text. We use an 8px monospace font and snap baseline
 * to integer Y so glyph strokes don't blur across rows.
 */
export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
): void {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  ctx.save();
  ctx.font = '8px monospace';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = color;
  ctx.fillText(text, ix, iy);
  ctx.restore();
}

/**
 * Soft elliptical shadow centred under an entity. `w` is the maximum
 * shadow width in pixels; the shadow has a fixed low alpha so it reads
 * as ambient occlusion rather than a hard drop shadow.
 */
export function drawShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
): void {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const rx = Math.max(1, Math.floor(w / 2));
  const ry = Math.max(1, Math.floor(w / 5));
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Filled pixel circle (used for the well and crop bodies). */
export function drawPixelCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
): void {
  const icx = Math.floor(cx);
  const icy = Math.floor(cy);
  const ir = Math.max(1, Math.floor(r));
  ctx.fillStyle = color;
  for (let dy = -ir; dy <= ir; dy++) {
    for (let dx = -ir; dx <= ir; dx++) {
      if (dx * dx + dy * dy <= ir * ir) {
        ctx.fillRect(icx + dx, icy + dy, 1, 1);
      }
    }
  }
}

/**
 * Blend two hex colours (#rrggbb) by t in [0,1]. Used by the renderer to
 * compute the day/night tint dynamically without per-frame string math.
 */
export function lerpHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, '0')}${g
    .toString(16)
    .padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}
