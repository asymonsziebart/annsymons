// Chat composer HUD bar — v0.6.0 twenty-fourth slice.
//
// Bottom-center input strip rendered while the local player has the chat
// composer open (see src/game/chat-input.ts). Pure draw helper plus a
// layout function exposed for tests so we can assert rect math without
// touching a real canvas. The Game will call drawChatBar each frame when
// ChatInputState.open is true.

import { CHAT_MAX_LEN } from '../game/chat-wire';
import type { ChatInputState } from '../game/chat-input';

const PANEL_BG = 'rgba(26, 20, 38, 0.92)';
const PANEL_BORDER = '#4a3b6e';
const TEXT_COLOR = '#F5E9D4';
const PROMPT_COLOR = '#FFD27A';
const COUNTER_DIM = '#8a7aa8';
const COUNTER_WARN = '#FFB070';

const HEIGHT = 26;
const MARGIN = 10;
const MAX_W = 360;
const MIN_W = 220;
const PAD_X = 8;

export interface ChatBarOpts {
  canvasW: number;
  canvasH: number;
  state: ChatInputState;
  /** Frame counter used to blink the caret (any monotonically rising int). */
  tick: number;
}

export function chatBarRect(canvasW: number, canvasH: number): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const w = Math.max(MIN_W, Math.min(MAX_W, Math.floor(canvasW * 0.55)));
  return {
    x: Math.floor((canvasW - w) / 2),
    y: canvasH - HEIGHT - MARGIN,
    w,
    h: HEIGHT,
  };
}

export function drawChatBar(
  ctx: CanvasRenderingContext2D,
  opts: ChatBarOpts,
): void {
  if (!opts.state.open) return;
  const r = chatBarRect(opts.canvasW, opts.canvasH);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

  ctx.font = 'bold 11px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const cy = r.y + r.h / 2 + 1;

  ctx.fillStyle = PROMPT_COLOR;
  ctx.fillText('say>', r.x + PAD_X, cy);

  ctx.fillStyle = TEXT_COLOR;
  const bodyX = r.x + PAD_X + 30;
  ctx.fillText(opts.state.buffer, bodyX, cy);

  // Blinking caret: on for 30 ticks, off for 30.
  const caretOn = Math.floor(opts.tick / 30) % 2 === 0;
  if (caretOn) {
    const w = ctx.measureText(opts.state.buffer).width;
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillRect(bodyX + w + 1, r.y + 6, 1, r.h - 12);
  }

  // Right-aligned char counter, warns near the cap.
  const remaining = CHAT_MAX_LEN - opts.state.buffer.length;
  ctx.textAlign = 'right';
  ctx.fillStyle = remaining <= 16 ? COUNTER_WARN : COUNTER_DIM;
  ctx.fillText(String(remaining), r.x + r.w - PAD_X, cy);

  ctx.restore();
}
