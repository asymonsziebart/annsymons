import type { BlendMode, BrushDef, Layer, Point, Tool } from "./types";
import { hexToRgb } from "./colorUtils";

const BLEND_MAP: Record<BlendMode, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  darken: "darken",
  lighten: "lighten",
  "color-dodge": "color-dodge",
  "color-burn": "color-burn",
  "hard-light": "hard-light",
  "soft-light": "soft-light",
  difference: "difference",
  exclusion: "exclusion",
  hue: "hue",
  saturation: "saturation",
  color: "color",
  luminosity: "luminosity",
};

export function compositeLayers(
  layers: Layer[],
  width: number,
  height: number,
  backgroundColor = "#ffffff",
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return out;

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  for (const layer of layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = BLEND_MAP[layer.blendMode] ?? "source-over";
    ctx.drawImage(layer.canvas, 0, 0);
    ctx.restore();
  }
  return out;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function smoothPoint(prev: Point | null, curr: Point, streamline: number): Point {
  if (!prev || streamline <= 0) return curr;
  const t = 1 - streamline * 0.95;
  return {
    x: lerp(prev.x, curr.x, t),
    y: lerp(prev.y, curr.y, t),
    pressure: lerp(prev.pressure, curr.pressure, t),
  };
}

function stampBrush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  hardness: number,
  texture: BrushDef["texture"],
) {
  const r = size / 2;
  ctx.save();
  ctx.globalAlpha = alpha;

  if (texture === "grain" || texture === "speckle") {
    const grain = ctx.createRadialGradient(x, y, 0, x, y, r);
    const { r: cr, g: cg, b: cb } = hexToRgb(color);
    const edge = hardness * 0.6;
    grain.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
    grain.addColorStop(edge, `rgba(${cr},${cg},${cb},${0.85 - hardness * 0.3})`);
    grain.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = grain;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    if (texture === "speckle") {
      ctx.fillStyle = color;
      const dots = Math.max(3, Math.floor(size * 0.4));
      for (let i = 0; i < dots; i++) {
        const angle = Math.random() * Math.PI * 2;
        const rad = Math.random() * r;
        const dotR = Math.random() * (size * 0.08) + 0.5;
        ctx.globalAlpha = alpha * (0.3 + Math.random() * 0.7);
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * rad, y + Math.sin(angle) * rad, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (texture === "canvas") {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const { r: cr, g: cg, b: cb } = hexToRgb(color);
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},${0.9})`);
    grad.addColorStop(hardness * 0.5, `rgba(${cr},${cg},${cb},${0.6})`);
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.15;
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.3)`;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(x - r, y + (Math.random() - 0.5) * r);
      ctx.lineTo(x + r, y + (Math.random() - 0.5) * r);
      ctx.stroke();
    }
  } else {
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const { r: cr, g: cg, b: cb } = hexToRgb(color);
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
    grad.addColorStop(Math.max(0.01, hardness), `rgba(${cr},${cg},${cb},${hardness})`);
    grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export class StrokeEngine {
  private lastPoint: Point | null = null;
  private lastStamp = 0;

  reset() {
    this.lastPoint = null;
    this.lastStamp = 0;
  }

  paintStroke(
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    brush: BrushDef,
    color: string,
    tool: Tool,
    sizeMul: number,
    opacityMul: number,
    composite?: HTMLCanvasElement,
  ) {
    const size = brush.size * sizeMul * (0.35 + to.pressure * 0.65);
    const baseAlpha = brush.opacity * opacityMul * (0.4 + to.pressure * 0.6) * brush.flow;

    if (tool === "erase") {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      this.drawSegment(ctx, from, to, { ...brush, hardness: brush.hardness }, "#000", size, baseAlpha, composite, true);
      ctx.restore();
      return;
    }

    if (tool === "smudge" && composite) {
      this.smudgeSegment(ctx, from, to, brush, size, baseAlpha, composite);
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    this.drawSegment(ctx, from, to, brush, color, size, baseAlpha, composite, false);
    ctx.restore();
  }

  private drawSegment(
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    brush: BrushDef,
    color: string,
    size: number,
    alpha: number,
    _composite: HTMLCanvasElement | undefined,
    erase: boolean,
  ) {
    const d = dist(from, to);
    if (d < 0.01) {
      this.stampAt(ctx, to, brush, color, size, alpha, erase, 1);
      this.lastPoint = to;
      return;
    }

    // Keep stamps overlapping so fast strokes stay solid (spacing alone can gap on soft brushes).
    const step = Math.max(0.5, Math.min(size * brush.spacing, size * 0.12));
    const steps = Math.max(1, Math.ceil(d / step));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const p: Point = {
        x: lerp(from.x, to.x, t),
        y: lerp(from.y, to.y, t),
        pressure: lerp(from.pressure, to.pressure, t),
      };
      this.stampAt(ctx, p, brush, color, size, alpha, erase, t);
    }

    // Streamline only affects the next segment's start — never shorten what we draw now.
    this.lastPoint =
      brush.streamline > 0 ? smoothPoint(this.lastPoint, to, brush.streamline) : to;
  }

  private stampAt(
    ctx: CanvasRenderingContext2D,
    p: Point,
    brush: BrushDef,
    color: string,
    size: number,
    alpha: number,
    erase: boolean,
    t: number,
  ) {
    const taper =
      brush.taper > 0 ? 1 - brush.taper * 0.5 * (Math.abs(t - 0.5) * 2) : 1;
    const stampSize = size * taper * (0.5 + p.pressure * 0.5);

    let sx = p.x;
    let sy = p.y;
    if (brush.scatter > 0) {
      const scatterAmt = stampSize * brush.scatter * 0.5;
      sx += (Math.random() - 0.5) * scatterAmt;
      sy += (Math.random() - 0.5) * scatterAmt;
    }

    const stampAlpha = erase ? alpha : alpha * (0.5 + p.pressure * 0.5);
    stampBrush(ctx, sx, sy, stampSize, color, stampAlpha, brush.hardness, brush.texture);

    if (brush.wetMix > 0 && !erase) {
      ctx.save();
      ctx.globalAlpha = brush.wetMix * 0.15;
      ctx.globalCompositeOperation = "source-over";
      stampBrush(ctx, sx, sy, stampSize * 1.2, color, 0.3, 0.05, "smooth");
      ctx.restore();
    }
  }

  private smudgeSegment(
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    brush: BrushDef,
    size: number,
    alpha: number,
    composite: HTMLCanvasElement,
  ) {
    const compCtx = composite.getContext("2d", { willReadFrequently: true });
    if (!compCtx) return;

    const d = dist(from, to);
    const step = Math.max(0.5, Math.min(size * brush.spacing * 0.5, size * 0.12));
    const steps = Math.max(1, Math.ceil(d / step));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = lerp(from.x, to.x, t);
      const y = lerp(from.y, to.y, t);
      const r = Math.floor(size / 2);

      const sx = Math.max(0, Math.floor(x - r));
      const sy = Math.max(0, Math.floor(y - r));
      const sw = Math.min(composite.width - sx, r * 2);
      const sh = Math.min(composite.height - sy, r * 2);
      if (sw <= 0 || sh <= 0) continue;

      const sample = compCtx.getImageData(sx, sy, sw, sh);
      ctx.save();
      ctx.globalAlpha = alpha * 0.65;
      ctx.putImageData(sample, sx, sy);
      ctx.restore();

      stampBrush(ctx, x, y, size * 0.8, "#888", alpha * 0.2, 0.1, "smooth");
    }
    this.lastPoint = to;
  }
}

export function cloneImageData(data: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
}

export function captureLayerState(layer: Layer): ImageData | null {
  const ctx = layer.canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  return ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
}

export function restoreLayerState(layer: Layer, data: ImageData) {
  const ctx = layer.canvas.getContext("2d");
  if (!ctx) return;
  ctx.putImageData(data, 0, 0);
}

export function clearLayer(layer: Layer) {
  const ctx = layer.canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
}

export function fillLayer(layer: Layer, color: string) {
  const ctx = layer.canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, layer.canvas.width, layer.canvas.height);
  ctx.restore();
}

