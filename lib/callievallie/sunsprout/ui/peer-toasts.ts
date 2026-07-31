// Multiplayer peer toasts — v0.6.0 fifteenth slice.
//
// Consumes PeerEvent records from PeerPresenceLog and renders short-lived
// toast notifications in the top-right corner, stacked under the peer badge.
// Pure helper — owns its own queue, no DOM. Caller pumps events via push()
// each tick and calls draw() every frame.
//
// Toasts auto-expire after TOAST_TTL_MS. Cap at MAX_VISIBLE so a flood of
// joins/leaves never eats the screen.

import type { PeerEvent } from '../game/peer-events';
import { peerBadgeRect } from './peer-badge';

const TOAST_TTL_MS = 3500;
const MAX_VISIBLE = 4;
const TOAST_W = 168;
const TOAST_H = 22;
const GAP = 4;

const PANEL_BG = 'rgba(26, 20, 38, 0.9)';
const JOIN_ACCENT = '#9EE89E';
const LEAVE_ACCENT = '#E89E9E';
const TEXT_COLOR = '#F5E9D4';

interface ActiveToast {
  kind: 'join' | 'leave';
  text: string;
  bornAt: number;
  diesAt: number;
}

export class PeerToasts {
  private active: ActiveToast[] = [];

  /** Number of currently-visible toasts (post-expiry-prune). Test-only. */
  size(now: number): number {
    this.prune(now);
    return this.active.length;
  }

  /** Enqueue a batch of PeerEvents. Older toasts are evicted if we overflow. */
  push(events: PeerEvent[], now: number): void {
    for (const ev of events) {
      const text =
        ev.kind === 'join' ? `${ev.name} joined` : `${ev.name} left`;
      this.active.push({
        kind: ev.kind,
        text,
        bornAt: now,
        diesAt: now + TOAST_TTL_MS,
      });
    }
    this.prune(now);
    if (this.active.length > MAX_VISIBLE) {
      this.active.splice(0, this.active.length - MAX_VISIBLE);
    }
  }

  private prune(now: number): void {
    this.active = this.active.filter((t) => t.diesAt > now);
  }

  /** Drop everything (e.g. on multiplayer disconnect). */
  clear(): void {
    this.active = [];
  }

  /** Draw the toast stack. Safe to call every frame. */
  draw(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    now: number,
  ): void {
    this.prune(now);
    if (this.active.length === 0) return;

    const badge = peerBadgeRect(canvasW);
    let y = badge.y + badge.h + GAP;
    const x = canvasW - TOAST_W - 8;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.font = 'bold 11px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    for (const t of this.active) {
      // Fade out over the final 600ms of life.
      const remaining = t.diesAt - now;
      const alpha = remaining < 600 ? Math.max(0, remaining / 600) : 1;
      ctx.globalAlpha = alpha;

      ctx.fillStyle = PANEL_BG;
      ctx.fillRect(x, y, TOAST_W, TOAST_H);

      const accent = t.kind === 'join' ? JOIN_ACCENT : LEAVE_ACCENT;
      ctx.fillStyle = accent;
      ctx.fillRect(x, y, 3, TOAST_H);

      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(t.text, x + 10, y + TOAST_H / 2 + 1);

      y += TOAST_H + GAP;
    }
    ctx.restore();
  }
}
