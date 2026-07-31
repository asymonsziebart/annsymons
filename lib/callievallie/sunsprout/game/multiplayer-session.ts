// Multiplayer session — v0.6.0 third slice.
//
// Wraps a Transport + PeerRegistry into a single object that the game loop
// can drive. The session owns the local player's identity (id/name/color/
// hat) and exposes:
//   - update(localState, now): broadcast our snapshot at a fixed cadence,
//     evict stale peers from the registry.
//   - registry / peers(): read-only access for the renderer.
//   - close(): tear down the transport.
//
// No UI, no rendering — just a clock-driven coordinator. A later tick will
// instantiate one inside engine/game.ts and feed it the local player's
// tile-space position each frame.

import {
  PeerRegistry,
  buildSnapshot,
  type PeerPlayer,
} from './multiplayer';
import {
  bindTransportToRegistry,
  broadcastSnapshot,
  type Transport,
} from './multiplayer-transport';
import { SnapshotThrottle, type SnapshotThrottleOpts } from './snapshot-throttle';
import type { Facing } from '../world/world';

export interface LocalIdentity {
  id: string;
  name: string;
  color: string;
  hat: string;
}

export interface LocalState {
  x: number;
  y: number;
  facing: Facing;
}

export interface MultiplayerSessionOpts {
  identity: LocalIdentity;
  transport: Transport;
  /** Broadcast cadence in ms. Default 100ms (10 Hz). */
  broadcastIntervalMs?: number;
  /** Drop peers we haven't heard from in this long. Default 5s. */
  peerTimeoutMs?: number;
  registry?: PeerRegistry;
  /** Optional throttle that gates broadcasts on actual state change. When
   *  provided, broadcastIntervalMs becomes a floor and the throttle decides
   *  if anything is worth sending. */
  throttle?: SnapshotThrottle | SnapshotThrottleOpts;
}

export class MultiplayerSession {
  readonly identity: LocalIdentity;
  readonly transport: Transport;
  readonly registry: PeerRegistry;
  readonly broadcastIntervalMs: number;
  readonly peerTimeoutMs: number;
  readonly throttle: SnapshotThrottle | null;

  private lastBroadcastAt = -Infinity;
  private unbind: () => void;
  private _closed = false;

  constructor(opts: MultiplayerSessionOpts) {
    this.identity = opts.identity;
    this.transport = opts.transport;
    this.registry = opts.registry ?? new PeerRegistry();
    this.broadcastIntervalMs = opts.broadcastIntervalMs ?? 100;
    this.peerTimeoutMs = opts.peerTimeoutMs ?? 5000;
    this.throttle =
      opts.throttle instanceof SnapshotThrottle
        ? opts.throttle
        : opts.throttle
          ? new SnapshotThrottle(opts.throttle)
          : null;
    this.unbind = bindTransportToRegistry(this.transport, this.registry, () => this._now);
  }

  /** Set by update() so the bind callback can stamp lastSeenAt with the same clock. */
  private _now = 0;

  /** True once close() has been called. */
  get closed(): boolean {
    return this._closed;
  }

  /** Read-only snapshot of remote peers. */
  peers(): PeerPlayer[] {
    return this.registry.list();
  }

  /**
   * Drive the session forward. Call once per frame.
   *
   * - Broadcasts the local snapshot when the cadence elapses.
   * - Evicts peers we haven't heard from in `peerTimeoutMs`.
   *
   * Returns the ids of any peers evicted this tick.
   */
  update(local: LocalState, now: number): string[] {
    this._now = now;
    if (this._closed) return [];
    if (now - this.lastBroadcastAt >= this.broadcastIntervalMs) {
      const snap = buildSnapshot({
        id: this.identity.id,
        name: this.identity.name,
        x: local.x,
        y: local.y,
        facing: local.facing,
        color: this.identity.color,
        hat: this.identity.hat,
      });
      const allow =
        this.throttle === null ||
        this.throttle.shouldSend(
          {
            x: snap.x,
            y: snap.y,
            facing: snap.facing,
            name: snap.name,
            color: snap.color,
            hat: snap.hat,
          },
          now,
        );
      if (allow) {
        broadcastSnapshot(this.transport, snap);
        this.lastBroadcastAt = now;
      }
    }
    return this.registry.evictStale(now, this.peerTimeoutMs);
  }

  close(): void {
    if (this._closed) return;
    this._closed = true;
    this.unbind();
    this.transport.close();
    this.registry.clear();
  }
}