export async function importImageToLayer(
  layer: Layer,
  file: File,
  fit: "fill" | "contain" = "contain",
): Promise<void> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    const ctx = layer.canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);

    if (fit === "fill") {
      ctx.drawImage(img, 0, 0, layer.canvas.width, layer.canvas.height);
    } else {
      const scale = Math.min(layer.canvas.width / img.width, layer.canvas.height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (layer.canvas.width - w) / 2;
      const y = (layer.canvas.height - h) / 2;
      ctx.drawImage(img, x, y, w, h);
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const BLEND_MODE_LABELS: { mode: BlendMode; label: string }[] = [
  { mode: "normal", label: "Normal" },
  { mode: "multiply", label: "Multiply" },
  { mode: "screen", label: "Screen" },
  { mode: "overlay", label: "Overlay" },
  { mode: "darken", label: "Darken" },
  { mode: "lighten", label: "Lighten" },
  { mode: "color-dodge", label: "Color Dodge" },
  { mode: "color-burn", label: "Color Burn" },
  { mode: "hard-light", label: "Hard Light" },
  { mode: "soft-light", label: "Soft Light" },
  { mode: "difference", label: "Difference" },
  { mode: "exclusion", label: "Exclusion" },
  { mode: "hue", label: "Hue" },
  { mode: "saturation", label: "Saturation" },
  { mode: "color", label: "Color" },
  { mode: "luminosity", label: "Luminosity" },
];
