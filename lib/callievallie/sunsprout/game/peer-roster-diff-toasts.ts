// Multiplayer roster diff toasts — v0.6.0 slice.
//
// Pure formatter that turns a RosterDiff into a short, ordered list of toast
// lines for the HUD: "Ada joined", "Beatrix left", "Cleo went quiet",
// "Dora is back". A name lookup is taken as a function so callers can resolve
// against the live RosterEntry[] or any other source; ids without a known name
// fall back to a shortened id slice so toasts never go blank.
//
// Order is stable: arrivals → returns (wentLive) → quiets (wentStale) →
// departures. This keeps the toast stack readable when many things change in
// the same frame (e.g. tab-switch back to a busy farm).

import type { RosterDiff } from './peer-roster-diff';

export type RosterNameLookup = (id: string) => string | undefined;

export interface RosterToast {
  id: string;
  kind: 'arrived' | 'wentLive' | 'wentStale' | 'departed';
  text: string;
}

function nameOf(id: string, lookup: RosterNameLookup): string {
  const n = lookup(id);
  if (n && n.length > 0) return n;
  // Short fallback so toasts stay readable for unknown peers.
  return id.length > 6 ? id.slice(0, 6) : id;
}

export function rosterDiffToToasts(
  diff: RosterDiff,
  lookup: RosterNameLookup,
): RosterToast[] {
  const out: RosterToast[] = [];
  for (const id of diff.arrived) {
    out.push({ id, kind: 'arrived', text: `${nameOf(id, lookup)} joined` });
  }
  for (const id of diff.wentLive) {
    out.push({ id, kind: 'wentLive', text: `${nameOf(id, lookup)} is back` });
  }
  for (const id of diff.wentStale) {
    out.push({ id, kind: 'wentStale', text: `${nameOf(id, lookup)} went quiet` });
  }
  for (const id of diff.departed) {
    out.push({ id, kind: 'departed', text: `${nameOf(id, lookup)} left` });
  }
  return out;
}
