// Mute-history undo stack — v0.6.0 thirty-fifth slice.
//
// Tiny pure module that remembers prior ChatMuteSet snapshots so a future
// Shift+U "restore last mute list" keybind can put back the peers that the
// `u` (unmute-all) keybind just cleared. Held alongside the ChatMuteSet on
// the driver; pushed to by handleUnmuteAllKeybind in a later slice.
//
// Design rules:
//   - No DOM, no clocks. Pure ring buffer of string-id arrays.
//   - Empty / whitespace ids are filtered on push so a popped snapshot is
//     always safe to feed straight back into ChatMuteSet.mute().
//   - Empty snapshots are rejected — there's nothing to undo if the set was
//     already empty when the user pressed `u`.
//   - 'local' is filtered for the same reason ChatMuteSet rejects it.
//   - Bounded depth (default 8) so a long session of accidental mass-mutes
//     can't balloon memory.
//   - peek() returns a defensive copy; pop() removes and returns it.

const LOCAL_ID = 'local';
const DEFAULT_DEPTH = 8;

function sanitize(ids: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const t = raw.trim();
    if (!t || t === LOCAL_ID) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  out.sort();
  return out;
}

export class MuteHistory {
  private stack: string[][] = [];
  readonly depth: number;

  constructor(depth: number = DEFAULT_DEPTH) {
    this.depth = depth > 0 ? Math.floor(depth) : DEFAULT_DEPTH;
  }

  /**
   * Push a snapshot of currently-muted ids. Returns true if the snapshot
   * was accepted (non-empty after sanitisation).
   */
  push(ids: readonly string[]): boolean {
    const cleaned = sanitize(ids);
    if (cleaned.length === 0) return false;
    // Skip if this snapshot is identical to the current top — prevents the
    // bounded ring from filling with duplicates when the user spam-presses
    // `u` (unmute-all) without re-muting anyone in between.
    const top = this.stack[this.stack.length - 1];
    if (top && top.length === cleaned.length) {
      let same = true;
      for (let i = 0; i < top.length; i++) {
        if (top[i] !== cleaned[i]) { same = false; break; }
      }
      if (same) return false;
    }
    this.stack.push(cleaned);
    while (this.stack.length > this.depth) this.stack.shift();
    return true;
  }

  /** Most-recent snapshot (defensive copy) or null. */
  peek(): string[] | null {
    if (this.stack.length === 0) return null;
    return this.stack[this.stack.length - 1].slice();
  }

  /** Pop + return the most-recent snapshot, or null if empty. */
  pop(): string[] | null {
    const top = this.stack.pop();
    return top ? top.slice() : null;
  }

  size(): number {
    return this.stack.length;
  }

  clear(): void {
    this.stack.length = 0;
  }

  /**
   * Drop a specific peer id from every stored snapshot — used when a peer
   * disconnects so a future restore-mutes won't try to re-mute someone who
   * is no longer in the session. Snapshots that become empty after pruning
   * are removed from the stack entirely. Returns the number of snapshots
   * that were modified (including those removed).
   */
  /**
   * True if any stored snapshot contains the given peer id. Lets future UI
   * (e.g. a peer-row hover hint) tell the user "you've mass-muted this peer
   * before" without re-muting them. Filters local/empty just like push.
   */
  has(id: string): boolean {
    if (typeof id !== 'string') return false;
    const t = id.trim();
    if (!t || t === LOCAL_ID) return false;
    for (const snap of this.stack) {
      if (snap.indexOf(t) !== -1) return true;
    }
    return false;
  }

  /**
   * Sorted, deduped list of every peer id appearing in any stored snapshot.
   * Lets future UI surface "peers you've previously mass-muted" without
   * forcing callers to walk the stack themselves. Returns [] when empty.
   */
  allIds(): string[] {
    const seen = new Set<string>();
    for (const snap of this.stack) {
      for (const id of snap) seen.add(id);
    }
    const out = Array.from(seen);
    out.sort();
    return out;
  }

  prune(id: string): number {
    if (typeof id !== 'string') return 0;
    const t = id.trim();
    if (!t || t === LOCAL_ID) return 0;
    let touched = 0;
    const next: string[][] = [];
    for (const snap of this.stack) {
      const idx = snap.indexOf(t);
      if (idx === -1) { next.push(snap); continue; }
      touched++;
      const filtered = snap.filter((s) => s !== t);
      if (filtered.length > 0) next.push(filtered);
    }
    this.stack = next;
    return touched;
  }
}
