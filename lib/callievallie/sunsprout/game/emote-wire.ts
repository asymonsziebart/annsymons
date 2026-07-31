// Peer emote wire-format — v0.6.0 seventeenth slice.
//
// PeerEmotes (peer-emotes.ts) is the store; this is the over-the-wire shape
// for emote *events*. We keep emotes off the PeerSnapshot intentionally
// (snapshots are sent at high frequency and emotes are rare event-style
// state with their own TTL). A later slice will plumb these messages through
// MultiplayerSession / Transport. For this tick we only land the schema +
// strict validator so future wiring can rely on it.
//
// Wire shape (JSON, tagged so the receiver can demux from snapshots):
//   { t: 'emote', v: 1, id: '<peerId>', k: '<EmoteKind>' }

import { isEmoteKind, type EmoteKind } from './peer-emotes';

export const EMOTE_WIRE_VERSION = 1;
export const EMOTE_WIRE_TAG = 'emote' as const;

export interface EmoteMessage {
  t: typeof EMOTE_WIRE_TAG;
  v: number;
  /** Peer id the emote belongs to (the sender). */
  id: string;
  k: EmoteKind;
}

/** Build a fresh emote message — convenience that stamps the version + tag. */
export function makeEmoteMessage(peerId: string, kind: EmoteKind): EmoteMessage {
  return { t: EMOTE_WIRE_TAG, v: EMOTE_WIRE_VERSION, id: peerId, k: kind };
}

/** Serialize an emote event to a wire string. JSON for now (matches snapshot). */
export function serializeEmote(msg: EmoteMessage): string {
  return JSON.stringify(msg);
}

/** Parse a wire string. Returns null on malformed/invalid payloads or on
 *  messages that aren't emotes (so callers can demux snapshots safely). */
export function deserializeEmote(raw: string): EmoteMessage | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  if (o.t !== EMOTE_WIRE_TAG) return null;
  if (o.v !== EMOTE_WIRE_VERSION) return null;
  if (typeof o.id !== 'string' || !o.id || o.id.length > 64) return null;
  if (!isEmoteKind(o.k)) return null;
  return { t: EMOTE_WIRE_TAG, v: EMOTE_WIRE_VERSION, id: o.id, k: o.k };
}

/** Lightweight check used by demuxers — true if the raw string *looks* like
 *  an emote message. Cheap substring sniff before a full JSON parse. */
export function looksLikeEmoteWire(raw: string): boolean {
  return raw.includes(`"t":"${EMOTE_WIRE_TAG}"`);
}
