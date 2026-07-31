// NPC routes — multi-waypoint schedule slots so the village reads as
// alive instead of frozen.
//
// The existing `npcs.ts` schedule keeps each NPC anchored to a single
// (x,y) inside their current hour window — Vallie stands at her counter,
// Finn at the pond, etc. The village reads as a still-life because
// nobody moves between adjacent activities. This module gives each
// slot the option of a second waypoint and a per-cycle period so the
// NPC visibly paces back and forth across the hour window.
//
// Pure module: no DOM, no canvas. The Game's `updateNPCs` wiring in
// npcs.ts already routes anchors through getCurrentAnchor — we extend
// the same function to optionally interpolate between waypoints based
// on the current minute-of-day.
//
// Design intent:
//   - Backwards-compatible: a schedule slot WITHOUT a `walkTo` field
//     behaves identically to before (single static anchor).
//   - Deterministic: anchor is a pure function of (hour, minute) so
//     the NPC always reaches the same spot at the same in-game time.
//   - Lightweight: we lerp position via cosine wave so the NPC eases
//     to each end of the route rather than abruptly snapping.

/** A computed anchor — what the NPC is heading toward right now. */
export interface RouteAnchor {
  x: number;
  y: number;
}

/** Tunable: how many in-game hours one full A->B->A cycle takes. */
export const DEFAULT_ROUTE_PERIOD_HOURS = 2;

/**
 * Compute the live anchor for a slot that carries a walkTo waypoint.
 *
 * `from` is the slot's primary (x, y); `to` is the optional secondary
 * (x, y). `hour` + `minute` is the current in-game time. The NPC
 * oscillates between from->to->from on a cosine wave with period
 * `periodHours` (default DEFAULT_ROUTE_PERIOD_HOURS). Returns `from`
 * unchanged when `to` is undefined.
 */
export function routeAnchor(
  from: RouteAnchor,
  to: RouteAnchor | undefined,
  hour: number,
  minute: number,
  periodHours: number = DEFAULT_ROUTE_PERIOD_HOURS,
): RouteAnchor {
  if (!to) return from;
  if (periodHours <= 0) return from;
  // Phase in [0, 1) across one full A->B->A cycle.
  const elapsedHours = hour + minute / 60;
  const phase = (elapsedHours / periodHours) % 1;
  // Cosine wave: phase 0 = at A (0), phase 0.5 = at B (1), phase 1 = at A (0).
  const t = 0.5 - 0.5 * Math.cos(phase * Math.PI * 2);
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

/** Compute the integer-rounded "where is NPC right now" for hit-testing. */
export function routeAnchorRounded(
  from: RouteAnchor,
  to: RouteAnchor | undefined,
  hour: number,
  minute: number,
  periodHours: number = DEFAULT_ROUTE_PERIOD_HOURS,
): { x: number; y: number } {
  const a = routeAnchor(from, to, hour, minute, periodHours);
  return { x: Math.round(a.x), y: Math.round(a.y) };
}

/** True if the NPC is currently roughly at the `to` endpoint. */
export function isAtRouteEndpoint(
  from: RouteAnchor,
  to: RouteAnchor | undefined,
  hour: number,
  minute: number,
  periodHours: number = DEFAULT_ROUTE_PERIOD_HOURS,
  epsilon: number = 0.25,
): boolean {
  if (!to) return false;
  const a = routeAnchor(from, to, hour, minute, periodHours);
  const dx = a.x - to.x;
  const dy = a.y - to.y;
  return Math.hypot(dx, dy) < epsilon;
}
