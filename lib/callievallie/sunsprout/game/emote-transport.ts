// Emote transport glue — v0.6.0 eighteenth slice.
//
// Tiny adapter that lets a Transport carry emote events alongside peer
// snapshots. Receiving uses the cheap `looksLikeEmoteWire` sniff first so
// snapshots pay nothing extra; only emote-shaped strings go through the
// strict deserializer. The applier pushes into a PeerEmotes store using
// the *sender's* transport id when the wire id is missing/forgeable later —
// for now we trust the wire id (loopback bus is in-process).
//
// Wiring into MultiplayerSession comes in a later slice; this lands the
// pure plumbing + tests so the session change stays small.

import {
  deserializeEmote,
  looksLikeEmoteWire,
  makeEmoteMessage,
  serializeEmote,
} from './emote-wire';
import type { EmoteKind, PeerEmotes } from './peer-emotes';
import type { Transport } from './multiplayer-transport';

/** Broadcast an emote event over a transport. */
export function broadcastEmote(
  transport: Transport,
  peerId: string,
  kind: EmoteKind,
): void {
  transport.send(serializeEmote(makeEmoteMessage(peerId, kind)));
}

/**
 * Bind a transport's inbound stream to a PeerEmotes store. Returns an
 * unsubscribe fn. Non-emote messages (snapshots, anything else) are
 * ignored — callers wire snapshot handling separately.
 */
export function bindTransportToEmotes(
  transport: Transport,
  emotes: PeerEmotes,
  now: () => number = () => Date.now(),
): () => void {
  return transport.onMessage((raw) => {
    if (!looksLikeEmoteWire(raw)) return;
    const msg = deserializeEmote(raw);
    if (!msg) return;
    emotes.push(msg.id, msg.k, now());
  });
}
