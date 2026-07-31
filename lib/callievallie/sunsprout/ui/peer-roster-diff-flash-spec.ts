// Roster diff flash spec — v0.6.0 slice.
//
// Combines the sibling helpers (tone → label, tone → palette) plus a
// per-tone duration into a single struct the HUD render layer can consume
// without re-deriving anything. Keeps the render path stupid: it asks for
// a spec, gets back colour + word + how-long-to-show, draws it, decays.
//
// Duration intent (ms):
//   none       → 0   (no flash, caller skips)
//   arrivals   → 1200 (cheerful, lingers)
//   departures → 1400 (slightly longer, gentle fade)
//   liveness   → 900  (quick, ambient)
//   churn      → 1600 (longest — lots happening, give the eye time)

import type { RosterDiffTone } from '../game/peer-roster-diff-tone';
import { rosterDiffFlashLabel } from './peer-roster-diff-flash-label';
import {
  rosterDiffTonePalette,
  type RosterDiffTonePalette,
} from './peer-roster-diff-tone-palette';

export interface RosterDiffFlashSpec {
  tone: RosterDiffTone;
  label: string;
  palette: RosterDiffTonePalette;
  durationMs: number;
}

function durationFor(tone: RosterDiffTone): number {
  switch (tone) {
    case 'arrivals':
      return 1200;
    case 'departures':
      return 1400;
    case 'liveness':
      return 900;
    case 'churn':
      return 1600;
    case 'none':
    default:
      return 0;
  }
}

export function rosterDiffFlashSpec(tone: RosterDiffTone): RosterDiffFlashSpec {
  return {
    tone,
    label: rosterDiffFlashLabel(tone),
    palette: rosterDiffTonePalette(tone),
    durationMs: durationFor(tone),
  };
}
