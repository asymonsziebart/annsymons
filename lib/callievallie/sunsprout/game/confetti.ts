// Confetti — a brief celebratory pixel burst on the dawn of a festival or
// an NPC birthday. The game already announces these days with a banner,
// but a banner is easy to miss; a short fall of confetti makes the special
// day land with a beat the way the sleep summary or a heart-up does.
//
// Pure particle math here (deterministic, unit-testable); the engine owns
// the wall-clock timer that decides WHEN the burst plays and calls
// drawConfettiOverlay each frame while it's active. Mirrors the
// rain / snow overlay split so the call site stays symmetrical.
//
// Reduce-motion: the engine skips the draw entirely (same rule as rain /
// snow / the HUD pulses), so the accessibility setting silences it.

import type { TimeOfDay } from './time';
import { festivalToday } from './festivals';
import { birthdayCelebrant } from './birthdays';

/** How long a single burst plays (ms) before it settles. ~2.6s. */
export const CONFETTI_DURATION_MS = 2600;

/** Number of confetti pieces in a burst. Modest so old laptops stay smooth. */
export const CONFETTI_COUNT = 70;

/**
 * Festive ribbon palette — warm + bright, drawn from the cozy HUD hues
 * (coin gold, heart pink, sage, lavender accent, sky blue). Monochrome
 * hex, no emoji — git-safe and pixel-friendly.
 */
export const CONFETTI_COLORS = [
  '#F0C24A', // coin gold
  '#E47ACF', // flower pink
  '#7CC55C', // sage green
  '#C8A0E8', // lavender accent
  '#7BB3DA', // sky blue
  '#F5C9A0', // warm peach
] as const;

/** A single confetti piece's render state at a moment in the burst. */
export interface ConfettiPiece {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
}

/**
 * A stable per-index pseudo-random in [0,1). Cheap hash so a piece keeps
 * the same spawn column / drift / colour for the whole burst without
 * storing any state — the burst is fully reproducible from elapsed time.
 */
function rand01(i: number, salt: number): number {
  const v = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * The confetti pieces visible `elapsedMs` into a burst over a
 * canvasW x canvasH screen. Deterministic for a given
 * (elapsedMs, canvas size). Each piece spawns above the top edge, falls
 * at its own speed, drifts sideways on a sine wave, and fades out over
 * the final third of the burst. Pieces that have fallen past the bottom
 * (or before the burst began) are omitted.
 */
export function confettiParticles(
  elapsedMs: number,
  canvasW: number,
  canvasH: number,
): ConfettiPiece[] {
  if (elapsedMs < 0 || elapsedMs > CONFETTI_DURATION_MS) return [];
  const out: ConfettiPiece[] = [];
  // Global fade: full opacity for the first two-thirds, easing to 0 at the end.
  const fadeStart = CONFETTI_DURATION_MS * (2 / 3);
  const globalFade =
    elapsedMs <= fadeStart
      ? 1
      : Math.max(0, 1 - (elapsedMs - fadeStart) / (CONFETTI_DURATION_MS - fadeStart));

  for (let i = 0; i < CONFETTI_COUNT; i++) {
    const spawnX = rand01(i, 1) * canvasW;
    // Stagger spawn so the burst showers in over the first ~600ms rather
    // than all pieces dropping on the same line.
    const delay = rand01(i, 2) * 600;
    const t = elapsedMs - delay;
    if (t < 0) continue;
    // Fall speed varies per piece; tuned so the slowest still clears the
    // screen by the end of the burst on a typical canvas height.
    const speed = (canvasH + 60) / (CONFETTI_DURATION_MS * (0.7 + rand01(i, 3) * 0.5));
    const y = -20 + t * speed;
    if (y > canvasH) continue;
    // Sideways drift: a slow sway so pieces flutter rather than drop straight.
    const driftAmp = 6 + rand01(i, 4) * 10;
    const driftFreq = 0.004 + rand01(i, 5) * 0.004;
    const x = spawnX + driftAmp * Math.sin(t * driftFreq + i);
    const size = rand01(i, 6) < 0.5 ? 2 : 3;
    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    out.push({ x, y, size, color, alpha: globalFade });
  }
  return out;
}

/**
 * A stable per-day key when today is a festival or a birthday, else null.
 * The engine compares this frame-to-frame: when it changes from null to a
 * key (the player arrives on a special day), it starts a fresh burst.
 */
export function celebrationDayKey(time: TimeOfDay): string | null {
  if (festivalToday(time)) return `fest-${time.season}-${time.day}`;
  const npc = birthdayCelebrant(time);
  if (npc) return `bday-${npc}-${time.season}-${time.day}`;
  return null;
}

/**
 * Draw the confetti burst. Thin consumer of confettiParticles — the engine
 * passes the elapsed time since the burst began. No-op when the burst is
 * over (empty particle list). The caller is responsible for skipping this
 * entirely when reduce-motion is on.
 */
export function drawConfettiOverlay(
  ctx: CanvasRenderingContext2D,
  elapsedMs: number,
  canvasW: number,
  canvasH: number,
): void {
  const pieces = confettiParticles(elapsedMs, canvasW, canvasH);
  if (pieces.length === 0) return;
  ctx.save();
  for (const p of pieces) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
  }
  ctx.restore();
}
