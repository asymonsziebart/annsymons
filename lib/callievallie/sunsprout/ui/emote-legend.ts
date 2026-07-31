// Emote legend HUD — v0.6.0 twenty-first slice.
//
// Small bottom-right strip listing the 1-5 number-row emote keybinds so
// players in co-op can discover the emote system without a tutorial.
// Drawn only when multiplayer is active. Pure draw helper plus a layout
// function exposed for tests so we can assert rect math without touching
// a real canvas.

import { EMOTE_BINDINGS } from '../game/emote-keybinds';
import type { EmoteKind } from '../game/peer-emotes';

const PANEL_BG = 'rgba(26, 20, 38, 0.85)';
const PANEL_BORDER = '#4a3b6e';
const TEXT_COLOR = '#F5E9D4';
const KEY_COLOR = '#FFD27A';

const GLYPHS: Record<EmoteKind, string> = {
  wave: '👋',
  heart: '♥',
  sprout: '🌱',
  sparkle: '✦',
  note: '♪',
};

const ITEM_W = 28;
const PAD_X = 6;
const HEIGHT = 22;
const MARGIN = 8;

export interface EmoteLegendOpts {
  canvasW: number;
  canvasH: number;
}

export function emoteLegendRect(canvasW: number, canvasH: number): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const w = PAD_X * 2 + ITEM_W * EMOTE_BINDINGS.length;
  return {
    x: canvasW - w - MARGIN,
    y: canvasH - HEIGHT - MARGIN,
    w,
    h: HEIGHT,
  };
}

export function drawEmoteLegend(
  ctx: CanvasRenderingContext2D,
  opts: EmoteLegendOpts,
): void {
  const r = emoteLegendRect(opts.canvasW, opts.canvasH);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

  ctx.font = 'bold 10px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  const cy = r.y + r.h / 2 + 1;

  for (let i = 0; i < EMOTE_BINDINGS.length; i++) {
    const [key, kind] = EMOTE_BINDINGS[i];
    const cx = r.x + PAD_X + ITEM_W * i + ITEM_W / 2;
    ctx.fillStyle = KEY_COLOR;
    ctx.fillText(key, cx - 7, cy);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(GLYPHS[kind as EmoteKind], cx + 6, cy);
  }
  ctx.restore();
}
