// Settings — persistent user preferences stored on the player and the
// save file. Currently surfaces:
//
//   autoSave           : true   - whether to snapshot at day rollover
//   nightTintScale     : 1.0    - 0.0..1.0 multiplier for the night tint
//                                 alpha (lower = less dark, accessibility)
//   hudScale           : 1.0    - 1.0 / 1.25 / 1.5 scale for the top
//                                 bar + quest panel typography
//   reduceMotion       : false  - skip the rain / forage particles
//
// `applyReset` blows away the local save and resets the in-memory
// settings to defaults. Anything beyond the simple boolean / scalar
// toggles will get its own module — this module owns only the data
// shape and the storage hooks.

import type { Player } from '../world/world';

export type HudScale = 1.0 | 1.25 | 1.5;

export interface Settings {
  autoSave: boolean;
  nightTintScale: number;
  hudScale: HudScale;
  reduceMotion: boolean;
}

export const HUD_SCALES: HudScale[] = [1.0, 1.25, 1.5];

/** Defaults applied when no save exists. */
export function defaultSettings(): Settings {
  return {
    autoSave: true,
    nightTintScale: 1.0,
    hudScale: 1.0,
    reduceMotion: false,
  };
}

/** Lazy accessor on the Player. */
export function getSettings(player: Player): Settings {
  const p = player as Player & { settings?: Settings };
  if (!p.settings) p.settings = defaultSettings();
  // Backfill new fields if the save predates them.
  const d = defaultSettings();
  const s = p.settings as unknown as Record<string, unknown>;
  const dd = d as unknown as Record<string, unknown>;
  for (const k of Object.keys(dd)) {
    if (s[k] === undefined) s[k] = dd[k];
  }
  return p.settings;
}

/** Setter that clamps illegal values. Returns the new value. */
export function setNightTintScale(player: Player, value: number): number {
  const v = Math.max(0, Math.min(1, value));
  getSettings(player).nightTintScale = v;
  return v;
}

export function setHudScale(player: Player, value: HudScale): HudScale {
  const v = HUD_SCALES.includes(value) ? value : 1.0;
  getSettings(player).hudScale = v;
  return v;
}

export function toggleAutoSave(player: Player): boolean {
  const s = getSettings(player);
  s.autoSave = !s.autoSave;
  return s.autoSave;
}

export function toggleReduceMotion(player: Player): boolean {
  const s = getSettings(player);
  s.reduceMotion = !s.reduceMotion;
  return s.reduceMotion;
}

/** Cycle hudScale through HUD_SCALES (small -> medium -> large -> small). */
export function cycleHudScale(player: Player): HudScale {
  const s = getSettings(player);
  const idx = HUD_SCALES.indexOf(s.hudScale);
  const next = HUD_SCALES[(idx + 1) % HUD_SCALES.length];
  s.hudScale = next;
  return next;
}

/** Cycle nightTintScale through 1.0 / 0.6 / 0.3 / 0.0. */
export const NIGHT_TINT_STEPS = [1.0, 0.6, 0.3, 0.0];

export function cycleNightTint(player: Player): number {
  const s = getSettings(player);
  const idx = NIGHT_TINT_STEPS.findIndex((v) => Math.abs(v - s.nightTintScale) < 0.01);
  const next = NIGHT_TINT_STEPS[(idx + 1) % NIGHT_TINT_STEPS.length];
  s.nightTintScale = next;
  return next;
}
