import type { Layer, Point, SelectionMask, SelectionState } from "./types";

export function createEmptyMask(width: number, height: number): SelectionMask {
  return { width, height, data: new Uint8Array(width * height) };
}

export function maskFromRect(
  width: number,
  height: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): SelectionMask {
  const mask = createEmptyMask(width, height);
  const left = Math.max(0, Math.min(x1, x2));
  const right = Math.min(width - 1, Math.max(x1, x2));
  const top = Math.max(0, Math.min(y1, y2));
  const bottom = Math.min(height - 1, Math.max(y1, y2));
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      mask.data[y * width + x] = 255;
    }
  }
  return mask;
}

export function maskFromPolygon(width: number, height: number, points: Point[]): SelectionMask {
  const mask = createEmptyMask(width, height);
  if (points.length < 3) return mask;
  const xs = points.map((p) => p.x);
  const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p.y))));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map((p) => p.y))));
  for (let y = minY; y <= maxY; y++) {
    const intersections: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const x = a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x);
        intersections.push(x);
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2) {
      if (i + 1 >= intersections.length) break;
      const x1 = Math.max(0, Math.ceil(intersections[i]));
      const x2 = Math.min(width - 1, Math.floor(intersections[i + 1]));
      for (let x = x1; x <= x2; x++) mask.data[y * width + x] = 255;
    }
  }
  return mask;
}

export function maskFromAutoSelect(
  composite: HTMLCanvasElement,
  x: number,
  y: number,
  tolerance = 32,
): SelectionMask {
  const w = composite.width;
  const h = composite.height;
  const mask = createEmptyMask(w, h);
  const ctx = composite.getContext("2d", { willReadFrequently: true });
  if (!ctx) return mask;
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= w || py >= h) return mask;

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const si = (py * w + px) * 4;
  const sr = d[si];
  const sg = d[si + 1];
  const sb = d[si + 2];
  const sa = d[si + 3];

  const stack = [px, py];
  const visited = new Uint8Array(w * h);

  function matches(i: number): boolean {
    const ri = i * 4;
    if (Math.abs(d[ri + 3] - sa) > tolerance) return false;
    if (sa < 8 && d[ri + 3] < 8) return true;
    return (
      Math.abs(d[ri] - sr) <= tolerance &&
      Math.abs(d[ri + 1] - sg) <= tolerance &&
      Math.abs(d[ri + 2] - sb) <= tolerance
    );
  }

  while (stack.length) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
    const idx = cy * w + cx;
    if (visited[idx]) continue;
    if (!matches(idx)) continue;
    visited[idx] = 1;
    mask.data[idx] = 255;
    stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1);
  }
  return mask;
}

export function selectionBounds(mask: SelectionMask): SelectionState["bounds"] {
  let minX = mask.width;
  let minY = mask.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < mask.height; y++) {
    for (let x = 0; x < mask.width; x++) {
      if (mask.data[y * mask.width + x]) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function combineSelection(a: SelectionMask, b: SelectionMask, add = true): SelectionMask {
  const out = createEmptyMask(a.width, a.height);
  for (let i = 0; i < out.data.length; i++) {
    out.data[i] = add
      ? a.data[i] || b.data[i]
        ? 255
        : 0
      : a.data[i] && !b.data[i]
        ? 255
        : 0;
  }
  return out;
}

export function applyMaskToLayer(layer: Layer, mask: SelectionMask, invert = false) {
  const ctx = layer.canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  for (let i = 0; i < mask.data.length; i++) {
    const selected = mask.data[i] > 0;
    if (invert ? selected : !selected) {
      const o = i * 4;
      img.data[o + 3] = 0;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function drawSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  mask: SelectionMask,
  zoom: number,
) {
  const w = mask.width;
  const h = mask.height;
  const overlay = ctx.createImageData(w, h);
  for (let i = 0; i < mask.data.length; i++) {
    if (!mask.data[i]) continue;
    const o = i * 4;
    overlay.data[o] = 0;
    overlay.data[o + 1] = 122;
    overlay.data[o + 2] = 255;
    overlay.data[o + 3] = 40;
  }
  ctx.save();
  ctx.putImageData(overlay, 0, 0);
  const bounds = selectionBounds(mask);
  if (bounds) {
    ctx.strokeStyle = "#007aff";
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([4 / zoom, 3 / zoom]);
    ctx.strokeRect(bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.setLineDash([]);
  }
  ctx.restore();
}
