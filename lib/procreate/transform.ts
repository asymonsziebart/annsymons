import type { Layer, TransformState } from "./types";
import { captureLayerState } from "./canvasEngine";

export function beginTransform(layer: Layer): TransformState | null {
  const source = captureLayerState(layer);
  if (!source) return null;
  return {
    layerId: layer.id,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    source,
  };
}

export function previewTransform(layer: Layer, t: TransformState) {
  const ctx = layer.canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
  ctx.save();
  ctx.translate(layer.canvas.width / 2 + t.x, layer.canvas.height / 2 + t.y);
  ctx.rotate(t.rotation);
  ctx.scale(t.scaleX, t.scaleY);
  const tmp = document.createElement("canvas");
  tmp.width = t.source.width;
  tmp.height = t.source.height;
  tmp.getContext("2d")!.putImageData(t.source, 0, 0);
  ctx.drawImage(tmp, -t.source.width / 2, -t.source.height / 2);
  ctx.restore();
}

export function commitTransform(layer: Layer, t: TransformState) {
  previewTransform(layer, t);
}

export function transformBounds(
  t: TransformState,
): { x: number; y: number; w: number; h: number } {
  const hw = (t.source.width * Math.abs(t.scaleX)) / 2;
  const hh = (t.source.height * Math.abs(t.scaleY)) / 2;
  const cx = t.source.width / 2 + t.x;
  const cy = t.source.height / 2 + t.y;
  return { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };
}

export type HandleId = "tl" | "tr" | "bl" | "br" | "rotate" | "move";

export function hitTransformHandle(
  t: TransformState,
  px: number,
  py: number,
  zoom: number,
): HandleId | null {
  const b = transformBounds(t);
  const hs = 10 / zoom;
  const handles: { id: HandleId; x: number; y: number }[] = [
    { id: "tl", x: b.x, y: b.y },
    { id: "tr", x: b.x + b.w, y: b.y },
    { id: "bl", x: b.x, y: b.y + b.h },
    { id: "br", x: b.x + b.w, y: b.y + b.h },
    { id: "rotate", x: b.x + b.w / 2, y: b.y - 24 / zoom },
  ];
  for (const h of handles) {
    if (Math.hypot(px - h.x, py - h.y) < hs) return h.id;
  }
  if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return "move";
  return null;
}

export function drawTransformHandles(ctx: CanvasRenderingContext2D, t: TransformState, zoom: number) {
  const b = transformBounds(t);
  ctx.save();
  ctx.strokeStyle = "#007aff";
  ctx.lineWidth = 1.5 / zoom;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  const hs = 5 / zoom;
  const pts = [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x, b.y + b.h],
    [b.x + b.w, b.y + b.h],
    [b.x + b.w / 2, b.y - 24 / zoom],
  ];
  for (const [x, y] of pts) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(x - hs, y - hs, hs * 2, hs * 2);
    ctx.strokeRect(x - hs, y - hs, hs * 2, hs * 2);
  }
  ctx.restore();
}
