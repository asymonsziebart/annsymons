// Multiplayer co-op roster — v0.6.0 next slice.
//
// Pure helper that turns a PeerRegistry snapshot into a sorted "roster" the
// HUD can render: nearest peer first, with distance and a freshness flag.
// No DOM, no canvas — UI layer comes later. Keeps the slice tiny and tested.
//
// Sort order:
//   1. Live peers (lastSeenAt within `staleAfterMs`) before stale ones.
//   2. Then by Chebyshev tile distance to the local player ascending.
//   3. Ties broken by name (case-insensitive) for deterministic output.

import type { PeerPlayer } from './multiplayer';

/** A peer as the roster UI wants to see them. */
export interface RosterEntry {
  id: string;
  name: string;
  color: string;
  /** Chebyshev tile distance from the local player. */
  distance: number;
  /** Whether we've heard from them recently. */
  live: boolean;
}

export interface BuildRosterOpts {
  /** Local player tile coords — used as the distance origin. */
  localX: number;
  localY: number;
  /** Current ms timestamp for liveness check. */
  now: number;
  /** Peers older than this are flagged stale (but still listed). */
  staleAfterMs?: number;
  /** Cap the returned list size; default 8 (fits the HUD panel). */
  limit?: number;
}

const DEFAULT_STALE_MS = 3000;
const DEFAULT_LIMIT = 8;

export function buildPeerRoster(
  peers: readonly PeerPlayer[],
  opts: BuildRosterOpts,
): RosterEntry[] {
  const staleAfter = opts.staleAfterMs ?? DEFAULT_STALE_MS;
  const limit = Math.max(0, opts.limit ?? DEFAULT_LIMIT);
  const entries: RosterEntry[] = peers.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    distance: chebyshev(p.x - opts.localX, p.y - opts.localY),
    live: opts.now - p.lastSeenAt <= staleAfter,
  }));
  entries.sort((a, b) => {
    if (a.live !== b.live) return a.live ? -1 : 1;
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
  return entries.slice(0, limit);
}

/** Format a distance for the HUD: "here", "3t", "12t", or ">99t". */
export function formatRosterDistance(d: number): string {
  if (d <= 0) return 'here';
  if (d > 99) return '>99t';
  return `${Math.round(d)}t`;
}

function chebyshev(dx: number, dy: number): number {
  return Math.max(Math.abs(dx), Math.abs(dy));
}
