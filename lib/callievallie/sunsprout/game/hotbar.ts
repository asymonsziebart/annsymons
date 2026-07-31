// Hotbar model — pure logic for the bottom seed/can hotbar so the HUD
// widget stays a thin draw layer. Right now it owns the "low seed stock"
// warning: when a seed slot is running empty the widget pulses its border
// amber so the player notices BEFORE they walk up to a tilled tile and
// press a plant key that does nothing.
//
// Pure module: a count + a selected flag in, a small warning descriptor
// out. No canvas, no Player access beyond the count the widget reads.

/** Severity of a hotbar slot's stock warning. */
export type SeedWarnLevel = 'none' | 'low' | 'empty';

/** Threshold at or below which a non-empty seed stack is "low". */
export const SEED_LOW_THRESHOLD = 1;

/**
 * Classify a seed slot's stock level:
 *   count <= 0                 -> 'empty'  (can't plant at all)
 *   count <= SEED_LOW_THRESHOLD -> 'low'   (one planting left)
 *   else                        -> 'none'
 *
 * The watering-can slot has no stock, so callers skip it (pass a level
 * of 'none' for it). Pure.
 */
export function seedWarnLevel(count: number): SeedWarnLevel {
  if (count <= 0) return 'empty';
  if (count <= SEED_LOW_THRESHOLD) return 'low';
  return 'none';
}

/**
 * Pulse strength in [0,1] for a warning border at time `nowMs`, or 0 when
 * the level is 'none'. A sine breathe so the amber border swells rather
 * than blinks; 'empty' pulses a touch stronger and faster than 'low' so a
 * fully-spent stack reads as more urgent. `PERIOD_MS` keeps it calm.
 *
 * Pure + deterministic in nowMs so a test can pin a phase without a clock.
 */
export const SEED_PULSE_PERIOD_MS = 900;

export function seedWarnPulse(level: SeedWarnLevel, nowMs: number): number {
  if (level === 'none') return 0;
  const period = level === 'empty' ? SEED_PULSE_PERIOD_MS * 0.7 : SEED_PULSE_PERIOD_MS;
  const phase = ((nowMs % period) / period) * Math.PI * 2;
  const breathe = 0.5 + 0.5 * Math.sin(phase); // 0..1
  // Empty floors brighter (never fully fades) so it stays insistent.
  const floor = level === 'empty' ? 0.45 : 0.2;
  return floor + (1 - floor) * breathe;
}

/**
 * Steady (non-animated) intensity for a warning border when the player
 * has asked for reduced motion. Returns a constant per level — no sine,
 * no clock — so the amber border still clearly marks the slot but holds
 * still. 'empty' sits brighter than 'low' to preserve the urgency
 * ordering. Mirrors how the rain/snow overlays skip animating under
 * reduceMotion while still conveying their state.
 */
export const SEED_STEADY_LOW = 0.7;
export const SEED_STEADY_EMPTY = 0.9;

export function seedWarnSteady(level: SeedWarnLevel): number {
  if (level === 'empty') return SEED_STEADY_EMPTY;
  if (level === 'low') return SEED_STEADY_LOW;
  return 0;
}

/**
 * The border intensity to actually draw for a slot, picking the steady
 * value under reduceMotion and the animated breathe otherwise. The single
 * entry point the widget calls so the motion decision lives here, tested,
 * not in the canvas layer.
 */
export function seedWarnIntensity(
  level: SeedWarnLevel,
  nowMs: number,
  reduceMotion: boolean,
): number {
  return reduceMotion ? seedWarnSteady(level) : seedWarnPulse(level, nowMs);
}

/** Amber the warning border lerps toward. Shared by widget + tests. */
export const SEED_WARN_COLOR = '#F0A828';
