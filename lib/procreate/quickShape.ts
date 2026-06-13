import type { Point } from "./types";

export type QuickShapeResult =
  | { kind: "line"; from: Point; to: Point }
  | { kind: "circle"; cx: number; cy: number; r: number }
  | { kind: "oval"; cx: number; cy: number; rx: number; ry: number }
  | { kind: "square"; x: number; y: number; size: number }
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "triangle"; p1: Point; p2: Point; p3: Point }
  | { kind: "star"; cx: number; cy: number; outerR: number; innerR: number; rotation: number }
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

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const aspect = w / (h || 1);
  const circularity = Math.abs(w - h) / Math.max(w, h);
  const closedLoop = span < Math.max(w, h) * 0.38;

  if (!closedLoop && span >= 10) {
    const lineErr = maxLineDeviation(points, first, last);
    if (lineErr < Math.max(6, span * 0.1)) {
      return { kind: "line", from: first, to: last };
    }
  }

  if (!closedLoop && w > 14 && h > 14) {
    if (aspect > 0.82 && aspect < 1.22) {
      const size = Math.max(w, h);
      return { kind: "square", x: minX, y: minY, size };
    }
    return { kind: "rect", x: minX, y: minY, w, h };
  }

  if (!closedLoop) return null;

  const radiusVar = radialVariance(points, cx, cy);
  const peaks = countRadialPeaks(points, cx, cy);

  if ((peaks >= 8 || peaks === 5 || peaks === 6) && radiusVar > 0.18) {
    const outerR = (Math.max(w, h) / 2) * 0.98;
    return { kind: "star", cx, cy, outerR, innerR: outerR * 0.42, rotation: -Math.PI / 2 };
  }

  if (peaks === 3 || (radiusVar > 0.12 && detectTriangleShape(points, minX, minY, maxX, maxY))) {
    const tri = triangleFromBounds(minX, minY, maxX, maxY);
    if (tri) return tri;
  }

  if (peaks === 4 || isRectangularLoop(points, minX, minY, maxX, maxY)) {
    if (aspect > 0.86 && aspect < 1.16) {
      const size = Math.max(w, h);
      return { kind: "square", x: minX, y: minY, size };
    }
    return { kind: "rect", x: minX, y: minY, w, h };
  }

  if (w > 16 && h > 16 && radiusVar < 0.2) {
    if (circularity < 0.2) {
      const r = (Math.max(w, h) / 2) * 0.98;
      return { kind: "circle", cx, cy, r };
    }
    if (circularity < 0.65) {
      return { kind: "oval", cx, cy, rx: w / 2, ry: h / 2 };
    }
  }

  if (w > 18 && h > 18 && circularity < 0.55 && radiusVar < 0.28) {
    return { kind: "oval", cx, cy, rx: w / 2, ry: h / 2 };
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

function radialVariance(points: Point[], cx: number, cy: number): number {
  let sum = 0;
  const dists: number[] = [];
  for (const p of points) {
    const d = Math.hypot(p.x - cx, p.y - cy);
    dists.push(d);
    sum += d;
  }
  const mean = sum / dists.length || 1;
  const variance = dists.reduce((s, d) => s + (d - mean) ** 2, 0) / dists.length;
  return Math.sqrt(variance) / mean;
}

function countRadialPeaks(points: Point[], cx: number, cy: number): number {
  const samples: { angle: number; dist: number }[] = [];
  const step = Math.max(1, Math.floor(points.length / 48));
  for (let i = 0; i < points.length; i += step) {
    const p = points[i];
    samples.push({
      angle: Math.atan2(p.y - cy, p.x - cx),
      dist: Math.hypot(p.x - cx, p.y - cy),
    });
  }
  if (samples.length < 6) return 0;

  samples.sort((a, b) => a.angle - b.angle);

  const meanDist = samples.reduce((s, v) => s + v.dist, 0) / samples.length;
  if (meanDist < 8) return 0;

  let peaks = 0;
  for (let i = 0; i < samples.length; i++) {
    const prev = samples[(i - 1 + samples.length) % samples.length];
    const curr = samples[i];
    const next = samples[(i + 1) % samples.length];
    if (curr.dist > prev.dist && curr.dist > next.dist && curr.dist > meanDist * 0.72) {
      peaks++;
    }
  }

  if (peaks === 9 || peaks === 10) return 5;
  return peaks;
}

function detectTriangleShape(
  points: Point[],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 16 || h < 16) return false;

  const corners = findExtremeCorners(points);
  if (corners.length < 3) return false;

  const tri = triangleFromBounds(minX, minY, maxX, maxY);
  if (!tri) return false;

  const verts = [tri.p1, tri.p2, tri.p3];
  let totalErr = 0;
  for (const p of points) {
    totalErr += Math.min(
      ...verts.map((v) => Math.hypot(p.x - v.x, p.y - v.y)),
      distanceToTriangleEdge(p, tri),
    );
  }
  const avgErr = totalErr / points.length;
  return avgErr < Math.max(w, h) * 0.22;
}

