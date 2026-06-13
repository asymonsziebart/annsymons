import type { Point } from "./types";

export type QuickShapeResult =
  | { kind: "line"; from: Point; to: Point }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "oval"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "square"; x: number; y: number; size: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "triangle"; p1: Point; p2: Point; p3: Point }
  | null;

export const QUICK_SHAPE_HOLD_MS = 650;
export const QUICK_SHAPE_STILL_PX = 6;

/** Max mean error (as fraction of stroke size) to accept a snap. */
const MAX_FIT_ERROR = 0.13;

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  diagonal: number;
};

type ScoredShape = { shape: NonNullable<QuickShapeResult>; error: number };

/**
 * Procreate Pocket QuickShape picks the closest geometric match:
 * line, ellipse (circle/oval), triangle, or quadrilateral (square/rectangle).
 */
export function detectQuickShape(points: Point[]): QuickShapeResult {
  if (points.length < 3) return null;

  const bounds = computeBounds(points);
  if (bounds.w < 10 && bounds.h < 10) return null;

  const norm = Math.max(bounds.diagonal, 1);
  const closed = isClosedStroke(points, bounds);
  const candidates: ScoredShape[] = [];

  const line = scoreLine(points, norm, closed);
  if (line) candidates.push(line);

  if (closed) {
    candidates.push(...scoreEllipseFamily(points, bounds, norm));
    candidates.push(...scoreQuadFamily(points, bounds, norm));
    const tri = scoreTriangle(points, bounds, norm);
    if (tri) candidates.push(tri);
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.error - b.error);
  const best = candidates[0];
  const runnerUp = candidates[1];

  if (best.error > MAX_FIT_ERROR) return null;

  if (closed && best.shape.kind === "line" && runnerUp) {
    if (runnerUp.error <= best.error * 1.25) return runnerUp.shape;
  }

  if (runnerUp && runnerUp.error - best.error < 0.018) {
    return tieBreak(best, runnerUp).shape;
  }

  return best.shape;
}

/** Second-finger gesture: rectangle→square, oval→circle, triangle→equilateral. */
export function makePerfectQuickShape(shape: NonNullable<QuickShapeResult>): NonNullable<QuickShapeResult> {
  if (shape.kind === "oval") {
    const r = (shape.rx + shape.ry) / 2;
    return { kind: "circle", cx: shape.cx, cy: shape.cy, r };
  }
  if (shape.kind === "rect") {
    const size = Math.max(shape.w, shape.h);
    return { kind: "square", x: shape.x + shape.w / 2 - size / 2, y: shape.y + shape.h / 2 - size / 2, size };
  }
  if (shape.kind === "triangle") {
    return equilateralTriangle(shape.p1, shape.p2, shape.p3);
  }
  return shape;
}

function computeBounds(points: Point[]): Bounds {
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
  return {
    minX,
    minY,
    maxX,
    maxY,
    w,
    h,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    diagonal: Math.hypot(w, h),
  };
}

function pathLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

function isClosedStroke(points: Point[], bounds: Bounds): boolean {
  const first = points[0];
  const last = points[points.length - 1];
  const closure = Math.hypot(last.x - first.x, last.y - first.y);
  const perimeter = pathLength(points);
  const size = Math.max(bounds.w, bounds.h);
  return closure < Math.min(perimeter * 0.22, size * 0.42);
}

function meanError(points: Point[], dist: (p: Point) => number, norm: number): number {
  let sum = 0;
  for (const p of points) sum += dist(p);
  return sum / points.length / norm;
}

function scoreLine(points: Point[], norm: number, closed: boolean): ScoredShape | null {
  const first = points[0];
  const last = points[points.length - 1];
  const span = Math.hypot(last.x - first.x, last.y - first.y);
  if (span < 10) return null;

  const error = meanError(points, (p) => distanceToSegment(p, first, last), norm);
  const closedPenalty = closed ? 0.06 : 0;
  return {
    shape: { kind: "line", from: { ...first }, to: { ...last } },
    error: error + closedPenalty,
  };
}

function scoreEllipseFamily(points: Point[], bounds: Bounds, norm: number): ScoredShape[] {
  const { cx, cy, w, h } = bounds;
  const rx = w / 2;
  const ry = h / 2;
  if (rx < 6 || ry < 6) return [];

  let sumR = 0;
  for (const p of points) sumR += Math.hypot(p.x - cx, p.y - cy);
  const r = sumR / points.length;

  const circleErr = meanError(points, (p) => Math.abs(Math.hypot(p.x - cx, p.y - cy) - r), norm);
  const ovalErr = meanError(points, (p) => distanceToEllipse(p, cx, cy, rx, ry), norm);

  const aspect = w / (h || 1);
  const out: ScoredShape[] = [];

  if (aspect > 0.72 && aspect < 1.39) {
    out.push({ shape: { kind: "circle", cx, cy, r }, error: circleErr });
  }
  out.push({ shape: { kind: "oval", cx, cy, rx, ry }, error: ovalErr });
  return out;
}

