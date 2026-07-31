// Chat keybinds — v0.6.0 twenty-fifth slice.
//
// Pure routing layer between the keyboard (engine/Input shape) and the
// ChatInputState container from chat-input.ts. Kept as a single function
// per "input event" model so it is trivially unit-testable without a real
// DOM and so the eventual Game wiring is just three lines.
//
// Bindings (locked here so they're the single source of truth):
//   - `t` or `enter` : open the composer (when closed)
//   - `escape`       : cancel and close
//   - `enter`        : submit (when open) — returns sanitized body via callback
//   - `backspace`    : drop trailing char
//   - any printable  : appendChatChar
//
// "Printable" here means single-character keys from KeyboardEvent.key, i.e.
// strings of length 1 with codepoints >= 0x20. Modifier names like "Shift",
// "Control", etc are filtered out by the length check.

import {
  appendChatChar,
  backspaceChatInput,
  cancelChatInput,
  openChatInput,
  submitChatInput,
  type ChatInputState,
} from './chat-input';

/**
 * Minimal input surface — matches engine/Input. We need both the predicate
 * form (for the named keys) and the raw set (so we can scan for printable
 * chars without enumerating every ASCII codepoint).
 */
export interface ChatInputLike {
  isJustPressed(key: string): boolean;
  readonly justPressed: ReadonlySet<string>;
}

const NAMED_KEYS = new Set([
  't',
  'enter',
  'escape',
  'backspace',
]);

export interface ChatInputResult {
  /** True if this call toggled the composer open. */
  opened: boolean;
  /** True if this call closed the composer (cancel or successful submit). */
  closed: boolean;
  /** Submitted sanitized body, when Enter produced a non-empty message. */
  submitted: string | null;
}

const EMPTY_RESULT: ChatInputResult = {
  opened: false,
  closed: false,
  submitted: null,
};

/**
 * Poll keyboard state once per frame and mutate `state` accordingly. Returns
 * a small struct describing what happened so the caller can fire side
 * effects (e.g. `driver.sendChat(submitted, now)`). At most one transition
 * happens per call — printable chars are still all appended in a single
 * frame, which matches the platform's keyboard repeat semantics.
 */
export function handleChatInput(
  input: ChatInputLike,
  state: ChatInputState,
): ChatInputResult {
  // --- Closed state: only watch for "open" keys. ---
  if (!state.open) {
    if (input.isJustPressed('t') || input.isJustPressed('enter')) {
      openChatInput(state);
      return { opened: true, closed: false, submitted: null };
    }
    return EMPTY_RESULT;
  }

  // --- Open state: prioritise control keys over text input. ---
  if (input.isJustPressed('escape')) {
    cancelChatInput(state);
    return { opened: false, closed: true, submitted: null };
  }
  if (input.isJustPressed('enter')) {
    const body = submitChatInput(state);
    // submitChatInput returns null when the buffer was empty/whitespace; in
    // that case the composer stays open so the typist can keep going.
    return {
      opened: false,
      closed: body !== null,
      submitted: body,
    };
  }
  if (input.isJustPressed('backspace')) {
    backspaceChatInput(state);
    return EMPTY_RESULT;
  }

  // Scan raw just-pressed set for printable chars. Skip named keys so e.g.
  // pressing 't' to open doesn't also type 't' on the same frame.
  for (const key of input.justPressed) {
    if (key.length !== 1) continue;
    if (NAMED_KEYS.has(key)) continue;
    appendChatChar(state, key);
  }
  return EMPTY_RESULT;
}
