// Peer chat wire-format — v0.6.0 twenty-second slice.
//
// First slice of co-op text chat. Mirrors emote-wire.ts: pure schema +
// validator + serializer so future ticks can plumb chat messages through
// MultiplayerSession / Transport, render bubbles, and add a chat HUD. No
// store, no UI, no transport wiring yet.
//
// Wire shape (JSON, tagged so the receiver can demux from snapshots/emotes):
//   { t: 'chat', v: 1, id: '<peerId>', m: '<message>' }

export const CHAT_WIRE_VERSION = 1;
export const CHAT_WIRE_TAG = 'chat' as const;

/** Hard cap so a chatty peer can't blow the snapshot budget. */
export const CHAT_MAX_LEN = 120;

export interface ChatMessage {
  t: typeof CHAT_WIRE_TAG;
  v: number;
  /** Peer id the chat line belongs to (the sender). */
  id: string;
  /** Sanitized message text (control chars stripped, trimmed, length-capped). */
  m: string;
}

/** Strip control chars, collapse whitespace, trim, and cap to CHAT_MAX_LEN. */
export function sanitizeChatText(raw: string): string {
  if (typeof raw !== 'string') return '';
  // Remove ASCII control + DEL chars (keep tab/newline normalised to space).
  // eslint-disable-next-line no-control-regex
  const stripped = raw.replace(/[\u0000-\u001F\u007F]+/g, ' ');
  const collapsed = stripped.replace(/\s+/g, ' ').trim();
  return collapsed.slice(0, CHAT_MAX_LEN);
}

/** Build a fresh chat message — sanitizes the body and stamps version + tag.
 *  Returns null if the resulting body is empty (so callers don't broadcast
 *  no-op chats from accidental Enter presses). */
export function makeChatMessage(peerId: string, body: string): ChatMessage | null {
  const m = sanitizeChatText(body);
  if (!m) return null;
  if (!peerId || peerId.length > 64) return null;
  return { t: CHAT_WIRE_TAG, v: CHAT_WIRE_VERSION, id: peerId, m };
}

/** Serialize a chat message to a wire string. JSON for now (matches snapshot). */
export function serializeChat(msg: ChatMessage): string {
  return JSON.stringify(msg);
}

/** Parse a wire string. Returns null on malformed/invalid payloads or on
 *  messages that aren't chats (so callers can demux snapshots/emotes safely). */
export function deserializeChat(raw: string): ChatMessage | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  if (o.t !== CHAT_WIRE_TAG) return null;
  if (o.v !== CHAT_WIRE_VERSION) return null;
  if (typeof o.id !== 'string' || !o.id || o.id.length > 64) return null;
  if (typeof o.m !== 'string') return null;
  const m = sanitizeChatText(o.m);
  if (!m) return null;
  return { t: CHAT_WIRE_TAG, v: CHAT_WIRE_VERSION, id: o.id, m };
}

/** Lightweight check used by demuxers — true if the raw string *looks* like
 *  a chat message. Cheap substring sniff before a full JSON parse. */
export function looksLikeChatWire(raw: string): boolean {
  return raw.includes(`"t":"${CHAT_WIRE_TAG}"`);
}
