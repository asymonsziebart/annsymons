// Chat history HUD panel — v0.6.0 twenty-eighth slice.
//
// Bottom-left scrolling list of the most recent ChatLog entries. Pure draw
// helper plus a layout function exposed for tests. The Game will call
// drawChatHistory each frame; visibility is controlled either by composer
// state (always show while typing) or by recent activity (fade-out after
// the most recent entry exceeds a TTL).
//
// Design rules:
//   - No timers, no DOM, no rendering side-effects. Reads ChatLog + now.
//   - Sits to the LEFT of the chat-bar slot so they don't fight for space.
//   - Source ids are rendered as a short colored tag; 'local' → "you".
//   - Bounded line count (VISIBLE_LINES) regardless of log size.

import type { ChatLog, ChatLogEntry } from '../game/chat-log';

const PANEL_BG = 'rgba(20, 16, 30, 0.78)';
const PANEL_BORDER = '#3a2f55';
const TEXT_COLOR = '#F5E9D4';
const LOCAL_TAG = '#9AE6B4';
const PEER_TAG = '#7AB8FF';

const HEIGHT_PER_LINE = 13;
const PAD_X = 8;
const PAD_Y = 6;
const MARGIN = 10;
const WIDTH = 260;
export const VISIBLE_LINES = 5;

/** Ms after the newest entry's `at` before the panel fully fades out. */
export const FADE_AFTER_MS = 6000;
/** Fade duration once the TTL expires. */
export const FADE_DURATION_MS = 800;

export interface ChatHistoryOpts {
  canvasW: number;
  canvasH: number;
  log: ChatLog;
  now: number;
  /** When true, force the panel fully visible (e.g. composer open). */
  forceVisible?: boolean;
}

export function chatHistoryRect(canvasW: number, canvasH: number, lines: number): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const visible = Math.max(1, Math.min(VISIBLE_LINES, lines));
  const h = PAD_Y * 2 + visible * HEIGHT_PER_LINE;
  return {
    x: MARGIN,
    y: canvasH - h - MARGIN,
    w: WIDTH,
    h,
  };
}

/**
 * Compute opacity in [0,1]. 1 while within FADE_AFTER_MS of newest entry,
 * linearly ramping to 0 over FADE_DURATION_MS after. Force flag pins to 1.
 */
export function chatHistoryAlpha(
  newest: ChatLogEntry | undefined,
  now: number,
  forceVisible: boolean,
): number {
  if (forceVisible) return 1;
  if (!newest) return 0;
  const age = now - newest.at;
  if (age <= FADE_AFTER_MS) return 1;
  const t = (age - FADE_AFTER_MS) / FADE_DURATION_MS;
  if (t >= 1) return 0;
  return 1 - t;
}

function tagFor(source: string): { label: string; color: string } {
  if (source === 'local') return { label: 'you', color: LOCAL_TAG };
  // Peer ids can be long — keep the first 6 chars for the tag.
  return { label: source.slice(0, 6), color: PEER_TAG };
}

export function drawChatHistory(
  ctx: CanvasRenderingContext2D,
  opts: ChatHistoryOpts,
): void {
  const entries = opts.log.tail(VISIBLE_LINES);
  if (entries.length === 0) return;
  const newest = entries[entries.length - 1];
  const alpha = chatHistoryAlpha(newest, opts.now, !!opts.forceVisible);
  if (alpha <= 0) return;

  const r = chatHistoryRect(opts.canvasW, opts.canvasH, entries.length);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;

  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

  ctx.font = '11px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const cy = r.y + PAD_Y + i * HEIGHT_PER_LINE + HEIGHT_PER_LINE / 2;
    const tag = tagFor(e.source);
    ctx.fillStyle = tag.color;
    ctx.fillText(tag.label, r.x + PAD_X, cy);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(e.text, r.x + PAD_X + 48, cy);
  }

  ctx.restore();
}
