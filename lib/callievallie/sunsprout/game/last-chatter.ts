// Last-chatter tracker — v0.6.0 thirtieth slice.
//
// Tiny pure module that remembers the most recent peer id to send a chat
// line, with a TTL so a long-quiet peer eventually falls off. Wired into
// the chat-transport demux in a later tick so a "mute last speaker" keybind
// (planned M-key) has a well-defined target without rummaging through the
// ChatLog ring buffer.
//
// Design rules:
//   - Local-id ('local') is rejected; self-mute would be a footgun.
//   - Empty / whitespace ids are rejected too.
//   - get(now) returns null once the stored entry is older than ttlMs so
//     callers don't accidentally target someone who's logged off mid-game.
//   - Stateless w.r.t. clocks — caller passes `now`, matching the rest of
//     the multiplayer modules (ChatLog, PeerChats, PeerInterpolator).

const LOCAL_ID = 'local';
const DEFAULT_TTL_MS = 60_000;

function normalise(id: string): string | undefined {
  if (typeof id !== 'string') return undefined;
  const trimmed = id.trim();
  if (!trimmed) return undefined;
  if (trimmed === LOCAL_ID) return undefined;
  return trimmed;
}

export interface LastChatterEntry {
  id: string;
  /** ms timestamp of the last note() call. */
  at: number;
}

export class LastChatter {
  private entry: LastChatterEntry | null = null;
  readonly ttlMs: number;

  constructor(ttlMs: number = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs > 0 ? ttlMs : DEFAULT_TTL_MS;
  }

  /**
   * Record that `id` just chatted at `now`. Returns true if the stored
   * entry actually changed (new id or refreshed timestamp).
   */
  note(id: string, now: number): boolean {
    const key = normalise(id);
    if (!key) return false;
    if (!Number.isFinite(now)) return false;
    if (this.entry && this.entry.id === key && this.entry.at === now) {
      return false;
    }
    this.entry = { id: key, at: now };
    return true;
  }

  /**
   * Read the current last-chatter, or null if no one has chatted yet OR
   * the stored entry has expired relative to `now`.
   */
  get(now: number): LastChatterEntry | null {
    if (!this.entry) return null;
    if (!Number.isFinite(now)) return null;
    if (now - this.entry.at > this.ttlMs) return null;
    return { id: this.entry.id, at: this.entry.at };
  }

  /** Forget the current entry. */
  clear(): void {
    this.entry = null;
  }
}
