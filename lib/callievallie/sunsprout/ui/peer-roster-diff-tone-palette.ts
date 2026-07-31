// Roster diff tone palette — v0.6.0 slice.
//
// Maps a RosterDiffTone ('none' | 'arrivals' | 'departures' | 'liveness' |
// 'churn') to the flash colour the HUD subtitle will pulse with for a beat
// when membership shifts.
//
// Sibling to rosterTonePalette (steady-state). This one is the transient
// flash — slightly more saturated so the eye catches the change against
// the steady tint underneath. Kept as a pure lookup so the render layer
// stays dumb and re-themes happen in one place.
//
// Palette intent:
//   none       → transparent / no-op (caller skips the flash)
//   arrivals   → bright sprout-green pulse ("someone joined")
//   departures → muted dusk-violet pulse ("someone left")
//   liveness   → soft sky-blue pulse ("someone woke up / dozed off")
//   churn      → warm amber pulse ("lots happening at once")

import type { RosterDiffTone } from '../game/peer-roster-diff-tone';

export interface RosterDiffTonePalette {
  bg: string;
  border: string;
  text: string;
}

const NONE: RosterDiffTonePalette = {
  bg: 'rgba(0, 0, 0, 0)',
  border: 'rgba(0, 0, 0, 0)',
  text: 'rgba(0, 0, 0, 0)',
};

const ARRIVALS: RosterDiffTonePalette = {
  bg: 'rgba(46, 92, 54, 0.92)',
  border: '#7fd48a',
  text: '#e6ffe8',
};

const DEPARTURES: RosterDiffTonePalette = {
  bg: 'rgba(48, 38, 64, 0.92)',
  border: '#8a7ab0',
  text: '#e0d8f4',
};

const LIVENESS: RosterDiffTonePalette = {
  bg: 'rgba(28, 46, 68, 0.92)',
  border: '#6ea8d4',
  text: '#dceaf6',
};

const CHURN: RosterDiffTonePalette = {
  bg: 'rgba(68, 44, 24, 0.94)',
  border: '#e0a060',
  text: '#fff0d8',
};

export function rosterDiffTonePalette(tone: RosterDiffTone): RosterDiffTonePalette {
  switch (tone) {
    case 'arrivals':
      return ARRIVALS;
    case 'departures':
      return DEPARTURES;
    case 'liveness':
      return LIVENESS;
    case 'churn':
      return CHURN;
    case 'none':
    default:
      return NONE;
  }
}
