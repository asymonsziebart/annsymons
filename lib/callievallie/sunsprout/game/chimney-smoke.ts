// Chimney smoke — a soft wisp rising from the farmhouse hearth.
//
// A cozy home reads as a LIVED-IN home, and nothing says "someone's
// warm inside" like a thread of smoke from the chimney. But a chimney
// that smokes at high-summer noon looks wrong, so the hearth is
// RESPONSIVE: it only lights when it would naturally be lit — in the
// cold of Winter, in the dark/cold hours of the morning + evening, or
// when rain / a storm has driven the player indoors. The rest of the
// time the chimney sits quiet.
//
// Pure particle math here (deterministic, unit-testable); the engine
// owns the wall-clock and the screen-space chimney origin and calls
// drawChimneySmoke each frame. Mirrors the rain / snow / confetti
// overlay split so the call site stays symmetrical.
//
// Reduce-motion: instead of deleting the feature (which would make the
// home read as cold for calm-mode players) the module returns a short
// FROZEN wisp — the hearth still reads as lit, it just doesn't move,
// exactly the way crop-sway holds the canopy still rather than vanishing.

import type { TimeOfDay } from './time';
import { isFrozenSeason } from './winter';
import { weatherToday, WEATHER } from './weather';

/** Full lifecycle of one smoke puff (ms). ~3.4s reads as a slow curl. */
export const SMOKE_PERIOD_MS = 3400;

/** Puffs alive in the column at once. Modest so the wisp stays a thread. */
export const SMOKE_PUFF_COUNT = 5;

/** How far (px) a puff rises before it has fully dissipated. */
export const SMOKE_RISE_HEIGHT = 30;

/** Soft hearth-smoke greys — warm-tinted, monochrome hex (git-safe). */
export const SMOKE_COLORS = ['#C9C2CC', '#B4ACBA', '#9D95A8'] as const;

/** Hour before which (morning) and at/after which (evening) the hearth is lit. */
export const HEARTH_MORNING_HOUR = 8;
export const HEARTH_EVENING_HOUR = 18;

/** A single smoke puff's render state at a moment in its rise. */
export interface SmokePuff {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
}

/**
 * Is the farmhouse hearth lit right now? True in Winter, OR in the cold
 * dark hours (before {@link HEARTH_MORNING_HOUR} or at/after
 * {@link HEARTH_EVENING_HOUR}), OR whenever the active weather drops water
 * (rain / storm drove the player in to warm up). Pure — derived entirely
 * from the clock + the deterministic weather, no stored state.
 */
export function hearthLit(time: TimeOfDay): boolean {
  if (isFrozenSeason(time)) return true;
  if (time.hour < HEARTH_MORNING_HOUR || time.hour >= HEARTH_EVENING_HOUR) return true;
  return WEATHER[weatherToday(time)].watersCrops;
}

/**
 * Shape one puff at lifecycle phase `t` in [0,1) around the chimney top
 * (ox, oy) in screen space. Phase 0 = just leaving the chimney (small,
 * faint, near the lip); rising t lifts + grows + drifts the puff and
 * fades it back out as it dissipates. alpha follows sin(pi*t) so a puff
 * appears, solidifies mid-rise, then thins to nothing at the top.
 */
function puffAt(t: number, ox: number, oy: number, idx: number): SmokePuff {
  const y = oy - t * SMOKE_RISE_HEIGHT;
  // Drift grows with height — the higher the wisp, the more the breeze
  // catches it. Per-puff phase offset so the column curls, not slides.
  const driftAmp = 1.5 + t * 5;
  const x = ox + driftAmp * Math.sin(t * Math.PI * 1.5 + idx);
  const size = 2 + Math.round(t * 2); // 2px at the lip -> 4px as it spreads
  const alpha = 0.55 * Math.sin(Math.PI * t); // 0 at both ends, peak mid-rise
  const color = SMOKE_COLORS[idx % SMOKE_COLORS.length];
  return { x, y, size, color, alpha };
}

/**
 * The smoke puffs above a chimney at screen-space (ox, oy) at time
 * `nowMs`. Deterministic for a given (nowMs, origin). Each of
 * {@link SMOKE_PUFF_COUNT} puffs is staggered evenly through the rise so
 * the thread reads as continuous. Under `reduceMotion` the clock is
 * ignored and a short frozen wisp (three fixed puffs) is returned so the
 * hearth still reads as lit without any animation.
 */
export function chimneySmoke(
  nowMs: number,
  ox: number,
  oy: number,
  reduceMotion: boolean = false,
): SmokePuff[] {
  if (reduceMotion) {
    // A still, legible thread: low / mid / high, fixed alphas.
    return [0.2, 0.45, 0.72].map((t, i) => puffAt(t, ox, oy, i));
  }
  const out: SmokePuff[] = [];
  for (let i = 0; i < SMOKE_PUFF_COUNT; i++) {
    // Even phase spacing + per-puff offset, wrapped into [0,1).
    const t = (((nowMs / SMOKE_PERIOD_MS) + i / SMOKE_PUFF_COUNT) % 1 + 1) % 1;
    out.push(puffAt(t, ox, oy, i));
  }
  return out;
}

/**
 * Draw the chimney wisp. Thin consumer of {@link chimneySmoke}; no-op when
 * the hearth is unlit. The caller passes the screen-space chimney top and
 * the reduce-motion flag. Puffs are drawn as soft stacked pixel squares.
 */
export function drawChimneySmoke(
  ctx: CanvasRenderingContext2D,
  time: TimeOfDay,
  ox: number,
  oy: number,
  nowMs: number,
  reduceMotion: boolean = false,
): void {
  if (!hearthLit(time)) return;
  const puffs = chimneySmoke(nowMs, ox, oy, reduceMotion);
  ctx.save();
  for (const p of puffs) {
    if (p.alpha <= 0) continue;
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    const half = Math.floor(p.size / 2);
    ctx.fillRect(Math.round(p.x) - half, Math.round(p.y) - half, p.size, p.size);
  }
  ctx.restore();
}
