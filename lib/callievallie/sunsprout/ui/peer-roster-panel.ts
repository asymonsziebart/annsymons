// Multiplayer roster panel — v0.6.0 slice.
//
// Tiny HUD panel that lists nearby co-op friends, computed by
// buildPeerRoster(). Drawn under the peer-badge in the top-right corner so
// the player can see who's around and how far without opening a menu.
//
// Pure draw helper. No state, no DOM. Layout exposed via peerRosterPanelRect
// for tests so we can assert position/size without a real canvas.

import type { RosterEntry } from '../game/peer-roster';
import { formatRosterDistance } from '../game/peer-roster';
import { peerBadgeRect } from './peer-badge';
import { rosterTonePalette } from './peer-roster-tone-palette';
import type { RosterTone } from '../game/peer-roster-tone';

const TEXT_COLOR = '#F5E9D4';
const DIM_TEXT = '#8a7fa3';
const ROW_H = 14;
const PAD_X = 8;
const PAD_Y = 6;
const SWATCH = 6;

export interface PeerRosterPanelOpts {
  entries: readonly RosterEntry[];
  canvasW: number;
  /** Optional roster tone — tints the panel bg/border to match the subtitle. */
  tone?: RosterTone;
}

export function peerRosterPanelRect(
  canvasW: number,
  rowCount: number,
): { x: number; y: number; w: number; h: number } {
  const badge = peerBadgeRect(canvasW);
  const rows = Math.max(0, rowCount);
  const w = badge.w;
  const h = rows === 0 ? 0 : PAD_Y * 2 + rows * ROW_H;
  return {
    x: badge.x,
    y: badge.y + badge.h + 4,
    w,
    h,
  };
}

/** Draws the roster panel. No-op when there are zero entries. */
export function drawPeerRosterPanel(
  ctx: CanvasRenderingContext2D,
  opts: PeerRosterPanelOpts,
): void {
  if (opts.entries.length === 0) return;
  const r = peerRosterPanelRect(opts.canvasW, opts.entries.length);
  const palette = rosterTonePalette(opts.tone ?? 'solo');
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = palette.bg;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = palette.border;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

  ctx.font = '10px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < opts.entries.length; i++) {
    const e = opts.entries[i];
    const rowY = r.y + PAD_Y + i * ROW_H + ROW_H / 2;
    // Color swatch.
    ctx.fillStyle = e.live ? e.color : DIM_TEXT;
    ctx.fillRect(r.x + PAD_X, rowY - SWATCH / 2, SWATCH, SWATCH);
    // Name (truncated to fit).
    ctx.textAlign = 'left';
    ctx.fillStyle = e.live ? TEXT_COLOR : DIM_TEXT;
    ctx.fillText(truncate(e.name, 8), r.x + PAD_X + SWATCH + 4, rowY + 1);
    // Distance, right-aligned.
    ctx.textAlign = 'right';
    ctx.fillStyle = e.live ? TEXT_COLOR : DIM_TEXT;
    ctx.fillText(formatRosterDistance(e.distance), r.x + r.w - PAD_X, rowY + 1);
  }
  ctx.restore();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, Math.max(1, max - 1)) + '…';
}
