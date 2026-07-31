// Roster tone classifier — v0.6.0 slice.
//
// Tiny pure helper over RosterSummary that buckets the co-op vibe into one of
// four tones the HUD can tint by:
//
//   'solo'       → nobody around, no stale ghosts
//   'stale-only' → only ghost peers (recently-dropped sessions) linger
//   'calm'       → 1-2 live peers nearby
//   'busy'       → 3+ live peers nearby
//
// Kept separate from peer-roster-summary so the summary stays a pure data
// reducer and tinting decisions live in their own diffable unit.

import type { RosterSummary } from './peer-roster-summary';

export type RosterTone = 'solo' | 'stale-only' | 'calm' | 'busy';

const BUSY_THRESHOLD = 3;

export function rosterTone(s: RosterSummary): RosterTone {
  if (s.liveCount >= BUSY_THRESHOLD) return 'busy';
  if (s.liveCount > 0) return 'calm';
  if (s.staleCount > 0) return 'stale-only';
  return 'solo';
}
