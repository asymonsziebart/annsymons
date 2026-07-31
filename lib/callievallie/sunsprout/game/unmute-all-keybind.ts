// Unmute-all keybind — v0.6.0 thirty-fourth slice.
//
// Tiny pure router that pairs with mute-keybind.ts: when `u` is just-pressed,
// clear the entire ChatMuteSet in one shot. Returns the count cleared so a
// HUD toast can say "unmuted 3 peers" without the caller polling size()
// before and after.
//
// Same composition shape as handleMuteKeybind so future ticks can hang
// both behind a single keybinds-router without either touching the Game.
//
// Bindings (locked here):
//   - `u` : clear every muted peer (no-op when nobody is muted)
//
// Intentionally a no-op when:
//   - the key wasn't just-pressed
//   - the chat composer is open (don't swallow a typed 'u')
//   - the mute set is already empty
//
// Side effect: when the driver also exposes a `muteHistory` (and the mute
// set can `list()` its current ids) the current snapshot is pushed onto the
// history stack BEFORE the clear. That gives Shift+U / handleRestoreMutesKeybind
// something to pop without forcing every caller to wire its own snapshot
// step in by hand.

export interface UnmuteAllInputLike {
  isJustPressed(key: string): boolean;
}

export interface UnmuteAllMuteSetLike {
  size(): number;
  clear(): void;
  /** Optional — when present we snapshot before clearing. */
  list?(): string[];
}

export interface UnmuteAllHistoryLike {
  push(ids: readonly string[]): boolean;
}

export interface UnmuteAllDriverLike {
  readonly mutes: UnmuteAllMuteSetLike;
  /** Optional history sink; when present we snapshot before clearing. */
  readonly muteHistory?: UnmuteAllHistoryLike;
}

export interface UnmuteAllResult {
  /** Number of peers that were muted before the clear (0 = no-op). */
  cleared: number;
  /** True iff the prior set was snapshotted onto driver.muteHistory. */
  snapshotted: boolean;
}

const EMPTY: UnmuteAllResult = { cleared: 0, snapshotted: false };

/**
 * Poll the keyboard once per frame and clear all peer mutes when `u` was
 * just pressed. `chatOpen` short-circuits the lookup so the typist can
 * include the letter 'u' in their message.
 */
export function handleUnmuteAllKeybind(
  input: UnmuteAllInputLike,
  driver: UnmuteAllDriverLike,
  chatOpen: boolean = false,
): UnmuteAllResult {
  if (chatOpen) return EMPTY;
  if (!input.isJustPressed('u')) return EMPTY;
  const n = driver.mutes.size();
  if (n <= 0) return EMPTY;
  let snapshotted = false;
  if (driver.muteHistory && typeof driver.mutes.list === 'function') {
    const ids = driver.mutes.list();
    snapshotted = driver.muteHistory.push(ids);
  }
  driver.mutes.clear();
  return { cleared: n, snapshotted };
}
