// Multiplayer roster diff — v0.6.0 slice.
//
// Pure helper that compares two consecutive RosterEntry snapshots and reports
// who arrived, who departed, and who flipped live/stale between frames. This
// is the seed for future "Ada joined", "Beatrix went quiet" toast wiring.
//
// Sets are returned as deterministic, sorted id arrays so tests stay tidy
// and downstream consumers can render them without re-sorting.

import type { RosterEntry } from './peer-roster';

export interface RosterDiff {
  /** Peers present in `next` but not `prev`. */
  arrived: string[];
  /** Peers present in `prev` but not `next`. */
  departed: string[];
  /** Peers that were stale in `prev` and live in `next`. */
  wentLive: string[];
  /** Peers that were live in `prev` and stale in `next`. */
  wentStale: string[];
}

export function diffRoster(
  prev: readonly RosterEntry[],
  next: readonly RosterEntry[],
): RosterDiff {
  const prevById = new Map(prev.map((e) => [e.id, e] as const));
  const nextById = new Map(next.map((e) => [e.id, e] as const));

  const arrived: string[] = [];
  const departed: string[] = [];
  const wentLive: string[] = [];
  const wentStale: string[] = [];

  for (const [id, n] of nextById) {
    const p = prevById.get(id);
    if (!p) {
      arrived.push(id);
      continue;
    }
    if (!p.live && n.live) wentLive.push(id);
    else if (p.live && !n.live) wentStale.push(id);
  }
  for (const id of prevById.keys()) {
    if (!nextById.has(id)) departed.push(id);
  }

  arrived.sort();
  departed.sort();
  wentLive.sort();
  wentStale.sort();
  return { arrived, departed, wentLive, wentStale };
}

/** True when nothing changed — handy for caller-side change gating. */
export function rosterDiffIsEmpty(d: RosterDiff): boolean {
  return (
    d.arrived.length === 0 &&
    d.departed.length === 0 &&
    d.wentLive.length === 0 &&
    d.wentStale.length === 0
  );
}