function findExtremeCorners(points: Point[]): Point[] {
  if (points.length === 0) return [];
  let top = points[0];
  let bottom = points[0];
  let left = points[0];
  let right = points[0];
  for (const p of points) {
    if (p.y < top.y) top = p;
    if (p.y > bottom.y) bottom = p;
    if (p.x < left.x) left = p;
    if (p.x > right.x) right = p;
  }
  const uniq: Point[] = [];
  for (const p of [top, right, bottom, left]) {
    if (!uniq.some((u) => Math.hypot(u.x - p.x, u.y - p.y) < 6)) uniq.push(p);
  }
  return uniq;
}

function triangleFromBounds(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Extract<QuickShapeResult, { kind: "triangle" }> | null {
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 12 || h < 12) return null;

  return {
    kind: "triangle",
    p1: { x: cxOf(minX, maxX), y: minY, pressure: 0.7 },
    p2: { x: maxX, y: maxY, pressure: 0.7 },
    p3: { x: minX, y: maxY, pressure: 0.7 },
  };
}

function cxOf(minX: number, maxX: number) {
  return (minX + maxX) / 2;
}

function distanceToTriangleEdge(
  p: Point,
  tri: Extract<QuickShapeResult, { kind: "triangle" }>,
): number {
  return Math.min(
    distanceToSegment(p, tri.p1, tri.p2),
    distanceToSegment(p, tri.p2, tri.p3),
    distanceToSegment(p, tri.p3, tri.p1),
  );
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  return Math.hypot(p.x - px, p.y - py);
}

function isRectangularLoop(
  points: Point[],
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): boolean {
  const w = maxX - minX;
  const h = maxY - minY;
  if (w < 14 || h < 14) return false;

  const margin = Math.max(4, Math.min(w, h) * 0.12);
  let edgeHits = 0;
  for (const p of points) {
    const nearTop = Math.abs(p.y - minY) < margin;
    const nearBottom = Math.abs(p.y - maxY) < margin;
    const nearLeft = Math.abs(p.x - minX) < margin;
    const nearRight = Math.abs(p.x - maxX) < margin;
    if (nearTop || nearBottom || nearLeft || nearRight) edgeHits++;
  }
  return edgeHits / points.length > 0.45;
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
  } else if (shape.kind === "star") {
    traceStar(ctx, shape.cx, shape.cy, shape.outerR, shape.innerR, shape.rotation);
    ctx.stroke();
  }
  ctx.restore();
}

function traceStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  rotation: number,
  points = 5,
) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = rotation + (i * Math.PI) / points;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
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

  if (shape.kind === "star") {
    const verts: Point[] = [];
    for (let i = 0; i <= 5 * 2; i++) {
      const idx = i % (5 * 2);
      const r = idx % 2 === 0 ? shape.outerR : shape.innerR;
      const angle = shape.rotation + (idx * Math.PI) / 5;
      verts.push({
        x: shape.cx + Math.cos(angle) * r,
        y: shape.cy + Math.sin(angle) * r,
        pressure: 0.7,
      });
    }
    return samplePolyline(verts, s);
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
