import type { Point, SymmetryMode } from "./types";

export function mirrorPoints(
  p: Point,
  width: number,
  height: number,
  mode: SymmetryMode,
): Point[] {
  if (mode === "none") return [p];
  const cx = width / 2;
  const cy = height / 2;
  const out: Point[] = [p];
  if (mode === "vertical" || mode === "quad") {
    out.push({ x: width - p.x, y: p.y, pressure: p.pressure });
  }
  if (mode === "horizontal" || mode === "quad") {
    out.push({ x: p.x, y: height - p.y, pressure: p.pressure });
  }
  if (mode === "quad") {
    out.push({ x: width - p.x, y: height - p.y, pressure: p.pressure });
  }
  return out;
}

export function drawSymmetryGuides(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mode: SymmetryMode,
  zoom: number,
) {
  if (mode === "none") return;
  ctx.save();
  ctx.strokeStyle = "rgba(0, 122, 255, 0.35)";
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  if (mode === "vertical" || mode === "quad") {
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();
  }
  if (mode === "horizontal" || mode === "quad") {
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}