function scoreQuadFamily(points: Point[], bounds: Bounds, norm: number): ScoredShape[] {
  const { minX, minY, w, h, cx, cy } = bounds;
  if (w < 12 || h < 12) return [];

  const rectErr = meanError(points, (p) => distanceToRect(p, minX, minY, w, h), norm);

  const size = Math.max(w, h);
  const sqX = cx - size / 2;
  const sqY = cy - size / 2;
  const squareErr = meanError(points, (p) => distanceToRect(p, sqX, sqY, size, size), norm);

  const aspect = w / (h || 1);
  const out: ScoredShape[] = [];

  if (aspect > 0.72 && aspect < 1.39) {
    out.push({ shape: { kind: "square", x: sqX, y: sqY, size }, error: squareErr });
  }
  out.push({ shape: { kind: "rect", x: minX, y: minY, w, h }, error: rectErr });
  return out;
}

function scoreTriangle(points: Point[], bounds: Bounds, norm: number): ScoredShape | null {
  const corners = findCornerPoints(points, 3);
  if (corners.length < 3) return null;

  const ordered = orderByAngle(corners.slice(0, 3), bounds.cx, bounds.cy);
  const tri = {
    kind: "triangle" as const,
    p1: withPressure(ordered[0]),
    p2: withPressure(ordered[1]),
    p3: withPressure(ordered[2]),
  };

  const error = meanError(points, (p) => distanceToTriangle(p, tri), norm);
  if (error > MAX_FIT_ERROR * 1.15) return null;

  const quadBest = Math.min(
    meanError(points, (p) => distanceToRect(p, bounds.minX, bounds.minY, bounds.w, bounds.h), norm),
    meanError(
      points,
      (p) => distanceToEllipse(p, bounds.cx, bounds.cy, bounds.w / 2, bounds.h / 2),
      norm,
    ),
  );
  if (quadBest < error * 0.82) return null;

  return { shape: tri, error };
}

function tieBreak(a: ScoredShape, b: ScoredShape): ScoredShape {
  const rank = (s: ScoredShape) => {
    switch (s.shape.kind) {
      case "line":
        return 0;
      case "circle":
        return 1;
      case "oval":
        return 2;
      case "square":
        return 3;
      case "rect":
        return 4;
      case "triangle":
        return 5;
      default:
        return 6;
    }
  };
  return rank(a) <= rank(b) ? a : b;
}

function findCornerPoints(points: Point[], count: number): Point[] {
  const step = Math.max(1, Math.floor(points.length / 64));
  const candidates: { p: Point; score: number }[] = [];

  for (let i = step; i < points.length - step; i += step) {
    const a = points[i - step];
    const b = points[i];
    const c = points[i + step];
    const turn = Math.PI - angleAt(a, b, c);
    if (turn > 0.45) candidates.push({ p: b, score: turn });
  }

  candidates.sort((x, y) => y.score - x.score);

  const picked: Point[] = [];
  for (const c of candidates) {
    if (picked.every((p) => Math.hypot(p.x - c.p.x, p.y - c.p.y) > 14)) {
      picked.push(c.p);
    }
    if (picked.length >= count) break;
  }
  return picked;
}

function orderByAngle(pts: Point[], cx: number, cy: number): Point[] {
  return [...pts].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

function equilateralTriangle(p1: Point, p2: Point, p3: Point): Extract<QuickShapeResult, { kind: "triangle" }> {
  const cx = (p1.x + p2.x + p3.x) / 3;
  const cy = (p1.y + p2.y + p3.y) / 3;
  const r =
    (Math.hypot(p1.x - cx, p1.y - cy) +
      Math.hypot(p2.x - cx, p2.y - cy) +
      Math.hypot(p3.x - cx, p3.y - cy)) /
    3;
  const angles = [-Math.PI / 2, -Math.PI / 2 + (2 * Math.PI) / 3, -Math.PI / 2 + (4 * Math.PI) / 3];
  return {
    kind: "triangle",
    p1: { x: cx + Math.cos(angles[0]) * r, y: cy + Math.sin(angles[0]) * r, pressure: 0.7 },
    p2: { x: cx + Math.cos(angles[1]) * r, y: cy + Math.sin(angles[1]) * r, pressure: 0.7 },
    p3: { x: cx + Math.cos(angles[2]) * r, y: cy + Math.sin(angles[2]) * r, pressure: 0.7 },
  };
}

function withPressure(p: Point): Point {
  return { x: p.x, y: p.y, pressure: p.pressure ?? 0.7 };
}

function angleAt(a: Point, b: Point, c: Point): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (d === 0) return Math.PI;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d));
  return Math.acos(cos);
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanceToEllipse(p: Point, cx: number, cy: number, rx: number, ry: number): number {
  if (rx < 1 || ry < 1) return Infinity;
  const angle = Math.atan2((p.y - cy) / ry, (p.x - cx) / rx);
  const ex = cx + Math.cos(angle) * rx;
  const ey = cy + Math.sin(angle) * ry;
  return Math.hypot(p.x - ex, p.y - ey);
}

