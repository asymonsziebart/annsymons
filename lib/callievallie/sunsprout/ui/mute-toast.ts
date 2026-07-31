// Mute toast queue — v0.6.0 thirty-second slice.
//
// Consumes MuteKeybindResult records and renders brief toast notifications
// in the top-right corner under the peer badge / peer toasts stack. Mirrors
// the shape of ui/peer-toasts.ts so future ticks can compose them into a
// single notification column without rewriting layout math.
//
// Design rules:
//   - Pure helper, no DOM. Caller pumps push() each tick and draws once.
//   - Empty / null id results are ignored — handleMuteKeybind returns
//     { id: null } on no-op frames and we don't want a phantom toast.
//   - MAX_VISIBLE caps the queue; older toasts get evicted before new ones.
//   - Fade out over the final 500ms of life, same vibe as PeerToasts.

import { peerBadgeRect } from './peer-badge';

const TOAST_TTL_MS = 2200;
const MAX_VISIBLE = 3;
const TOAST_W = 168;
const TOAST_H = 22;
const GAP = 4;
const STACK_OFFSET = 140; // leave room for ~4 peer-toasts above us

const PANEL_BG = 'rgba(26, 20, 38, 0.9)';
const MUTED_ACCENT = '#E89E9E';
const UNMUTED_ACCENT = '#9EE89E';
const TEXT_COLOR = '#F5E9D4';

export interface MuteToastInput {
  id: string | null;
  muted: boolean;
}

interface ActiveToast {
  text: string;
  muted: boolean;
  diesAt: number;
}

export class MuteToasts {
  private active: ActiveToast[] = [];

  size(now: number): number {
    this.prune(now);
    return this.active.length;
  }

  /** Enqueue from a MuteKeybindResult. No-op when id is null/blank. */
  push(result: MuteToastInput, now: number): void {
    if (!result || !result.id) return;
    const name = result.id.trim();
    if (!name) return;
    const text = result.muted ? `muted ${name}` : `unmuted ${name}`;
    this.enqueue(text, result.muted, now);
  }

  /**
   * Enqueue an "unmuted N peers" bulk toast from a handleUnmuteAllKeybind
   * result. No-op when cleared <= 0 so the U key produces silence on an
   * already-empty mute set.
   */
  pushUnmuteAll(cleared: number, now: number): void {
    if (!Number.isFinite(cleared) || cleared <= 0) return;
    const n = Math.floor(cleared);
    const text = n === 1 ? 'unmuted 1 peer' : `unmuted ${n} peers`;
    this.enqueue(text, false, now);
  }

  /**
   * Enqueue a "restored N mutes" bulk toast from a handleRestoreMutesKeybind
   * result. No-op when restored <= 0 so Shift+U on an empty history stack
   * stays silent. Uses the muted accent stripe since restored peers are
   * once again muted.
   */
  pushRestore(restored: number, now: number): void {
    if (!Number.isFinite(restored) || restored <= 0) return;
    const n = Math.floor(restored);
    const text = n === 1 ? 'restored 1 mute' : `restored ${n} mutes`;
    this.enqueue(text, true, now);
  }

  private enqueue(text: string, muted: boolean, now: number): void {
    this.active.push({ text, muted, diesAt: now + TOAST_TTL_MS });
    this.prune(now);
    if (this.active.length > MAX_VISIBLE) {
      this.active.splice(0, this.active.length - MAX_VISIBLE);
    }
  }

  /** Snapshot of currently-visible toast texts. Test helper. */
  list(now: number): string[] {
    this.prune(now);
    return this.active.map((t) => t.text);
  }

  clear(): void {
    this.active = [];
  }

  private prune(now: number): void {
    this.active = this.active.filter((t) => t.diesAt > now);
  }

  draw(ctx: CanvasRenderingContext2D, canvasW: number, now: number): void {
    this.prune(now);
    if (this.active.length === 0) return;

    const badge = peerBadgeRect(canvasW);
    let y = badge.y + badge.h + STACK_OFFSET;
    const x = canvasW - TOAST_W - 8;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.font = 'bold 11px ui-monospace, "SF Mono", Menlo, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    for (const t of this.active) {
      const remaining = t.diesAt - now;
      const alpha = remaining < 500 ? Math.max(0, remaining / 500) : 1;
      ctx.globalAlpha = alpha;

      ctx.fillStyle = PANEL_BG;
      ctx.fillRect(x, y, TOAST_W, TOAST_H);

      ctx.fillStyle = t.muted ? MUTED_ACCENT : UNMUTED_ACCENT;
      ctx.fillRect(x, y, 3, TOAST_H);

      ctx.fillStyle = TEXT_COLOR;
      ctx.fillText(t.text, x + 10, y + TOAST_H / 2 + 1);

      y += TOAST_H + GAP;
    }
    ctx.restore();
  }
}
