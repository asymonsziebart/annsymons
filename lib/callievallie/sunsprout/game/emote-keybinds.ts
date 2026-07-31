// Emote keybinds — v0.6.0 twentieth slice.
//
// Maps the number-row keys 1-5 to the five EmoteKind values so the player
// can pop a bubble above their sprite (and broadcast it to peers) with a
// single keystroke. Kept as a small pure module so it can be tested without
// instantiating a real Game, and so the binding table is the single source
// of truth for both the input handler and any future on-screen legend.

import type { EmoteKind } from './peer-emotes';

/** Minimal input surface used by handleEmoteInput — matches engine/Input. */
export interface EmoteInputLike {
  isJustPressed(key: string): boolean;
}

/** Minimal driver surface — matches MultiplayerDriver.sendEmote. */
export interface EmoteDriverLike {
  sendEmote(kind: EmoteKind, now: number): void;
}

/**
 * Ordered table of (key, emote) pairs. Order matters for the eventual HUD
 * legend ("1 wave  2 heart  3 sprout …"). Keys are lowercase to match
 * Input.isJustPressed normalisation.
 */
export const EMOTE_BINDINGS: ReadonlyArray<readonly [string, EmoteKind]> = [
  ['1', 'wave'],
  ['2', 'heart'],
  ['3', 'sprout'],
  ['4', 'sparkle'],
  ['5', 'note'],
];

/** Look up the emote bound to a literal key, or undefined. */
export function emoteForKey(key: string): EmoteKind | undefined {
  const k = key.toLowerCase();
  for (const [bk, em] of EMOTE_BINDINGS) {
    if (bk === k) return em;
  }
  return undefined;
}

/**
 * Poll the keybinds and fire at most one emote per call. Returns the kind
 * sent, or undefined if no bound key was pressed this frame. The "at most
 * one" rule keeps mash-spamming honest: holding multiple number keys still
 * only emits a single bubble per tick.
 */
export function handleEmoteInput(
  input: EmoteInputLike,
  driver: EmoteDriverLike,
  now: number,
): EmoteKind | undefined {
  for (const [key, kind] of EMOTE_BINDINGS) {
    if (input.isJustPressed(key)) {
      driver.sendEmote(kind, now);
      return kind;
    }
  }
  return undefined;
}
