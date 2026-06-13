import type { Point } from "./types";

export type QuickShapeResult =
  | { kind: "line"; from: Point; to: Point }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | null;

export function detectQuickShape(points: Point[], holdMs: number): QuickShapeResult {
  if (points.length < 2 || holdMs > 450) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 8) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const aspect = w / (h || 1);
  const circularity = Math.abs(w - h) / Math.max(w, h);

  if (circularity < 0.25 && w > 20 && h > 20) {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const r = Math.max(w, h) / 2;
    return { kind: "circle", cx, cy, r };
  }

  if (aspect > 0.85 && aspect < 1.18 && w > 15 && h > 15) {
    return { kind: "rect", x: minX, y: minY, w, h };
  }

  const lineErr = maxLineDeviation(points, first, last);
  if (lineErr < Math.max(8, dist * 0.08)) {
    return { kind: "line", from: first, to: last };
  }

  return null;
}

function maxLineDeviation(points: Point[], a: Point, b: Point): number {
  let max = 0;
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  for (const p of points) {
    const num = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x);
    max = Math.max(max, num / len);
  }
  return max;
}

export function drawQuickShape(
  ctx: CanvasRenderingContext2D,
  shape: QuickShapeResult,
  color: string,
  size: number,
) {
  if (!shape) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (shape.kind === "line") {
    ctx.beginPath();
    ctx.moveTo(shape.from.x, shape.from.y);
    ctx.lineTo(shape.to.x, shape.to.y);
    ctx.stroke();
  } else if (shape.kind === "circle") {
    ctx.beginPath();
    ctx.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape.kind === "rect") {
    ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
  }
  ctx.restore();
}
