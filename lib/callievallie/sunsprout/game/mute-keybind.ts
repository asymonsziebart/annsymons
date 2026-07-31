// Mute-last-speaker keybind — v0.6.0 thirty-first slice.
//
// Tiny pure router: when the `m` key is just-pressed, look up the most
// recent unmuted peer chatter and toggle their mute state. Returned
// MuteKeybindResult lets the caller fire a HUD toast ("muted alice" /
// "unmuted alice") without re-querying the ChatMuteSet.
//
// Kept standalone (no DOM, no Game ref) so it composes the same way as
// chat-keybinds.ts and so the unit tests can drive it with plain fakes.
//
// Bindings (locked here):
//   - `m` : toggle mute on whoever last spoke (within LastChatter TTL)
//
// Intentionally a no-op when:
//   - the key wasn't just-pressed
//   - no one has chatted within TTL (lastChatterId returns null)
//   - the chat composer is open — we don't want to swallow a typed 'm'

export interface MuteKeybindInputLike {
  isJustPressed(key: string): boolean;
}

export interface MuteKeybindDriverLike {
  lastChatterId(now: number): string | null;
  readonly mutes: { toggle(id: string): boolean };
}

export interface MuteKeybindResult {
  /** Peer id whose mute state changed, or null if nothing happened. */
  id: string | null;
  /** Post-toggle state: true = now muted, false = now unmuted. */
  muted: boolean;
}

const EMPTY: MuteKeybindResult = { id: null, muted: false };

/**
 * Poll the keyboard once per frame and toggle the last chatter's mute when
 * `m` was just pressed. `chatOpen` short-circuits the lookup so the typist
 * can include the letter 'm' in their message.
 */
export function handleMuteKeybind(
  input: MuteKeybindInputLike,
  driver: MuteKeybindDriverLike,
  now: number,
  chatOpen: boolean = false,
): MuteKeybindResult {
  if (chatOpen) return EMPTY;
  if (!input.isJustPressed('m')) return EMPTY;
  const id = driver.lastChatterId(now);
  if (!id) return EMPTY;
  const muted = driver.mutes.toggle(id);
  return { id, muted };
}
