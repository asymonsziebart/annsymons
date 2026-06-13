import type { Point } from "./types";

export type QuickShapeResult =
  | { kind: "line"; from: Point; to: Point }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | null;

export const QUICK_SHAPE_HOLD_MS = 650;
export const QUICK_SHAPE_STILL_PX = 6;

export function detectQuickShape(points: Point[]): QuickShapeResult {
  if (points.length < 3) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const dx = last.x - first.x;
  const dy = last.y - first.y;
  const span = Math.hypot(dx, dy);

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
  if (w < 12 && h < 12) return null;

  const aspect = w / (h || 1);
  const circularity = Math.abs(w - h) / Math.max(w, h);
  const closedLoop = span < Math.max(w, h) * 0.35;

  if (closedLoop && w > 16 && h > 16) {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    if (circularity < 0.22) {
      const r = (Math.max(w, h) / 2) * 0.98;
      return { kind: "circle", cx, cy, r };
    }
    if (circularity < 0.55) {
      return { kind: "ellipse", cx, cy, rx: w / 2, ry: h / 2 };
    }
  }

  if (!closedLoop && aspect > 0.82 && aspect < 1.22 && w > 14 && h > 14) {
    return { kind: "rect", x: minX, y: minY, w, h };
  }

  if (span >= 10) {
    const lineErr = maxLineDeviation(points, first, last);
    if (lineErr < Math.max(6, span * 0.1)) {
      return { kind: "line", from: first, to: last };
    }
  }

  if (w > 18 && h > 18 && circularity < 0.4 && closedLoop) {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return { kind: "ellipse", cx, cy, rx: w / 2, ry: h / 2 };
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
  opacity = 1,
) {
  if (!shape) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = opacity;
  ctx.lineWidth = Math.max(1, size);
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
  } else if (shape.kind === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape.kind === "rect") {
    ctx.beginPath();
    ctx.rect(shape.x, shape.y, shape.w, shape.h);
    ctx.stroke();
  }
  ctx.restore();
}

/** Sample points along a shape path for brush-stamp rendering. */
export function sampleQuickShapePoints(shape: NonNullable<QuickShapeResult>, step: number): Point[] {
  const pts: Point[] = [];
  const s = Math.max(2, step);

  if (shape.kind === "line") {
    const len = Math.hypot(shape.to.x - shape.from.x, shape.to.y - shape.from.y);
    const n = Math.max(2, Math.ceil(len / s));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      pts.push({
        x: shape.from.x + (shape.to.x - shape.from.x) * t,
        y: shape.from.y + (shape.to.y - shape.from.y) * t,
        pressure: 0.7,
      });
    }
    return pts;
  }

  if (shape.kind === "circle" || shape.kind === "ellipse") {
    const rx = shape.kind === "circle" ? shape.r : shape.rx;
    const ry = shape.kind === "circle" ? shape.r : shape.ry;
    const cx = shape.cx;
    const cy = shape.cy;
    const circumference = Math.PI * 2 * Math.max(rx, ry);
    const n = Math.max(8, Math.ceil(circumference / s));
    for (let i = 0; i <= n; i++) {
      const angle = (i / n) * Math.PI * 2;
      pts.push({
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
        pressure: 0.7,
      });
    }
    return pts;
  }

  if (shape.kind === "rect") {
    const corners = [
      { x: shape.x, y: shape.y },
      { x: shape.x + shape.w, y: shape.y },
      { x: shape.x + shape.w, y: shape.y + shape.h },
      { x: shape.x, y: shape.y + shape.h },
      { x: shape.x, y: shape.y },
    ];
    for (let i = 0; i < corners.length - 1; i++) {
      const a = corners[i];
      const b = corners[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const n = Math.max(1, Math.ceil(len / s));
      for (let j = 0; j < n; j++) {
        const t = j / n;
        pts.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
          pressure: 0.7,
        });
      }
    }
    return pts;
  }

  return pts;
}
