// Onboarding — a one-time welcome card shown on a player's very first
// boot, pointing them at the help + wayfinding surfaces they'd otherwise
// have to stumble onto. The game grew ~40 keybinds and three info panels
// (`?` controls, `9` minimap, `0` almanac); a brand-new player has no
// idea they exist. This card surfaces them once, then never again.
//
// The "seen" flag lives in its OWN localStorage key (not the save
// snapshot) so it persists across the Settings > Reset Save flow and
// doesn't bloat the save schema. The card content + the storage gating
// are pure/testable here; the canvas draw is the thin card UI.

import type { StorageLike } from './persistence';

/** Dedicated flag key — independent of the save snapshot. */
export const ONBOARDING_SEEN_KEY = 'callievallie.onboarding.v1';

/** A single tip row: a key glyph + what it opens. */
export interface OnboardingTip {
  keys: string;
  label: string;
}

/** The welcome headline + the handful of tips worth surfacing on day one. */
export const ONBOARDING_TITLE = 'Welcome to Callie & Vallie';
export const ONBOARDING_INTRO =
  'Two hearts, one valley. A cozy farm is yours — a few keys to get started:';

export const ONBOARDING_TIPS: OnboardingTip[] = [
  { keys: 'WASD', label: 'Walk around the village' },
  { keys: 'E', label: 'Talk, harvest, and open menus' },
  { keys: '?', label: 'Full controls cheat sheet, any time' },
  { keys: '9', label: 'Village map to find your way' },
  { keys: '0', label: 'Almanac of upcoming days + events' },
];

export const ONBOARDING_FOOTER = 'press any key to begin';

/** True if the welcome card has already been dismissed on this device. */
export function hasSeenOnboarding(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(ONBOARDING_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Persist that the welcome card has been seen so it never shows again. */
export function markOnboardingSeen(storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.setItem(ONBOARDING_SEEN_KEY, '1');
  } catch {
    // Storage full / blocked — the card just shows again next boot; harmless.
  }
}

/**
 * Decide whether to show the welcome card on boot. We show it only when
 * the flag is unset. (The caller already gates on having storage; this
 * keeps the rule in one tested place.)
 */
export function shouldShowOnboarding(storage: StorageLike | null): boolean {
  return !hasSeenOnboarding(storage);
}
