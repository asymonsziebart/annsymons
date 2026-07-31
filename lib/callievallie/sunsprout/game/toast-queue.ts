// Toast queue — a small FIFO of recent corner notifications.
//
// Before this module the engine held a SINGLE `toast` string plus a
// `toastFade` timer. Any two notifications that fired on the same frame
// (e.g. "Harvested 4 turnips" + "Heart up with Maple" + an achievement
// unlock) clobbered each other — the player only ever saw the last one
// written that tick. This queue keeps the last few alive at once so a
// busy moment reads as a short stack of messages that age out
// independently, newest on top.
//
// Pure module: no canvas, no IO. The engine pushes strings in, ticks the
// queue each update, and reads `active()` to render the stack. The fade
// math lives here too (`alpha`) so the renderer stays a thin drawing
// layer and the timing is unit-testable.

/** Default lifetime of a toast before it disappears (ms). */
export const TOAST_TTL_MS = 2500;

/** Length of the fade-out tail at the end of a toast's life (ms). */
export const TOAST_FADE_MS = 600;

/** Most toasts shown stacked at once — older ones drop off the bottom. */
export const TOAST_MAX_VISIBLE = 3;

/**
 * Category of a toast, used only for the left colour-rail tint so a busy
 * stack is scannable by hue without reading every line. The text is the
 * source of truth; the kind is a glanceable accent.
 */
export type ToastKind = 'info' | 'money' | 'hearts' | 'achievement';

/**
 * Left-rail accent per kind. Pulled to mirror the rest of the HUD palette:
 *   money       -> the coin gold used in the top bar,
 *   hearts      -> the sage-green "good progress" hue (heatmap / bonus chips),
 *   achievement -> the violet used for the tournament / almanac accents,
 *   info        -> a muted lavender so the three semantic kinds pop past it.
 * Monochrome hex, no emoji (git-safe).
 */
export const TOAST_KIND_COLOR: Record<ToastKind, string> = {
  info: '#9D8FB8',
  money: '#F0C24A',
  hearts: '#A3D77A',
  achievement: '#C8A0E8',
};

/** Rail colour for a kind; falls back to the neutral info rail. Pure. */
export function toastKindColor(kind: ToastKind | undefined): string {
  return TOAST_KIND_COLOR[kind ?? 'info'] ?? TOAST_KIND_COLOR.info;
}

/** A single live notification. */
export interface ToastEntry {
  /** Message text. */
  text: string;
  /** Milliseconds this entry has been alive. */
  ageMs: number;
  /** Total lifetime before it expires. */
  ttlMs: number;
  /** Category accent for the left rail (default 'info'). */
  kind: ToastKind;
}

/**
 * Opacity for an entry in [0,1]. Toasts render at full opacity for most
 * of their life, then fade out over the final TOAST_FADE_MS. A freshly
 * pushed toast is fully opaque immediately (no fade-in) so a single
 * notification still snaps in the way the old single-toast did.
 */
export function toastAlpha(entry: ToastEntry): number {
  const remaining = entry.ttlMs - entry.ageMs;
  if (remaining <= 0) return 0;
  if (remaining >= TOAST_FADE_MS) return 1;
  return Math.max(0, Math.min(1, remaining / TOAST_FADE_MS));
}

/**
 * Length of the abrupt cut at the very end of a toast's life under
 * reduce-motion (ms). Short enough to read as an instant disappear, but
 * non-zero so the pill doesn't pop out one frame early on a slow tick.
 */
export const TOAST_CUT_MS = 80;

/**
 * Opacity for an entry, honouring the player's reduce-motion preference.
 * With motion on, falls through to the standard {@link toastAlpha} fade
 * tail. With motion off (calm mode), the pill holds FULL opacity for its
 * whole life then cuts to 0 over the final {@link TOAST_CUT_MS} — no slow
 * fade to track out of the corner of the eye, mirroring how the rain /
 * snow overlays and the HUD pulses already drop their animation under
 * reduceMotion. Pure + deterministic so a test can pin any age.
 */
export function toastAlphaFor(entry: ToastEntry, reduceMotion: boolean): number {
  if (!reduceMotion) return toastAlpha(entry);
  const remaining = entry.ttlMs - entry.ageMs;
  if (remaining <= 0) return 0;
  if (remaining >= TOAST_CUT_MS) return 1;
  // A tiny linear cut so a single frame landing inside the window isn't a
  // hard pop, but it reads as instant compared to the 600ms motion fade.
  return Math.max(0, Math.min(1, remaining / TOAST_CUT_MS));
}

/**
 * A short ring of recent toasts. Newest-first ordering on read so the
 * freshest message sits at the top of the rendered stack.
 */
export class ToastQueue {
  private entries: ToastEntry[] = [];

  /**
   * Push a new message. Empty / whitespace-only strings are ignored so
   * callers don't have to guard. If the newest live toast carries the
   * exact same text, its age resets instead of stacking a duplicate —
   * this keeps rapid repeats (e.g. mashing a watering can) from walling
   * the screen with identical pills. `kind` tints the left rail (default
   * 'info'); a repeat refresh also adopts the latest kind.
   */
  push(text: string, ttlMs: number = TOAST_TTL_MS, kind: ToastKind = 'info'): void {
    const msg = text.trim();
    if (msg.length === 0) return;
    const newest = this.entries[this.entries.length - 1];
    if (newest && newest.text === msg) {
      newest.ageMs = 0;
      newest.ttlMs = ttlMs;
      newest.kind = kind;
      return;
    }
    this.entries.push({ text: msg, ageMs: 0, ttlMs, kind });
  }

  /** Age every entry by dtMs and drop any that have expired. */
  tick(dtMs: number): void {
    if (this.entries.length === 0) return;
    for (const e of this.entries) {
      e.ageMs += dtMs;
    }
    this.entries = this.entries.filter((e) => e.ageMs < e.ttlMs);
  }

  /**
   * The visible stack, newest first, capped at TOAST_MAX_VISIBLE. Older
   * entries beyond the cap are kept in the queue (they may resurface if a
   * newer one expires) but aren't returned for rendering.
   */
  active(): readonly ToastEntry[] {
    const out: ToastEntry[] = [];
    for (let i = this.entries.length - 1; i >= 0 && out.length < TOAST_MAX_VISIBLE; i--) {
      out.push(this.entries[i]);
    }
    return out;
  }

  /** Text of the freshest live toast, or null when the queue is empty. */
  latest(): string | null {
    const e = this.entries[this.entries.length - 1];
    return e ? e.text : null;
  }

  /** Total entries currently held (including those past the visible cap). */
  get size(): number {
    return this.entries.length;
  }

  /** Drop everything immediately. */
  clear(): void {
    this.entries = [];
  }
}

/**
 * Infer a toast's category from its message text so the engine's ~100
 * `setToast` call sites don't each have to pass a kind. Heuristics only —
 * the rail is a glanceable accent, not load-bearing — so a miss just falls
 * back to the neutral 'info' rail. Checked achievement-first (most specific
 * phrase) then hearts then money so "Heart up... +120g" reads as hearts.
 */
export function classifyToast(text: string): ToastKind {
  const t = text.toLowerCase();
  if (t.includes('achievement') || t.includes('unlocked') || t.includes('ribbon')) {
    return 'achievement';
  }
  if (t.includes('heart') || t.includes('friendship') || t.includes('birthday')) {
    return 'hearts';
  }
  // A signed or bare gold amount: "+120g", "-40g", "612g", "spent 80g".
  if (/[+-]?\d+\s*g\b/.test(t) || t.includes('gold') || t.includes('sold')) {
    return 'money';
  }
  return 'info';
}
