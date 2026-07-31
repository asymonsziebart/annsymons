// Chat transport glue — v0.6.0 twenty-fourth slice.
//
// Mirrors emote-transport.ts: tiny adapter that lets a Transport carry chat
// messages alongside snapshots/emotes. Receiving uses the cheap
// `looksLikeChatWire` sniff first so snapshots/emotes pay nothing extra;
// only chat-shaped strings go through the strict deserializer. Wiring into
// MultiplayerDriver comes in a later slice.

import {
  deserializeChat,
  looksLikeChatWire,
  makeChatMessage,
  serializeChat,
} from './chat-wire';
import type { PeerChats } from './peer-chats';
import type { Transport } from './multiplayer-transport';

/** Broadcast a chat line over a transport. No-op if sanitized body is empty. */
export function broadcastChat(
  transport: Transport,
  peerId: string,
  body: string,
): boolean {
  const msg = makeChatMessage(peerId, body);
  if (!msg) return false;
  transport.send(serializeChat(msg));
  return true;
}

/**
 * Bind a transport's inbound stream to a PeerChats store. Returns an
 * unsubscribe fn. Non-chat messages (snapshots, emotes, anything else) are
 * ignored — callers wire those handlers separately.
 */
export function bindTransportToChats(
  transport: Transport,
  chats: PeerChats,
  now: () => number = () => Date.now(),
): () => void {
  return transport.onMessage((raw) => {
    if (!looksLikeChatWire(raw)) return;
    const msg = deserializeChat(raw);
    if (!msg) return;
    chats.push(msg.id, msg.m, now());
  });
}
