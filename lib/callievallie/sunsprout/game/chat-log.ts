// Chat log — v0.6.0 twenty-seventh slice.
//
// Rolling history of recent chat lines from any source (local player or a
// peer). Pure ring buffer with sanitisation + an optional source tag so the
// future chat-history HUD can render speaker names. Kept distinct from
// PeerChats (which holds per-peer TTL bubbles for the world-space speech
// balloons) — this is the bottom-of-screen "channel" backing store.
//
// Design rules:
//   - No timers, no DOM, no rendering. Pure data + queries.
//   - Sanitises every body through chat-wire.sanitizeChatText so the log
//     matches what went on the wire.
//   - Bounded by MAX_ENTRIES; oldest evicted FIFO.
//   - Stable, monotonically rising sequence numbers so the UI can dedup /
//     animate appends without comparing strings.

import { sanitizeChatText } from './chat-wire';

export const CHAT_LOG_MAX = 64;

export interface ChatLogEntry {
  /** Monotonic id assigned at push time (1-based). */
  seq: number;
  /** Stable speaker id. Use 'local' for the player, peerId otherwise. */
  source: string;
  /** Sanitised chat body (never empty). */
  text: string;
  /** Wall-clock ms when this entry was appended. */
  at: number;
}

export class ChatLog {
  readonly capacity: number;
  private buf: ChatLogEntry[] = [];
  private nextSeq = 1;

  constructor(capacity: number = CHAT_LOG_MAX) {
    this.capacity = Math.max(1, Math.floor(capacity));
  }

  /**
   * Append a line. Returns the stored entry or undefined if the body
   * sanitised to empty / source was falsy.
   */
  push(source: string, body: string, now: number): ChatLogEntry | undefined {
    if (!source) return undefined;
    const text = sanitizeChatText(body);
    if (!text) return undefined;
    const entry: ChatLogEntry = {
      seq: this.nextSeq++,
      source,
      text,
      at: now,
    };
    this.buf.push(entry);
    if (this.buf.length > this.capacity) {
      this.buf.splice(0, this.buf.length - this.capacity);
    }
    return entry;
  }

  /** All entries, oldest → newest. Returned array is a defensive copy. */
  list(): ChatLogEntry[] {
    return this.buf.slice();
  }

  /** Last N entries, oldest → newest within that slice. */
  tail(n: number): ChatLogEntry[] {
    if (n <= 0) return [];
    return this.buf.slice(Math.max(0, this.buf.length - Math.floor(n)));
  }

  /** Number of stored entries. */
  size(): number {
    return this.buf.length;
  }

  /** Most recently assigned sequence number (0 if log is empty). */
  lastSeq(): number {
    return this.nextSeq - 1;
  }

  /** Drop everything. Sequence numbers continue to climb. */
  clear(): void {
    this.buf.length = 0;
  }
}
