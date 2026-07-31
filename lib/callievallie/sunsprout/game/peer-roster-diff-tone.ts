// Multiplayer roster diff tone — v0.6.0 slice.
//
// Pure helper that buckets a RosterDiff into a tone label the HUD can use to
// briefly flash the roster subtitle when membership shifts. Sibling to
// peer-roster-tone (which classifies the steady-state roster); this one
// classifies the *change* between two frames.
//
// Tones:
//   'none'       → diff is empty, nothing changed
//   'arrivals'   → only joins / went-live (positive vibe)
//   'departures' → only leaves / went-stale (sad vibe)
//   'liveness'   → only live↔stale flips, no join/leave (neutral churn)
//   'churn'      → mixed positive + negative deltas

import type { RosterDiff } from './peer-roster-diff';
import { rosterDiffIsEmpty } from './peer-roster-diff';

export type RosterDiffTone = 'none' | 'arrivals' | 'departures' | 'liveness' | 'churn';

export function rosterDiffTone(d: RosterDiff): RosterDiffTone {
  if (rosterDiffIsEmpty(d)) return 'none';
  const positive = d.arrived.length > 0 || d.wentLive.length > 0;
  const negative = d.departed.length > 0 || d.wentStale.length > 0;
  if (positive && negative) return 'churn';
  if (positive) return 'arrivals';
  if (negative) return 'departures';
  // Unreachable given rosterDiffIsEmpty above, but keeps the union exhaustive.
  return 'liveness';
}
