// Roster diff flash label — v0.6.0 slice.
//
// Pure helper that maps a RosterDiffTone to the short headline word the HUD
// will overlay on top of the subtitle for one beat when membership shifts.
// Sibling to rosterDiffTonePalette (colour) — this one is the verb.
//
// Kept extremely terse on purpose: the flash is a single beat, the eye only
// has time to read one word before it fades. Longer prose belongs in the
// subtitle text underneath.
//
// Label intent:
//   none       → '' (caller skips the flash)
//   arrivals   → 'joined'
//   departures → 'left'
//   liveness   → 'stirring'
//   churn      → 'busy'

import type { RosterDiffTone } from '../game/peer-roster-diff-tone';

export function rosterDiffFlashLabel(tone: RosterDiffTone): string {
  switch (tone) {
    case 'arrivals':
      return 'joined';
    case 'departures':
      return 'left';
    case 'liveness':
      return 'stirring';
    case 'churn':
      return 'busy';
    case 'none':
    default:
      return '';
  }
}
