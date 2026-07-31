// Peer emotes — v0.6.0 sixteenth slice.
//
// Tiny pure module: stores short-lived emote bubbles (e.g. "👋", "🌱", "❤")
// keyed by peer id. The renderer queries activeFor(id, now) each frame and
// draws a bubble above the sprite when present. Snapshots and transport
// wiring come in a later slice — this lands the data layer + tests first
// so we can prove TTL pruning and per-peer dedup before touching the wire.
//
// Why a separate module: PeerRegistry holds *position* state that we
// snapshot every frame; emotes are *event* state with their own TTL and
// shouldn't bloat the snapshot. Keeping them isolated lets us also fire
// emotes for the local player (waving at yourself) without round-tripping.

export type EmoteKind = 'wave' | 'heart' | 'sprout' | 'sparkle' | 'note';

const EMOTE_TTL_MS = 2200;
const MAX_PER_PEER = 1; // one bubble at a time per peer; latest wins
const MAX_TOTAL = 32; // hard cap across all peers — defensive

export interface ActiveEmote {
  peerId: string;
  kind: EmoteKind;
  bornAt: number;
  diesAt: number;
}

const VALID: ReadonlySet<EmoteKind> = new Set<EmoteKind>([
  'wave',
  'heart',
  'sprout',
  'sparkle',
  'note',
]);

export function isEmoteKind(v: unknown): v is EmoteKind {
  return typeof v === 'string' && VALID.has(v as EmoteKind);
}

export class PeerEmotes {
  private byPeer = new Map<string, ActiveEmote>();

  /** Push an emote for a peer. Replaces any existing emote for that peer
   *  (only one bubble shown at once — keeps the screen calm). */
  push(peerId: string, kind: EmoteKind, now: number): void {
    if (!peerId || !isEmoteKind(kind)) return;
    this.prune(now);
    if (this.byPeer.size >= MAX_TOTAL && !this.byPeer.has(peerId)) {
      // Evict the oldest if we're at the cap and adding a new peer.
      let oldestId: string | undefined;
      let oldestBorn = Infinity;
      for (const [id, e] of this.byPeer) {
        if (e.bornAt < oldestBorn) {
          oldestBorn = e.bornAt;
          oldestId = id;
        }
      }
      if (oldestId) this.byPeer.delete(oldestId);
    }
    this.byPeer.set(peerId, {
      peerId,
      kind,
      bornAt: now,
      diesAt: now + EMOTE_TTL_MS,
    });
    void MAX_PER_PEER; // reserved for future stacking
  }

  /** Return the active emote for a peer, or undefined. */
  activeFor(peerId: string, now: number): ActiveEmote | undefined {
    const e = this.byPeer.get(peerId);
    if (!e) return undefined;
    if (e.diesAt <= now) {
      this.byPeer.delete(peerId);
      return undefined;
    }
    return e;
  }

  /** All currently-live emotes (post-prune). Order is insertion order. */
  list(now: number): ActiveEmote[] {
    this.prune(now);
    return Array.from(this.byPeer.values());
  }

  /** Count of live emotes after pruning. Test-only convenience. */
  size(now: number): number {
    this.prune(now);
    return this.byPeer.size;
  }

  /** Drop a peer's emote — e.g. on peer leave. */
  forget(peerId: string): void {
    this.byPeer.delete(peerId);
  }

  /** Drop everything. */
  clear(): void {
    this.byPeer.clear();
  }

  private prune(now: number): void {
    for (const [id, e] of this.byPeer) {
      if (e.diesAt <= now) this.byPeer.delete(id);
    }
  }
}
