// Multiplayer roster diff summary — v0.6.0 slice.
//
// Pure helper that collapses a RosterDiff into a single, compact HUD subtitle
// fragment like "+2 joined · 1 left · 1 quiet". The roster *toasts* helper
// already turns each delta into a named line ("Ada joined"); this helper is
// for the inverse case where we only want a one-line summary in the roster
// subtitle strip when several things change at once.
//
// Ordering of fragments is stable: arrived → wentLive → wentStale → departed.
// Empty diffs return an empty string so callers can `if (summary)` cheaply.

import type { RosterDiff } from './peer-roster-diff';

export function summarizeRosterDiff(diff: RosterDiff): string {
  const parts: string[] = [];
  if (diff.arrived.length > 0) parts.push(`+${diff.arrived.length} joined`);
  if (diff.wentLive.length > 0) parts.push(`${diff.wentLive.length} back`);
  if (diff.wentStale.length > 0) parts.push(`${diff.wentStale.length} quiet`);
  if (diff.departed.length > 0) parts.push(`${diff.departed.length} left`);
  return parts.join(' · ');
}
