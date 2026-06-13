import type { AdjustmentType, Layer, SelectionMask } from "./types";

function applyToPixels(
  data: Uint8ClampedArray,
  mask: SelectionMask | null,
  fn: (r: number, g: number, b: number, a: number, i: number) => [number, number, number, number],
) {
  for (let i = 0; i < data.length; i += 4) {
    const mi = i / 4;
    if (mask && !mask.data[mi]) continue;
    const [r, g, b, a] = fn(data[i], data[i + 1], data[i + 2], data[i + 3], i);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }
}

function boxBlur(data: Uint8ClampedArray, w: number, h: number, radius: number, mask: SelectionMask | null) {
  const copy = new Uint8ClampedArray(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (mask && !mask.data[idx]) continue;
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = (ny * w + nx) * 4;
          r += copy[ni];
          g += copy[ni + 1];
          b += copy[ni + 2];
          a += copy[ni + 3];
          n++;
        }
      }
      const o = idx * 4;
      data[o] = r / n;
      data[o + 1] = g / n;
      data[o + 2] = b / n;
      data[o + 3] = a / n;
    }
  }
}

export function applyAdjustment(
  layer: Layer,
  type: AdjustmentType,
  amount: number,
  mask: SelectionMask | null = null,
) {
  const ctx = layer.canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const w = layer.canvas.width;
  const h = layer.canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  switch (type) {
    case "blur":
      boxBlur(data, w, h, Math.max(1, Math.round(amount * 4)), mask);
      break;
    case "sharpen": {
      const copy = new Uint8ClampedArray(data);
      const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
      const str = amount * 0.8;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = y * w + x;
          if (mask && !mask.data[idx]) continue;
          let r = 0;
          let g = 0;
          let b = 0;
          let ki = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ni = ((y + dy) * w + (x + dx)) * 4;
              const k = kernel[ki++] * str;
              r += copy[ni] * k;
              g += copy[ni + 1] * k;
              b += copy[ni + 2] * k;
            }
          }
          const o = idx * 4;
          data[o] = Math.min(255, Math.max(0, copy[o] + r * 0.2));
          data[o + 1] = Math.min(255, Math.max(0, copy[o + 1] + g * 0.2));
          data[o + 2] = Math.min(255, Math.max(0, copy[o + 2] + b * 0.2));
        }
      }
      break;
    }
    case "noise":
      applyToPixels(data, mask, (r, g, b, a) => {
        const n = (Math.random() - 0.5) * amount * 80;
        return [
          Math.min(255, Math.max(0, r + n)),
          Math.min(255, Math.max(0, g + n)),
          Math.min(255, Math.max(0, b + n)),
          a,
        ];
      });
      break;
    case "hue":
      applyToPixels(data, mask, (r, g, b, a) => {
        const shift = amount * 360;
        const [nr, ng, nb] = rgbRotateHue(r, g, b, shift);
        return [nr, ng, nb, a];
      });
      break;
    case "saturation": {
      const s = 1 + amount;
      applyToPixels(data, mask, (r, g, b, a) => {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        return [
          Math.min(255, Math.max(0, gray + (r - gray) * s)),
          Math.min(255, Math.max(0, gray + (g - gray) * s)),
          Math.min(255, Math.max(0, gray + (b - gray) * s)),
          a,
        ];
      });
      break;
    }
    case "brightness": {
      const b = amount * 100;
      applyToPixels(data, mask, (r, g, b2, a) => [
        Math.min(255, Math.max(0, r + b)),
        Math.min(255, Math.max(0, g + b)),
        Math.min(255, Math.max(0, b2 + b)),
        a,
      ]);
      break;
    }
    case "opacity": {
      const m = Math.max(0, Math.min(1, amount));
      applyToPixels(data, mask, (r, g, b, a) => [r, g, b, Math.round(a * m)]);
      break;
    }
  }

  ctx.putImageData(img, 0, 0);
}

function rgbRotateHue(r: number, g: number, b: number, deg: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  h = (h + deg / 360) % 1;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let rr = v;
  let gg = v;
  let bb = v;
  switch (i % 6) {
    case 0:
      rr = v;
      gg = t;
      bb = p;
      break;
    case 1:
      rr = q;
      gg = v;
      bb = p;
      break;
    case 2:
      rr = p;
      gg = v;
      bb = t;
      break;
    case 3:
      rr = p;
      gg = q;
      bb = v;
      break;
    case 4:
      rr = t;
      gg = p;
      bb = v;
      break;
    default:
      rr = v;
      gg = p;
      bb = q;
  }
  return [Math.round(rr * 255), Math.round(gg * 255), Math.round(bb * 255)];
}

export const ADJUSTMENT_LABELS: { type: AdjustmentType; label: string; min: number; max: number; default: number }[] = [
  { type: "blur", label: "Gaussian Blur", min: 0, max: 1, default: 0.3 },
  { type: "sharpen", label: "Sharpen", min: 0, max: 1, default: 0.4 },
  { type: "noise", label: "Noise", min: 0, max: 1, default: 0.2 },
  { type: "hue", label: "Hue", min: -0.5, max: 0.5, default: 0 },
  { type: "saturation", label: "Saturation", min: -1, max: 1, default: 0 },
  { type: "brightness", label: "Brightness", min: -0.5, max: 0.5, default: 0 },
  { type: "opacity", label: "Opacity", min: 0, max: 1, default: 1 },
];