function distanceToRect(p: Point, x: number, y: number, w: number, h: number): number {
  const x2 = x + w;
  const y2 = y + h;
  const dx = p.x < x ? x - p.x : p.x > x2 ? p.x - x2 : 0;
  const dy = p.y < y ? y - p.y : p.y > y2 ? p.y - y2 : 0;
  return Math.hypot(dx, dy);
}

function distanceToTriangle(
  p: Point,
  tri: Extract<QuickShapeResult, { kind: "triangle" }>,
): number {
  return Math.min(
    distanceToSegment(p, tri.p1, tri.p2),
    distanceToSegment(p, tri.p2, tri.p3),
    distanceToSegment(p, tri.p3, tri.p1),
  );
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
  } else if (shape.kind === "oval") {
    ctx.beginPath();
    ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape.kind === "square") {
    ctx.beginPath();
    ctx.rect(shape.x, shape.y, shape.size, shape.size);
    ctx.stroke();
  } else if (shape.kind === "rect") {
    ctx.beginPath();
    ctx.rect(shape.x, shape.y, shape.w, shape.h);
    ctx.stroke();
  } else if (shape.kind === "triangle") {
    ctx.beginPath();
    ctx.moveTo(shape.p1.x, shape.p1.y);
    ctx.lineTo(shape.p2.x, shape.p2.y);
    ctx.lineTo(shape.p3.x, shape.p3.y);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

/** Sample points along a shape path for brush-stamp rendering. */
export function sampleQuickShapePoints(shape: NonNullable<QuickShapeResult>, step: number): Point[] {
  const s = Math.max(2, step);

  if (shape.kind === "line") {
    return sampleSegment(shape.from, shape.to, s);
  }

  if (shape.kind === "circle") {
    return sampleEllipse(shape.cx, shape.cy, shape.r, shape.r, s);
  }

  if (shape.kind === "oval") {
    return sampleEllipse(shape.cx, shape.cy, shape.rx, shape.ry, s);
  }

  if (shape.kind === "square") {
    return samplePolyline(
      [
        { x: shape.x, y: shape.y },
        { x: shape.x + shape.size, y: shape.y },
        { x: shape.x + shape.size, y: shape.y + shape.size },
        { x: shape.x, y: shape.y + shape.size },
        { x: shape.x, y: shape.y },
      ],
      s,
    );
  }

  if (shape.kind === "rect") {
    return samplePolyline(
      [
        { x: shape.x, y: shape.y },
        { x: shape.x + shape.w, y: shape.y },
        { x: shape.x + shape.w, y: shape.y + shape.h },
        { x: shape.x, y: shape.y + shape.h },
        { x: shape.x, y: shape.y },
      ],
      s,
    );
  }

  if (shape.kind === "triangle") {
    return samplePolyline([shape.p1, shape.p2, shape.p3, shape.p1], s);
  }

  return [];
}

function sampleSegment(from: { x: number; y: number }, to: { x: number; y: number }, step: number): Point[] {
  const pts: Point[] = [];
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const n = Math.max(2, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
      pressure: 0.7,
    });
  }
  return pts;
}

function sampleEllipse(cx: number, cy: number, rx: number, ry: number, step: number): Point[] {
  const pts: Point[] = [];
  const circumference = Math.PI * 2 * Math.max(rx, ry);
  const n = Math.max(8, Math.ceil(circumference / step));
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

function samplePolyline(corners: Array<{ x: number; y: number }>, step: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < corners.length - 1; i++) {
    const seg = sampleSegment(corners[i], corners[i + 1], step);
    if (i > 0 && seg.length > 0) seg.shift();
    pts.push(...seg);
  }
  return pts;
}
