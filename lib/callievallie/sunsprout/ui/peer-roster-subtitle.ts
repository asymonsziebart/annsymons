// Peer roster subtitle — v0.6.0 slice.
//
// Tiny HUD strip that draws the one-line roster summary (e.g.
// "3 nearby · nearest 2t") directly under the peer-badge in the top-right
// stack. Sits between the peer-badge and the mute-badge / roster-panel
// without owning any state.
//
// Pure draw helper. Source is formatRosterSummary(summarizeRoster(entries)).
// When the formatted string is empty (nobody around, nothing stale) we skip
// drawing so the HUD stays quiet in solo play.
//
// Tone (optional) tints the strip via rosterTonePalette — 'solo' is the
// existing neutral purple so legacy callers stay pixel-identical.

import { peerBadgeRect } from './peer-badge';
import { rosterTonePalette } from './peer-roster-tone-palette';
import type { RosterTone } from '../game/peer-roster-tone';

export interface RosterSubtitleOpts {
  /** Pre-formatted summary string from formatRosterSummary(). */
  text: string;
  /** Canvas width in CSS pixels — strip anchors to the right edge. */
  canvasW: number;
  /** Optional roster tone — defaults to 'solo' (neutral purple). */
  tone?: RosterTone;
}

/** Rect for the subtitle strip, stacked just under the peer badge. */
export function rosterSubtitleRect(canvasW: number): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const peer = peerBadgeRect(canvasW);
  const h = 14;
  const gap = 2;
  return {
    x: peer.x,
    y: peer.y + peer.h + gap,
    w: peer.w,
    h,
  };
}

/** Draws the subtitle strip. No-op when text is empty. */
export function drawRosterSubtitle(
  ctx: CanvasRenderingContext2D,
  opts: RosterSubtitleOpts,
): void {
  if (!opts.text) return;
  const r = rosterSubtitleRect(opts.canvasW);
  const palette = rosterTonePalette(opts.tone ?? 'solo');

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  ctx.fillStyle = palette.bg;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = palette.border;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

  ctx.font = '9px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.text;
  ctx.fillText(opts.text, r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}
