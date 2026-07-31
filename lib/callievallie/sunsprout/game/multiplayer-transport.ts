// Multiplayer transport layer — v0.6.0 second slice.
//
// Abstract Transport interface + a synchronous in-memory LoopbackBus that
// fan-outs snapshots between local Transport instances. Useful for tests
// and for a future split-screen / hotseat mode. A real WebRTC datachannel
// transport will implement the same interface in a later tick.
//
// Design rules (per DECISIONS):
//   - No backend. Loopback is purely in-process; WebRTC tick will be P2P.
//   - Tiny surface area: send(raw) + onMessage(cb) + close().
//   - Transport is dumb pipes. Snapshot validation lives in multiplayer.ts.

import {
  PeerRegistry,
  deserializeSnapshot,
  serializeSnapshot,
  type PeerSnapshot,
} from './multiplayer';

export type MessageHandler = (raw: string, fromId: string) => void;

export interface Transport {
  /** Stable id of this transport's local endpoint. */
  readonly id: string;
  /** Broadcast a raw wire message to every other endpoint on the bus. */
  send(raw: string): void;
  /** Register a handler for inbound messages. Returns an unsubscribe fn. */
  onMessage(cb: MessageHandler): () => void;
  /** Disconnect from the bus. */
  close(): void;
  /** True once close() has been called. */
  readonly closed: boolean;
}

/**
 * In-process pub/sub bus. Each `connect(id)` call returns a Transport that
 * receives every message sent by every other connected transport. Sender
 * never receives its own messages (loopback would explode snapshot apply
 * logic).
 */
export class LoopbackBus {
  private endpoints = new Map<string, LoopbackTransport>();

  connect(id: string): Transport {
    if (this.endpoints.has(id)) {
      throw new Error(`LoopbackBus: endpoint id "${id}" already connected`);
    }
    const ep = new LoopbackTransport(id, this);
    this.endpoints.set(id, ep);
    return ep;
  }

  /** Internal: called by LoopbackTransport.send. */
  _dispatch(fromId: string, raw: string): void {
    for (const [id, ep] of this.endpoints) {
      if (id === fromId) continue;
      ep._deliver(raw, fromId);
    }
  }

  /** Internal: called by LoopbackTransport.close. */
  _detach(id: string): void {
    this.endpoints.delete(id);
  }

  /** Number of currently-connected endpoints. */
  size(): number {
    return this.endpoints.size;
  }
}

class LoopbackTransport implements Transport {
  readonly id: string;
  private bus: LoopbackBus;
  private handlers = new Set<MessageHandler>();
  closed = false;

  constructor(id: string, bus: LoopbackBus) {
    this.id = id;
    this.bus = bus;
  }

  send(raw: string): void {
    if (this.closed) return;
    this.bus._dispatch(this.id, raw);
  }

  onMessage(cb: MessageHandler): () => void {
    this.handlers.add(cb);
    return () => this.handlers.delete(cb);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.handlers.clear();
    this.bus._detach(this.id);
  }

  _deliver(raw: string, fromId: string): void {
    if (this.closed) return;
    for (const h of this.handlers) h(raw, fromId);
  }
}

/**
 * Glue: wire a Transport's inbound messages into a PeerRegistry. Returns an
 * unsubscribe fn. The callback ignores malformed messages silently — the
 * registry's apply() already validates.
 */
export function bindTransportToRegistry(
  transport: Transport,
  registry: PeerRegistry,
  now: () => number = () => Date.now(),
): () => void {
  return transport.onMessage((raw) => {
    const snap = deserializeSnapshot(raw);
    if (snap) registry.apply(snap, now());
  });
}

/** Convenience: serialize + send in one call. */
export function broadcastSnapshot(transport: Transport, snap: PeerSnapshot): void {
  transport.send(serializeSnapshot(snap));
}
