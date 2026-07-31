// Restore-mutes keybind — v0.6.0 thirty-sixth slice.
//
// Pairs with handleUnmuteAllKeybind + MuteHistory. When the user presses
// Shift+U we pop the most-recent muted-id snapshot off the history stack
// and re-mute every id it contains. This is the "oops, I didn't mean to
// clear all mutes" undo path. Pure router — no Game, no DOM.
//
// Bindings (locked here):
//   - Shift + U : pop MuteHistory + re-mute the popped ids
//
// Intentionally a no-op when:
//   - the chat composer is open (don't steal a typed 'U')
//   - shift isn't currently held
//   - 'u' wasn't just-pressed this frame
//   - the history stack is empty
//
// Returns the number of ids actually newly-added to the mute set so the
// caller can render a "restored N mutes" toast without polling sizes.

export interface RestoreMutesInputLike {
  isJustPressed(key: string): boolean;
  isPressed(key: string): boolean;
}

export interface RestoreMutesHistoryLike {
  pop(): string[] | null;
  size(): number;
}

export interface RestoreMutesMuteSetLike {
  mute(id: string): boolean;
}

export interface RestoreMutesDriverLike {
  readonly mutes: RestoreMutesMuteSetLike;
  readonly muteHistory: RestoreMutesHistoryLike;
}

export interface RestoreMutesResult {
  /** Number of ids that were newly muted by this restore (0 = no-op). */
  restored: number;
}

const EMPTY: RestoreMutesResult = { restored: 0 };

export function handleRestoreMutesKeybind(
  input: RestoreMutesInputLike,
  driver: RestoreMutesDriverLike,
  chatOpen: boolean = false,
): RestoreMutesResult {
  if (chatOpen) return EMPTY;
  if (!input.isPressed('shift')) return EMPTY;
  if (!input.isJustPressed('u')) return EMPTY;
  const snap = driver.muteHistory.pop();
  if (!snap || snap.length === 0) return EMPTY;
  let restored = 0;
  for (const id of snap) {
    if (driver.mutes.mute(id)) restored++;
  }
  return { restored };
}
