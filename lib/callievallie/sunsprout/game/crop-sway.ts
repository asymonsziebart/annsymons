// Crop sway — a gentle wind animation for grown crop sprites.
//
// A still field reads as a lifeless field. This module computes a tiny
// horizontal offset (in pixels) for the LEAFY TOP of a crop sprite so a
// grown plant rocks softly as if a breeze passed through. The base/stem
// stays anchored; only the canopy + fruit drift, the way a real stalk
// bends from the root up.
//
// Pure math, no canvas: the renderer reads the offset per crop per frame
// and shifts the upper pixels by it. Two design rules keep it cozy not
// busy:
//   1. Per-tile phase — neighbouring crops sway out of sync so the field
//      ripples instead of marching in lockstep.
//   2. Stage gating — seeds and fresh sprouts don't sway (nothing's there
//      to catch the wind yet); mid plants sway a little, ripe ones most.
//
// Reduce-motion returns a flat 0 so the accessibility setting calms the
// field exactly like it already calms rain / snow / the HUD pulses.

/** Full sway cycle length. ~2.8s reads as a slow breeze, not a flutter. */
export const SWAY_PERIOD_MS = 2800;

/**
 * Peak horizontal drift (px) for each rendered crop stage. The renderer
 * collapses every crop into four visual stages (0 seed, 1 sprout, 2 mid,
 * 3 ripe); only the leafy ones catch the wind. Kept sub-2px so the pixel
 * art never tears — the canopy leans, it doesn't slide.
 */
export function swayAmplitude(stage: number): number {
  if (stage >= 3) return 1.6;
  if (stage === 2) return 0.9;
  return 0; // seed / sprout: nothing to sway yet.
}

/**
 * Horizontal sway offset (px) for the canopy of the crop at tile
 * (tileX, tileY) at time `nowMs`. Deterministic for a given
 * (tile, stage, time): a sine wave whose phase is offset per tile so the
 * field ripples. Returns 0 under reduce-motion and for un-grown stages.
 *
 * The caller adds Math.round(offset) to the x of the crop's upper pixels.
 */
export function cropSwayOffset(
  tileX: number,
  tileY: number,
  stage: number,
  nowMs: number,
  reduceMotion: boolean = false,
): number {
  if (reduceMotion) return 0;
  const amp = swayAmplitude(stage);
  if (amp === 0) return 0;
  // Per-tile phase: a cheap hash of the tile coords spreads neighbours
  // across the cycle so they don't all peak together. The irrational-ish
  // multipliers keep rows + columns from aliasing into a visible grid.
  const phase = tileX * 0.7 + tileY * 1.3;
  const t = (nowMs / SWAY_PERIOD_MS) * Math.PI * 2;
  return amp * Math.sin(t + phase);
}
