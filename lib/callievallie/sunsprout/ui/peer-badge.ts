// Multiplayer peer badge — v0.6.0 thirteenth slice.
//
// Tiny HUD overlay that shows how many co-op friends are currently visible.
// Drawn in the top-right corner just under the status bar so the player has
// a constant "co-op is live" signal without spinning up a full lobby UI.
//
// Pure draw helper. Counts come from MultiplayerDriver.session.registry.size().
// When count is 0 we still draw the badge (in a dimmer tint) so the player
// can tell the difference between "no multiplayer" (badge absent) and
// "multiplayer on but no friends connected yet" (badge present, dim).

const PANEL_BG = 'rgba(26, 20, 38, 0.85)';
const PANEL_BORDER = '#4a3b6e';
const TEXT_COLOR = '#F5E9D4';
const ACCENT = '#9EE89E';
const DIM = '#7a8a7a';

export interface PeerBadgeOpts {
  /** Number of currently connected peers (excluding the local player). */
  peerCount: number;
  /** Canvas width in CSS pixels — badge anchors to the right edge. */
  canvasW: number;
}

/**
 * Compute the screen-space rect of the badge. Exposed for tests so we can
 * assert position/size without poking at a canvas.
 */
export function peerBadgeRect(canvasW: number): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const w = 92;
  const h = 22;
  const margin = 8;
  const topBarH = 32;
  return {
    x: canvasW - w - margin,
    y: topBarH + margin,
    w,
    h,
  };
}

/** Draws the badge. Safe to call every frame. */
export function drawPeerBadge(
  ctx: CanvasRenderingContext2D,
  opts: PeerBadgeOpts,
): void {
  const r = peerBadgeRect(opts.canvasW);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = PANEL_BG;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = PANEL_BORDER;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

  // Tiny "people" dot icon on the left.
  const live = opts.peerCount > 0;
  ctx.fillStyle = live ? ACCENT : DIM;
  ctx.beginPath();
  ctx.arc(r.x + 10, r.y + r.h / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = 'bold 11px ui-monospace, "SF Mono", Menlo, monospace';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = TEXT_COLOR;
  const label = opts.peerCount === 1 ? '1 friend' : `${opts.peerCount} friends`;
  ctx.fillText(`co-op · ${label}`, r.x + 20, r.y + r.h / 2 + 1);
  ctx.restore();
}
