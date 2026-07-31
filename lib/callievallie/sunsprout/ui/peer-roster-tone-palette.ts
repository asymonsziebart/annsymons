// Roster tone palette — v0.6.0 slice.
//
// Maps a RosterTone ('solo' | 'stale-only' | 'calm' | 'busy') to the
// background / border / text triple the subtitle strip (and later the
// roster panel header) will tint by.
//
// Kept as a pure lookup so the draw helpers stay dumb and the palette is
// easy to diff / re-theme in one place.
//
// Palette intent:
//   solo       → existing neutral purple (matches every other HUD chip)
//   stale-only → dim grey-violet — "ghosts only, nothing live"
//   calm       → soft sprout-green — "a friend or two nearby"
//   busy       → warm sunset-amber — "the farm is hopping"

import type { RosterTone } from '../game/peer-roster-tone';

export interface RosterTonePalette {
  bg: string;
  border: string;
  text: string;
}

const SOLO: RosterTonePalette = {
  bg: 'rgba(26, 20, 38, 0.78)',
  border: '#4a3b6e',
  text: '#cdb8f0',
};

const STALE: RosterTonePalette = {
  bg: 'rgba(28, 26, 38, 0.78)',
  border: '#3d3a4a',
  text: '#8a869a',
};

const CALM: RosterTonePalette = {
  bg: 'rgba(22, 34, 26, 0.80)',
  border: '#4e7a52',
  text: '#bfe6c3',
};

const BUSY: RosterTonePalette = {
  bg: 'rgba(40, 26, 18, 0.82)',
  border: '#a87142',
  text: '#f4cb9a',
};

export function rosterTonePalette(tone: RosterTone): RosterTonePalette {
  switch (tone) {
    case 'busy':
      return BUSY;
    case 'calm':
      return CALM;
    case 'stale-only':
      return STALE;
    case 'solo':
    default:
      return SOLO;
  }
}
