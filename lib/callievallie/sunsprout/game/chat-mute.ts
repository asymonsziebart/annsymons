// Chat mute set — v0.6.0 twenty-ninth slice.
//
// Local-only mute list for peer ids. Held by the Game and consulted by the
// chat-transport demux before it pushes into ChatLog / PeerChats. Keeping
// this as a tiny standalone module so future ticks can also reach for it
// from the emote pipeline + a "muted" badge in the peer list, without
// either of those modules taking a direct dep on ChatLog.
//
// Design rules:
//   - No persistence, no DOM. Pure Set wrapper with normalised ids.
//   - Empty / whitespace ids are ignored — a muted set should never accept
//     a falsy key that would silently swallow real traffic.
//   - 'local' is rejected so you can't accidentally mute yourself out of
//     your own history; the composer always shows your sent lines.
//   - toggle() returns the post-state so callers can render the right
//     label ("mute" / "unmute") without a second isMuted() call.

const LOCAL_ID = 'local';

function normalise(id: string): string | undefined {
  if (typeof id !== 'string') return undefined;
  const trimmed = id.trim();
  if (!trimmed) return undefined;
  if (trimmed === LOCAL_ID) return undefined;
  return trimmed;
}

export class ChatMuteSet {
  private set = new Set<string>();

  /** Add a peer id to the mute set. Returns true if newly added. */
  mute(id: string): boolean {
    const key = normalise(id);
    if (!key) return false;
    if (this.set.has(key)) return false;
    this.set.add(key);
    return true;
  }

  /** Remove a peer id. Returns true if it was present. */
  unmute(id: string): boolean {
    const key = normalise(id);
    if (!key) return false;
    return this.set.delete(key);
  }

  /** Flip mute state. Returns the new state (true = now muted). */
  toggle(id: string): boolean {
    const key = normalise(id);
    if (!key) return false;
    if (this.set.has(key)) {
      this.set.delete(key);
      return false;
    }
    this.set.add(key);
    return true;
  }

  isMuted(id: string): boolean {
    const key = normalise(id);
    if (!key) return false;
    return this.set.has(key);
  }

  size(): number {
    return this.set.size;
  }

  /** Snapshot of muted ids (sorted for stable test output). */
  list(): string[] {
    return Array.from(this.set).sort();
  }

  clear(): void {
    this.set.clear();
  }
}
