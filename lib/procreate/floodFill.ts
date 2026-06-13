import type { Layer } from "./types";
import { hexToRgb } from "./colorUtils";
import { compositeLayers } from "./canvasEngine";

export type FloodFillResult = {
  filled: boolean;
  pixelCount: number;
};

function toleranceFromThreshold(threshold: number): number {
  return Math.round(4 + threshold * 116);
}

function matchesPixel(
  data: Uint8ClampedArray,
  idx: number,
  sr: number,
  sg: number,
  sb: number,
  sa: number,
  tol: number,
): boolean {
  const a = data[idx + 3];
  if (Math.abs(a - sa) > tol) return false;
  if (sa < 8 && a < 8) return true;
  return (
    Math.abs(data[idx] - sr) <= tol &&
    Math.abs(data[idx + 1] - sg) <= tol &&
    Math.abs(data[idx + 2] - sb) <= tol
  );
}

/** Flood fill on the active layer, using a reference canvas for edge detection. */
export function floodFillAt(
  layer: Layer,
  x: number,
  y: number,
  fillHex: string,
  referenceCanvas: HTMLCanvasElement,
  threshold: number,
): FloodFillResult {
  const ctx = layer.canvas.getContext("2d", { willReadFrequently: true });
  const refCtx = referenceCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx || !refCtx) return { filled: false, pixelCount: 0 };

  const w = layer.canvas.width;
  const h = layer.canvas.height;
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= w || py >= h) return { filled: false, pixelCount: 0 };

  const refData = refCtx.getImageData(0, 0, w, h);
  const layerData = ctx.getImageData(0, 0, w, h);
  const ref = refData.data;
  const out = layerData.data;
  const tol = toleranceFromThreshold(threshold);

  const seedIdx = (py * w + px) * 4;
  const sr = ref[seedIdx];
  const sg = ref[seedIdx + 1];
  const sb = ref[seedIdx + 2];
  const sa = ref[seedIdx + 3];

  const { r: fr, g: fg, b: fb } = hexToRgb(fillHex);

  if (
    matchesPixel(out, seedIdx, fr, fg, fb, 255, 0) &&
    matchesPixel(ref, seedIdx, sr, sg, sb, sa, tol)
  ) {
    return { filled: false, pixelCount: 0 };
  }

  const visited = new Uint8Array(w * h);
  const stack: number[] = [px, py];
  let pixelCount = 0;

  function matchesAt(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= w || cy >= h) return false;
    const i = cy * w + cx;
    if (visited[i]) return false;
    return matchesPixel(ref, i * 4, sr, sg, sb, sa, tol);
  }

  while (stack.length > 0) {
    const cy = stack.pop()!;
    const cx = stack.pop()!;
    if (!matchesAt(cx, cy)) continue;

    let xl = cx;
    while (xl >= 0 && matchesAt(xl, cy)) xl--;
    xl++;

    let xr = cx;
    while (xr < w && matchesAt(xr, cy)) xr++;
    xr--;

    for (let x = xl; x <= xr; x++) {
      const i = cy * w + x;
      visited[i] = 1;
      const o = i * 4;
      out[o] = fr;
      out[o + 1] = fg;
      out[o + 2] = fb;
      out[o + 3] = 255;
      pixelCount++;
    }

    for (let x = xl; x <= xr; x++) {
      if (cy > 0 && matchesAt(x, cy - 1)) stack.push(x, cy - 1);
      if (cy < h - 1 && matchesAt(x, cy + 1)) stack.push(x, cy + 1);
    }
  }

  if (pixelCount === 0) return { filled: false, pixelCount: 0 };
  ctx.putImageData(layerData, 0, 0);
  return { filled: true, pixelCount };
}

/** Composite for ColorDrop boundary detection. */
export function buildFillReference(
  layers: Layer[],
  width: number,
  height: number,
  backgroundColor: string,
  referenceAllLayers: boolean,
  activeLayerId: string,
): HTMLCanvasElement {
  if (referenceAllLayers) {
    return compositeLayers(layers, width, height, backgroundColor);
  }
  const active = layers.find((l) => l.id === activeLayerId);
  if (!active) {
    return compositeLayers([], width, height, backgroundColor);
  }
  return compositeLayers([active], width, height, backgroundColor);
}

/** Map drag distance (px) to a Procreate-style threshold (roughly 0–0.45). */
export function thresholdFromDragDistance(distance: number, base: number): number {
  return Math.min(0.5, Math.max(0.02, base + distance * 0.0018));
}

/** Visual radius on canvas for the ColorDrop threshold preview. */
export function thresholdPreviewRadius(threshold: number, canvasWidth: number): number {
  return Math.max(12, threshold * canvasWidth * 0.12);
}
