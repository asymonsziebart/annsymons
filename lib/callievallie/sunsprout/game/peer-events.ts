// Multiplayer peer events — v0.6.0 fourteenth slice.
//
// The MultiplayerSession already returns the ids of peers it evicted on each
// tick, but nothing tells the game when a peer *joined* (newly observed in
// the registry). To drive friendly "Alex joined your farm" / "Alex left"
// toasts we need both edges.
//
// PeerPresenceLog is a pure diff-er: feed it the current PeerRegistry
// snapshot each tick and it returns a list of PeerEvent records for the
// transitions since the previous call. No DOM, no toast UI — a later
// slice wires the events into a HUD overlay.

import type { PeerPlayer, PeerRegistry } from './multiplayer';

export type PeerEventKind = 'join' | 'leave';

export interface PeerEvent {
  kind: PeerEventKind;
  id: string;
  /** Display name captured at the moment of the event. For 'leave' this is
   *  the last name we ever saw — handy for the toast even though the peer
   *  is already gone from the registry. */
  name: string;
  /** ms timestamp the diff was observed. */
  at: number;
}

interface KnownPeer {
  name: string;
}

export class PeerPresenceLog {
  private known = new Map<string, KnownPeer>();

  /** Number of peers currently tracked. */
  size(): number {
    return this.known.size;
  }

  /** True iff we've ever recorded a peer with this id. */
  has(id: string): boolean {
    return this.known.has(id);
  }

  /**
   * Diff the registry against our last-seen snapshot. Returns events for
   * every peer that joined or left since the previous call. The returned
   * array is empty on the happy path — safe to ignore.
   */
  diff(registry: PeerRegistry, now: number): PeerEvent[] {
    const events: PeerEvent[] = [];
    const seen = new Set<string>();

    for (const p of registry.list()) {
      seen.add(p.id);
      const prev = this.known.get(p.id);
      if (!prev) {
        events.push({ kind: 'join', id: p.id, name: p.name, at: now });
        this.known.set(p.id, { name: p.name });
      } else if (prev.name !== p.name) {
        // Track latest name so a future 'leave' event uses the up-to-date one.
        prev.name = p.name;
      }
    }

    // Anything we knew about but didn't see this tick has left.
    for (const [id, prev] of this.known) {
      if (seen.has(id)) continue;
      events.push({ kind: 'leave', id, name: prev.name, at: now });
      this.known.delete(id);
    }

    return events;
  }

  /** Seed the log from an existing registry without emitting join events.
   *  Useful when attaching to a session that's already mid-flight so the
   *  first diff() doesn't spam the player with welcome toasts. */
  seed(registry: PeerRegistry): void {
    this.known.clear();
    for (const p of registry.list() as PeerPlayer[]) {
      this.known.set(p.id, { name: p.name });
    }
  }

  /** Forget every peer. Subsequent diff() calls treat all current peers as
   *  newly joined. */
  clear(): void {
    this.known.clear();
  }
}
