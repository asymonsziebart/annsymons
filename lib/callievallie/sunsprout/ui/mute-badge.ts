// Muted-count badge — v0.6.0 thirty-third slice.
//
// Tiny HUD overlay that sits directly under the peer-badge in the top-right
// stack and surfaces "how many peers have I muted right now". Mirrors the
// shape of peer-badge.ts so the two stack cleanly without needing a layout
// helper yet.
//
// Pure draw helper. Source-of-truth is ChatMuteSet.size(). When the count
// is 0 we skip drawing entirely — unlike the peer badge, "no mutes" is the
// boring default state and doesn't need a permanent HUD presence.

import { peerBadgeRect } from './peer-badge';

const PANEL_BG = 'rgba(26, 20, 38, 0.85)';
const PANEL_BORDER = '#4a3b6e';
const TEXT_COLOR = '#F5E9D4';
const MUTED_ACCENT = '#E89E9E';

export interface MuteBadgeOpts {
  /** Number of currently-muted peers. */
  mutedCount: number;
  /** Canvas width in CSS pixels — badge anchors to the right edge. */
  canvasW: number;
}

/** Rect for the mute badge, stacked just under the peer badge. */
export function muteBadgeRect(canvasW: number): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const peer = peerBadgeRect(canvasW);
  const w = peer.w;
  const h = peer.h;
  const gap = 4;
  return {
    x: peer.x,
    y: peer.y + peer.h + gap,
    w,
    h,
  };
}

/** Draws the mute badge. No-op when mutedCount <= 0. */
export function drawMuteBadge(
  ctx: CanvasRenderingContext2D,
  opts: MuteBadgeOpts,
): void {
  if (opts.mutedCount <= 0) return;
  const r = muteBadgeRect(opts.canvasW);

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

  // Little red speaker-off square as a glyph stand-in.
  ctx.fillStyle = MUTED_ACCENT;
  ctx.fillRect(r.x + 6, r.y + r.h / 2 - 4, 8, 8);

  ctx.font = 'bold 11px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = TEXT_COLOR;
  const label = opts.mutedCount === 1 ? 'muted 1' : `muted ${opts.mutedCount}`;
  ctx.fillText(label, r.x + 20, r.y + r.h / 2 + 1);
  ctx.restore();
}
