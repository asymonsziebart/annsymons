import type { BrushDef, BrushStampBlend, BrushStampShape } from "./types";
import { hexToRgb } from "./colorUtils";

const STAMP_BLEND: Record<BrushStampBlend, GlobalCompositeOperation> = {
  normal: "source-over",
  screen: "screen",
  multiply: "multiply",
  overlay: "overlay",
};

function stampCircle(
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
  const { r: cr, g: cg, b: cb } = hexToRgb(color);

  if (texture === "chalk") {
    const grain = ctx.createRadialGradient(x, y, 0, x, y, r);
    grain.addColorStop(0, `rgba(${cr},${cg},${cb},0.95)`);
    grain.addColorStop(hardness * 0.4, `rgba(${cr},${cg},${cb},0.7)`);
    grain.addColorStop(0.85, `rgba(${cr},${cg},${cb},0.25)`);
    grain.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = grain;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    const specks = Math.max(4, Math.floor(size * 0.5));
    for (let i = 0; i < specks; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rad = Math.random() * r;
      ctx.globalAlpha = alpha * (0.15 + Math.random() * 0.35);
      ctx.fillStyle = i % 3 === 0 ? "#ffffff" : color;
      ctx.fillRect(x + Math.cos(angle) * rad, y + Math.sin(angle) * rad, 1.2, 1.2);
    }
  } else if (texture === "halftone") {
    const dotSpacing = Math.max(2, size * 0.14);
    const dotR = dotSpacing * 0.38;
    ctx.fillStyle = color;
    for (let dy = -r; dy <= r; dy += dotSpacing) {
      for (let dx = -r; dx <= r; dx += dotSpacing) {
        const px = x + dx + (dy % (dotSpacing * 2) === 0 ? dotSpacing * 0.5 : 0);
        const py = y + dy;
        if (Math.hypot(px - x, py - y) > r) continue;
        const edge = 1 - Math.hypot(px - x, py - y) / r;
        ctx.globalAlpha = alpha * edge * (0.35 + hardness * 0.65);
        ctx.beginPath();
        ctx.arc(px, py, dotR * (0.6 + hardness * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (texture === "grain" || texture === "speckle") {
    const grain = ctx.createRadialGradient(x, y, 0, x, y, r);
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
    grad.addColorStop(0, `rgba(${cr},${cg},${cb},0.9)`);
    grad.addColorStop(hardness * 0.5, `rgba(${cr},${cg},${cb},0.6)`);
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

function drawOrientedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angle: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

function stampFlat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  hardness: number,
  angle: number,
  aspectRatio: number,
) {
  const w = size;
  const h = Math.max(2, size * aspectRatio);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  if (hardness < 1) {
    ctx.shadowColor = color;
    ctx.shadowBlur = size * (1 - hardness) * 0.35;
  }
  drawOrientedRect(ctx, x, y, w, h, angle);
  ctx.restore();
}

function stampSquare(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  angle: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  drawOrientedRect(ctx, x, y, size * 0.85, size * 0.85, angle);
  ctx.restore();
}

function stampPixel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
) {
  const px = Math.max(1, Math.round(size / 4));
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x) - px / 2, Math.floor(y) - px / 2, px, px);
  ctx.restore();
}

function stampHair(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  angle: number,
) {
  const strands = Math.max(4, Math.floor(size * 0.35));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  for (let i = 0; i < strands; i++) {
    const a = angle + (Math.random() - 0.5) * 1.4;
    const len = size * (0.35 + Math.random() * 0.55);
    const ox = (Math.random() - 0.5) * size * 0.25;
    const oy = (Math.random() - 0.5) * size * 0.25;
    ctx.globalAlpha = alpha * (0.25 + Math.random() * 0.75);
    ctx.lineWidth = Math.max(0.4, size * 0.04 * Math.random());
    ctx.beginPath();
    ctx.moveTo(x + ox, y + oy);
    ctx.lineTo(x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
    ctx.stroke();
  }
  ctx.restore();
}

function stampCrosshatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
) {
  const r = size / 2;
  const spacing = Math.max(2, size * 0.12);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = Math.max(0.5, size * 0.035);
  ctx.lineCap = "round";
  for (let d = -r; d <= r; d += spacing) {
    ctx.beginPath();
    ctx.moveTo(x - r, y + d);
    ctx.lineTo(x + r, y + d);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + d, y - r);
    ctx.lineTo(x + d, y + r);
    ctx.stroke();
  }
  ctx.restore();
}

function stampSpray(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
) {
  const r = size / 2;
  const dots = Math.max(12, Math.floor(size * 1.2));
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < dots; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.pow(Math.random(), 0.65) * r;
    const dotR = 0.4 + Math.random() * (size * 0.07);
    ctx.globalAlpha = alpha * (0.2 + Math.random() * 0.8);
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, dotR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function stampStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  angle: number,
) {
  const outer = size / 2;
  const inner = outer * 0.42;
  const points = 5;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? outer : inner;
    const a = (i * Math.PI) / points - Math.PI / 2;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function stampRibbon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  angle: number,
) {
  stampFlat(ctx, x, y, size * 1.1, color, alpha * 0.55, 0.15, angle, 0.12);
  stampFlat(ctx, x, y, size * 0.65, color, alpha, 0.85, angle, 0.08);
}

function stampShape(
  ctx: CanvasRenderingContext2D,
  shape: BrushStampShape,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  hardness: number,
  angle: number,
  aspectRatio: number,
) {
  switch (shape) {
    case "flat":
      stampFlat(ctx, x, y, size, color, alpha, hardness, angle, aspectRatio);
      break;
    case "square":
      stampSquare(ctx, x, y, size, color, alpha, angle);
      break;
    case "pixel":
      stampPixel(ctx, x, y, size, color, alpha);
      break;
    case "hair":
      stampHair(ctx, x, y, size, color, alpha, angle);
      break;
    case "crosshatch":
      stampCrosshatch(ctx, x, y, size, color, alpha);
      break;
    case "spray":
      stampSpray(ctx, x, y, size, color, alpha);
      break;
    case "star":
      stampStar(ctx, x, y, size, color, alpha, angle);
      break;
    case "ribbon":
      stampRibbon(ctx, x, y, size, color, alpha, angle);
      break;
    default:
      stampCircle(ctx, x, y, size, color, alpha, hardness, "smooth");
  }
}

export function renderBrushStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
  brush: BrushDef,
  angle: number,
  compositeOperation?: GlobalCompositeOperation,
) {
  const shape = brush.shape ?? "circle";
  const aspect = brush.aspectRatio ?? 0.22;
  const blend = brush.stampBlend ?? "normal";
  let stampAngle = angle;
  if (!brush.rotationFollowStroke) {
    stampAngle = 0;
  }
  if (brush.angleJitter && brush.angleJitter > 0) {
    stampAngle += (Math.random() - 0.5) * brush.angleJitter;
  }

  ctx.save();
  ctx.globalCompositeOperation = compositeOperation ?? STAMP_BLEND[blend];

  if (shape === "circle") {
    stampCircle(ctx, x, y, size, color, alpha, brush.hardness, brush.texture);
  } else {
    stampShape(ctx, shape, x, y, size, color, alpha, brush.hardness, stampAngle, aspect);
  }

  if (brush.glow && brush.glow > 0) {
    ctx.globalCompositeOperation = compositeOperation ?? "screen";
    ctx.globalAlpha = alpha * brush.glow * 0.45;
    stampCircle(ctx, x, y, size * 1.75, color, 1, 0.05, "smooth");
  }

  if (brush.bleed && brush.bleed > 0) {
    ctx.globalCompositeOperation =
      compositeOperation ?? (blend === "normal" ? "source-over" : STAMP_BLEND[blend]);
    const ox = (Math.random() - 0.5) * size * brush.bleed * 0.35;
    const oy = (Math.random() - 0.5) * size * brush.bleed * 0.35;
    ctx.globalAlpha = alpha * brush.bleed * 0.35;
    if (shape === "circle") {
      stampCircle(ctx, x + ox, y + oy, size * 1.08, color, 1, brush.hardness * 0.5, brush.texture);
    } else {
      stampShape(ctx, shape, x + ox, y + oy, size * 1.05, color, 1, brush.hardness * 0.5, stampAngle, aspect);
    }
  }

  ctx.restore();
}
