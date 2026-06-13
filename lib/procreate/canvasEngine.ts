import type { BlendMode, BrushDef, Layer, Point, SymmetryMode, Tool } from "./types";
import { renderBrushStamp } from "./brushStamps";
import { getCachedTipImage } from "./brushLibrary";
import { mirrorPoints } from "./symmetry";

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
  return compositeLayersSlice(layers, 0, layers.length - 1, width, height, backgroundColor);
}

/** Composite from `fromIndex` through `toIndex` (inclusive). Used for smudge isolation. */
export function compositeLayersSlice(
  layers: Layer[],
  fromIndex: number,
  toIndex: number,
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

  const start = Math.max(0, fromIndex);
  const end = Math.min(layers.length - 1, toIndex);
  if (end < start) return out;

  for (let i = start; i <= end; i++) {
    const layer = layers[i];
    if (!layer.visible || layer.opacity <= 0) continue;

    if (layer.clipToLayerId) {
      const clipSource = layers.find((l) => l.id === layer.clipToLayerId);
      if (clipSource) {
        drawLayerClipped(ctx, layer, clipSource, width, height);
        continue;
      }
    }

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = BLEND_MAP[layer.blendMode] ?? "source-over";
    ctx.drawImage(layer.canvas, 0, 0);
    ctx.restore();
  }
  return out;
}

function drawLayerClipped(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  clipSource: Layer,
  width: number,
  height: number,
) {
  const temp = document.createElement("canvas");
  temp.width = width;
  temp.height = height;
  const tctx = temp.getContext("2d");
  if (!tctx) return;
  tctx.drawImage(layer.canvas, 0, 0);
  tctx.globalCompositeOperation = "destination-in";
  tctx.drawImage(clipSource.canvas, 0, 0);

  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.globalCompositeOperation = BLEND_MAP[layer.blendMode] ?? "source-over";
  ctx.drawImage(temp, 0, 0);
  ctx.restore();
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
    options?: {
      alphaLock?: boolean;
      symmetry?: SymmetryMode;
      canvasWidth?: number;
      canvasHeight?: number;
    },
  ) {
    const size = brush.size * sizeMul * (0.35 + to.pressure * 0.65);
    const baseAlpha = brush.opacity * opacityMul * (0.4 + to.pressure * 0.6) * brush.flow;
    const sym = options?.symmetry ?? "none";
    const cw = options?.canvasWidth ?? composite?.width ?? 2048;
    const ch = options?.canvasHeight ?? composite?.height ?? 2048;

    const drawPair = (a: Point, b: Point) => {
      const pairs: [Point, Point][] = [[a, b]];
      if (sym !== "none") {
        const ma = mirrorPoints(a, cw, ch, sym);
        const mb = mirrorPoints(b, cw, ch, sym);
        for (let i = 1; i < ma.length; i++) pairs.push([ma[i], mb[i]]);
      }
      for (const [f, t] of pairs) this.paintStrokeOnce(ctx, f, t, brush, color, tool, size, baseAlpha, composite, options?.alphaLock);
    };
    drawPair(from, to);
  }

  private paintStrokeOnce(
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    brush: BrushDef,
    color: string,
    tool: Tool,
    size: number,
    baseAlpha: number,
    composite: HTMLCanvasElement | undefined,
    alphaLock?: boolean,
  ) {
    if (tool === "erase") {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      this.drawSegment(ctx, from, to, { ...brush, hardness: brush.hardness }, "#000", size, baseAlpha, composite, true, alphaLock);
      ctx.restore();
      return;
    }

    if (tool === "smudge" && composite) {
      this.smudgeSegment(ctx, from, to, brush, size, baseAlpha, composite, alphaLock);
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = alphaLock ? "source-atop" : "source-over";
    this.drawSegment(ctx, from, to, brush, color, size, baseAlpha, composite, false, alphaLock);
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
    _alphaLock?: boolean,
  ) {
    const d = dist(from, to);
    const segmentAngle = Math.atan2(to.y - from.y, to.x - from.x);
    if (d < 0.01) {
      this.stampAt(ctx, to, brush, color, size, alpha, erase, 1, segmentAngle);
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
      this.stampAt(ctx, p, brush, color, size, alpha, erase, t, segmentAngle);
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
    segmentAngle: number,
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

    const tip = getCachedTipImage(brush);
    if (tip) {
      ctx.save();
      ctx.globalAlpha = stampAlpha;
      const r = stampSize / 2;
      ctx.drawImage(tip, sx - r, sy - r, stampSize, stampSize);
      ctx.restore();
    } else {
      renderBrushStamp(ctx, sx, sy, stampSize, color, stampAlpha, brush, segmentAngle);
    }

    if (brush.wetMix > 0 && !erase) {
      ctx.save();
      ctx.globalAlpha = brush.wetMix * 0.15;
      ctx.globalCompositeOperation = "source-over";
      renderBrushStamp(
        ctx,
        sx,
        sy,
        stampSize * 1.2,
        color,
        0.3,
        { ...brush, hardness: 0.05, texture: "smooth", shape: "circle", glow: 0, bleed: 0 },
        segmentAngle,
      );
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
    alphaLock?: boolean,
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
      if (alphaLock) ctx.globalCompositeOperation = "source-atop";
      ctx.putImageData(sample, sx, sy);
      ctx.restore();

      renderBrushStamp(
        ctx,
        x,
        y,
        size * 0.8,
        "#888",
        alpha * 0.2,
        { ...brush, hardness: 0.1, texture: "smooth", shape: "circle" },
        0,
      );
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
