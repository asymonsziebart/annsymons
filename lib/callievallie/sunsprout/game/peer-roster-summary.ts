// Multiplayer co-op roster summary — v0.6.0 slice.
//
// Pure aggregator over RosterEntry[] (from buildPeerRoster) that condenses
// the list down to a tiny tuple the HUD can render as a one-line subtitle
// under the peer badge: "3 nearby · 1 stale · nearest 2t".
//
// Kept separate from peer-roster.ts so the roster builder stays focused on
// sorting/filtering and the summary stays trivially diffable.

import type { RosterEntry } from './peer-roster';
import { formatRosterDistance } from './peer-roster';

export interface RosterSummary {
  liveCount: number;
  staleCount: number;
  /** Nearest live peer's tile distance, or null when no live peers. */
  nearestDistance: number | null;
}

export function summarizeRoster(entries: readonly RosterEntry[]): RosterSummary {
  let liveCount = 0;
  let staleCount = 0;
  let nearest: number | null = null;
  for (const e of entries) {
    if (e.live) {
      liveCount++;
      if (nearest === null || e.distance < nearest) nearest = e.distance;
    } else {
      staleCount++;
    }
  }
  return { liveCount, staleCount, nearestDistance: nearest };
}

/**
 * Render the summary as a short HUD subtitle. Empty string when nobody is
 * around, so the caller can skip drawing entirely.
 *
 * Examples:
 *   "3 nearby · nearest 2t"
 *   "1 nearby · 2 stale · nearest here"
 *   "2 stale"
 */
export function formatRosterSummary(s: RosterSummary): string {
  const parts: string[] = [];
  if (s.liveCount > 0) parts.push(`${s.liveCount} nearby`);
  if (s.staleCount > 0) parts.push(`${s.staleCount} stale`);
  if (s.nearestDistance !== null) {
    parts.push(`nearest ${formatRosterDistance(s.nearestDistance)}`);
  }
  return parts.join(' · ');
}
