import type { Layer, SelectionMask } from "./types";
import { hexToRgb } from "./colorUtils";
import { createEmptyMask } from "./selection";
import { createLayerCanvas } from "./storage";

/** New masks start fully white (layer fully visible). */
export function createLayerMaskCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = createLayerCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }
  return canvas;
}

export function drawLayerWithMask(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  width: number,
  height: number,
) {
  if (!layer.maskCanvas) {
    ctx.drawImage(layer.canvas, 0, 0);
    return;
  }

  const temp = document.createElement("canvas");
  temp.width = width;
  temp.height = height;
  const tctx = temp.getContext("2d");
  if (!tctx) return;

  tctx.drawImage(layer.canvas, 0, 0);
  tctx.globalCompositeOperation = "destination-in";
  tctx.drawImage(layer.maskCanvas, 0, 0);
  ctx.drawImage(temp, 0, 0);
}

export function maskFromLayerContents(layer: Layer): SelectionMask {
  const w = layer.canvas.width;
  const h = layer.canvas.height;
  const mask = createEmptyMask(w, h);
  const ctx = layer.canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return mask;

  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < w * h; i++) {
    if (img.data[i * 4 + 3] > 8) mask.data[i] = 255;
  }
  return mask;
}

export function fillLayerWithColor(layer: Layer, color: string, respectAlphaLock: boolean) {
  const ctx = layer.canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  const { r, g, b } = hexToRgb(color);
  if (!respectAlphaLock) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
    ctx.restore();
    return;
  }

  const img = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] > 8) {
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function invertLayerColors(layer: Layer) {
  const ctx = layer.canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const img = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] === 0) continue;
    img.data[i] = 255 - img.data[i];
    img.data[i + 1] = 255 - img.data[i + 1];
    img.data[i + 2] = 255 - img.data[i + 2];
  }
  ctx.putImageData(img, 0, 0);
}

export function clearLayerContents(layer: Layer) {
  const ctx = layer.canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
}

export async function copyLayerToClipboard(layer: Layer): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.write) return false;
  try {
    const blob = await new Promise<Blob | null>((resolve) =>
      layer.canvas.toBlob((b) => resolve(b), "image/png"),
    );
    if (!blob) return false;
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}

/** Paint/erase on mask: white reveals, black hides. */
export function maskStrokeColor(tool: "paint" | "erase" | "smudge"): string {
  return tool === "erase" ? "#000000" : "#ffffff";
}

export function bakeLayerMask(layer: Layer) {
  if (!layer.maskCanvas) return;
  const ctx = layer.canvas.getContext("2d");
  if (!ctx) return;
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(layer.maskCanvas, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  layer.maskCanvas = null;
}

export function cloneMaskCanvas(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const canvas = createLayerCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.drawImage(source, 0, 0);
  return canvas;
}

export function captureCanvasState(canvas: HTMLCanvasElement): ImageData | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function restoreCanvasState(canvas: HTMLCanvasElement, data: ImageData) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.putImageData(data, 0, 0);
}
