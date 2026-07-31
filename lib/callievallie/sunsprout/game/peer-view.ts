// Peer view — v0.6.0 fifth slice.
//
// Bridges raw PeerRegistry snapshots (10 Hz, jittery) into smooth per-frame
// render positions by feeding each peer's tile coords through a dedicated
// PeerInterpolator. The renderer asks for `viewAt(now)` once per frame and
// gets a list of {id, name, x, y, facing, color, hat} ready to draw.
//
// This module is pure logic — no canvas access. The renderer-wiring tick
// will instantiate one inside engine/game.ts alongside MultiplayerSession.

import {
  PeerInterpolator,
  type PeerPlayer,
  type PeerRegistry,
} from './multiplayer';

export interface PeerRenderable {
  id: string;
  name: string;
  /** Smoothed tile-space x. */
  x: number;
  /** Smoothed tile-space y. */
  y: number;
  facing: PeerPlayer['facing'];
  color: string;
  hat: string;
}

export interface PeerViewOpts {
  /** Interpolation delay in ms. Default 100ms (matches session cadence). */
  interpDelayMs?: number;
  /** Drop interpolators for peers absent this long. Default 2s. */
  pruneAfterMs?: number;
}

interface Track {
  interp: PeerInterpolator;
  lastFedAt: number;
  /** Last snapshot lastSeenAt we fed in — used to dedupe. */
  lastSeenAt: number;
}

export class PeerView {
  readonly interpDelayMs: number;
  readonly pruneAfterMs: number;
  private tracks = new Map<string, Track>();

  constructor(opts: PeerViewOpts = {}) {
    this.interpDelayMs = opts.interpDelayMs ?? 100;
    this.pruneAfterMs = opts.pruneAfterMs ?? 2000;
  }

  /** Number of active interpolator tracks. */
  size(): number {
    return this.tracks.size;
  }

  /** Drop all interpolators. */
  clear(): void {
    this.tracks.clear();
  }

  /**
   * Pull the latest snapshots from `registry`, feed each peer's position
   * into its interpolator, then return smoothed render positions for `now`.
   * Peers whose interpolators haven't been fed within `pruneAfterMs` are
   * dropped from the internal track map.
   */
  viewAt(registry: PeerRegistry, now: number): PeerRenderable[] {
    const seen = new Set<string>();
    const peers = registry.list();
    for (const p of peers) {
      seen.add(p.id);
      let track = this.tracks.get(p.id);
      if (!track) {
        track = {
          interp: new PeerInterpolator(this.interpDelayMs),
          lastFedAt: now,
          lastSeenAt: -1,
        };
        this.tracks.set(p.id, track);
      }
      if (p.lastSeenAt !== track.lastSeenAt) {
        track.interp.push({ t: p.lastSeenAt, x: p.x, y: p.y });
        track.lastSeenAt = p.lastSeenAt;
        track.lastFedAt = now;
      }
    }

    // Prune tracks for peers that have vanished from the registry for too long.
    for (const [id, track] of this.tracks) {
      if (!seen.has(id) && now - track.lastFedAt > this.pruneAfterMs) {
        this.tracks.delete(id);
      }
    }

    const out: PeerRenderable[] = [];
    for (const p of peers) {
      const track = this.tracks.get(p.id);
      if (!track) continue;
      const sampled = track.interp.sampleAt(now) ?? { x: p.x, y: p.y };
      out.push({
        id: p.id,
        name: p.name,
        x: sampled.x,
        y: sampled.y,
        facing: p.facing,
        color: p.color,
        hat: p.hat,
      });
    }
    return out;
  }
}
