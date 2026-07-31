// Snapshot throttle — v0.6.0 slice.
//
// Wraps the broadcast cadence so we only emit a PeerSnapshot when something
// the renderer cares about has actually changed (position moved >= a tile
// fraction, facing flipped, name/color/hat changed), OR when a heartbeat
// interval elapses to keep peers from evicting us as stale.
//
// Pure module: no transports, no timers. Caller drives it each frame with
// the current state and `now`. Returns true when a send should happen.

import type { PeerSnapshot } from './multiplayer';

export interface ThrottleState {
  x: number;
  y: number;
  facing: string;
  name: string;
  color: string;
  hat: string;
}

export interface SnapshotThrottleOpts {
  /** Min tile-distance change before a positional update is sent. */
  moveEpsilon?: number;
  /** Heartbeat interval (ms) — emit even when nothing changed. */
  heartbeatMs?: number;
  /** Minimum gap (ms) between any two emits. Hard cap on broadcast rate. */
  minIntervalMs?: number;
}

export class SnapshotThrottle {
  readonly moveEpsilon: number;
  readonly heartbeatMs: number;
  readonly minIntervalMs: number;

  private lastSentAt = -Infinity;
  private last: ThrottleState | null = null;

  constructor(opts: SnapshotThrottleOpts = {}) {
    this.moveEpsilon = opts.moveEpsilon ?? 0.05;
    this.heartbeatMs = opts.heartbeatMs ?? 1500;
    this.minIntervalMs = opts.minIntervalMs ?? 50;
  }

  /** Should we broadcast right now? Updates internal state when returning true. */
  shouldSend(state: ThrottleState, now: number): boolean {
    if (now - this.lastSentAt < this.minIntervalMs) return false;
    const changed = this.hasChanged(state);
    const heartbeat = now - this.lastSentAt >= this.heartbeatMs;
    if (!changed && !heartbeat) return false;
    this.last = { ...state };
    this.lastSentAt = now;
    return true;
  }

  /** Force the next shouldSend() to fire (e.g. after reconnect). */
  reset(): void {
    this.last = null;
    this.lastSentAt = -Infinity;
  }

  private hasChanged(s: ThrottleState): boolean {
    const p = this.last;
    if (!p) return true;
    if (p.facing !== s.facing) return true;
    if (p.name !== s.name || p.color !== s.color || p.hat !== s.hat) return true;
    const dx = s.x - p.x;
    const dy = s.y - p.y;
    return dx * dx + dy * dy >= this.moveEpsilon * this.moveEpsilon;
  }
}

/** Helper: derive a ThrottleState from a PeerSnapshot. */
export function stateFromSnapshot(s: PeerSnapshot): ThrottleState {
  return { x: s.x, y: s.y, facing: s.facing, name: s.name, color: s.color, hat: s.hat };
}
