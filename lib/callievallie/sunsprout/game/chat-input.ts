// Chat composer state machine — v0.6.0 twenty-third slice.
//
// Pure state container for the local player's chat composer. Held by the
// Game and driven by keyboard events; later ticks will wire it to the
// renderer (input bar HUD) and to MultiplayerDriver.sendChat on submit.
//
// Design rules:
//   - No DOM, no Input dep — caller feeds raw key events so this is unit-
//     testable in node and so the future split-screen mode can drive two
//     composers independently.
//   - Sanitisation is delegated to chat-wire.sanitizeChatText so the
//     on-screen buffer matches what eventually goes on the wire.
//   - State is tiny: open flag + buffer string. Submit returns the sanitized
//     body (or null) and resets to closed.

import { CHAT_MAX_LEN, sanitizeChatText } from './chat-wire';

export interface ChatInputState {
  open: boolean;
  buffer: string;
}

export function createChatInput(): ChatInputState {
  return { open: false, buffer: '' };
}

/** Open the composer with an empty buffer. No-op if already open. */
export function openChatInput(state: ChatInputState): void {
  if (state.open) return;
  state.open = true;
  state.buffer = '';
}

/** Cancel the composer, dropping any buffered text. */
export function cancelChatInput(state: ChatInputState): void {
  state.open = false;
  state.buffer = '';
}

/**
 * Append a single printable character to the buffer. Ignored when the
 * composer is closed, when the char isn't printable, or when the buffer is
 * already at the cap. Whitespace is allowed (sanitisation collapses it on
 * submit) so the typist sees what they're typing.
 */
export function appendChatChar(state: ChatInputState, ch: string): void {
  if (!state.open) return;
  if (typeof ch !== 'string' || ch.length !== 1) return;
  const code = ch.charCodeAt(0);
  // Printable ASCII + extended; reject control chars.
  if (code < 0x20 || code === 0x7f) return;
  if (state.buffer.length >= CHAT_MAX_LEN) return;
  state.buffer += ch;
}

/** Drop the trailing char. No-op when closed or buffer is empty. */
export function backspaceChatInput(state: ChatInputState): void {
  if (!state.open) return;
  if (state.buffer.length === 0) return;
  state.buffer = state.buffer.slice(0, -1);
}

/**
 * Submit the current buffer. Returns the sanitized body if non-empty (and
 * clears+closes the composer), or null when the buffer is empty/whitespace
 * (composer stays open so the player can keep typing or hit Escape).
 */
export function submitChatInput(state: ChatInputState): string | null {
  if (!state.open) return null;
  const body = sanitizeChatText(state.buffer);
  if (!body) return null;
  state.open = false;
  state.buffer = '';
  return body;
}
