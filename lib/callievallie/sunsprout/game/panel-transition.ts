// Panel open micro-transition — a short, reduce-motion-gated ease the
// whole panel family shares on open, so overlays glide in instead of
// snapping.
//
// Every panel already runs a brief open() lockout (lockoutMs, ~160ms) that
// swallows the opening frame's input so the toggle key can't immediately
// re-close it. That same countdown is a free animation clock: as it ticks
// from OPEN_LOCKOUT_MS down to 0, this maps it onto an eased alpha ramp the
// panel applies via ctx.globalAlpha, fading the overlay in over its first
// ~160ms. The panel restores its canvas state afterwards, so the alpha is
// scoped to that panel's draw.
//
// Pure: no canvas, no engine imports. Given the live lockout remaining +
// the reduce-motion flag, returns the alpha to draw at. Under reduce-motion
// (or once the lockout has elapsed) it returns 1.0 so the panel is solid.

/** The lockout every panel arms in open(); also the fade duration. */
export const OPEN_LOCKOUT_MS = 160;

/**
 * The slightly longer lockout the modal MENUS (shop / cart / cooking /
 * chest / bench / owl) arm in open(). They swallow a touch more of the
 * opening window than the info panels because a buy/craft confirm is a
 * heavier action than a glance. Used as the fade duration so the modal
 * eases in across exactly its own lockout.
 */
export const MODAL_OPEN_LOCKOUT_MS = 180;

/** Floor alpha at the very first opening frame, so the panel never starts
 * fully invisible (it reads as a quick fade-up from a faint ghost, not a
 * pop from nothing). */
export const PANEL_OPEN_MIN_ALPHA = 0.35;

/** Smoothstep ease (3t^2 - 2t^3) over a clamped 0..1 progress. */
function smoothstep(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/**
 * The alpha a panel should draw at given its remaining open-lockout. As
 * `lockoutMs` falls from OPEN_LOCKOUT_MS to 0 the progress runs 0 -> 1 and
 * the eased alpha runs PANEL_OPEN_MIN_ALPHA -> 1.0, so the overlay fades up
 * over its opening window. Returns exactly 1.0 when:
 *   - `reduceMotion` is set (calm mode snaps the panel in, no fade), or
 *   - `lockoutMs <= 0` (the panel is past its opening window — fully solid).
 *
 * Defensive on a lockout somehow larger than the nominal duration (clamps
 * progress to 0) and on a custom `durationMs` of 0 (treats any positive
 * remaining lockout as the first frame). Pure.
 */
export function panelOpenAlpha(
  lockoutMs: number,
  reduceMotion: boolean = false,
  durationMs: number = OPEN_LOCKOUT_MS,
): number {
  if (reduceMotion) return 1;
  if (lockoutMs <= 0) return 1;
  if (durationMs <= 0) return 1;
  // Progress through the open window: 0 at the first frame (full lockout
  // remaining), 1 as the lockout reaches 0.
  const progress = (durationMs - lockoutMs) / durationMs;
  const eased = smoothstep(progress);
  return PANEL_OPEN_MIN_ALPHA + (1 - PANEL_OPEN_MIN_ALPHA) * eased;
}
