// BroadcastChannel transport — v0.6.0 seventh slice.
//
// Real cross-tab transport: two browser windows on the same origin can now
// exchange peer snapshots without a server. Implements the same Transport
// interface as LoopbackBus so MultiplayerSession can swap it in unchanged.
//
// Why BroadcastChannel? It's the smallest serverless step that works in
// every modern browser: same-origin, in-process, zero setup. A later tick
// can layer WebRTC on top for cross-machine play. Until then, this lets
// Sanjay test multiplayer locally by opening sunsprout in two tabs.
//
// Pure module — only touches the BroadcastChannel global, which is
// injectable for tests via the `channelFactory` opt.
//
// Wire format: every send() ships `{from: localId, raw: <snapshot-json>}`
// so receivers can filter out their own echoes (BroadcastChannel does NOT
// dedupe sender like LoopbackBus does).

import type { MessageHandler, Transport } from './multiplayer-transport';

/** Minimal BroadcastChannel shape — matches the DOM lib type. */
export interface BroadcastChannelLike {
  postMessage(msg: unknown): void;
  close(): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
}

export type BroadcastChannelFactory = (name: string) => BroadcastChannelLike;

export interface BroadcastChannelTransportOpts {
  /** Stable id of this transport's local endpoint. */
  id: string;
  /** Channel name. Both tabs must use the same name to find each other. */
  channelName?: string;
  /** Factory — defaults to the global BroadcastChannel constructor. */
  channelFactory?: BroadcastChannelFactory;
}

interface Envelope {
  from: string;
  raw: string;
}

const DEFAULT_CHANNEL = 'callievallie.multiplayer.v1';

/**
 * Resolve the default factory. Returns null if BroadcastChannel isn't
 * available in this environment (e.g. node without polyfill).
 */
function defaultFactory(): BroadcastChannelFactory | null {
  const g = globalThis as unknown as { BroadcastChannel?: new (n: string) => BroadcastChannelLike };
  if (typeof g.BroadcastChannel !== 'function') return null;
  return (name) => new g.BroadcastChannel!(name);
}

/** True if BroadcastChannel is usable in the current environment. */
export function isBroadcastChannelSupported(): boolean {
  return defaultFactory() !== null;
}

export class BroadcastChannelTransport implements Transport {
  readonly id: string;
  readonly channelName: string;
  private channel: BroadcastChannelLike;
  private handlers = new Set<MessageHandler>();
  private _closed = false;

  constructor(opts: BroadcastChannelTransportOpts) {
    this.id = opts.id;
    this.channelName = opts.channelName ?? DEFAULT_CHANNEL;
    const factory = opts.channelFactory ?? defaultFactory();
    if (!factory) {
      throw new Error(
        'BroadcastChannelTransport: BroadcastChannel is not available in this environment',
      );
    }
    this.channel = factory(this.channelName);
    this.channel.onmessage = (ev) => this._onMessage(ev.data);
  }

  get closed(): boolean {
    return this._closed;
  }

  send(raw: string): void {
    if (this._closed) return;
    const envelope: Envelope = { from: this.id, raw };
    this.channel.postMessage(envelope);
  }

  onMessage(cb: MessageHandler): () => void {
    this.handlers.add(cb);
    return () => this.handlers.delete(cb);
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    this.handlers.clear();
    this.channel.onmessage = null;
    try {
      this.channel.close();
    } catch {
      // ignore — already closed or env shim
    }
  }

  private _onMessage(data: unknown): void {
    const env = parseEnvelope(data);
    if (!env) return;
    // Drop our own echoes. BroadcastChannel does not deliver to the sender
    // tab by spec, but we double-check in case a polyfill misbehaves.
    if (env.from === this.id) return;
    for (const h of this.handlers) h(env.raw, env.from);
  }
}

function parseEnvelope(data: unknown): Envelope | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (typeof o.from !== 'string' || typeof o.raw !== 'string') return null;
  if (!o.from || o.from.length > 64) return null;
  if (o.raw.length > 4096) return null;
  return { from: o.from, raw: o.raw };
}
