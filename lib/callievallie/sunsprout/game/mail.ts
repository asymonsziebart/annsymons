// Mail — NPC letters delivered at heart milestones.
//
// As the player builds friendships, each candidate writes them a letter
// at fixed heart tiers (2, 4, 6, 8). Letters land in the player's
// mailbox queue and stay there until they're read. The mailbox lives
// on Player.mail; the unread count surfaces as a tiny badge on the
// farmhouse later. Reading is a dialogue-style overlay opened via the
// `[` key when standing on/adjacent to the farmhouse.
//
// Letters are pure data — content is canned per (npcId, tier) so the
// progression feels intentional, like Stardew's heart events without
// the cutscene cost.
//
// We persist the mailbox queue + `delivered` bookkeeping so reloading
// doesn't redeliver letters the player already received.

import type { Player } from '../world/world';
import { CANDIDATES, getHearts } from './hearts';

/** Heart tiers at which a candidate writes a letter. */
export const LETTER_TIERS = [2, 4, 6, 8] as const;

/** One letter in the player's mailbox. */
export interface Letter {
  /** NPC that wrote it. */
  npcId: string;
  /** Heart tier the letter unlocked at. */
  tier: number;
  /** In-game day the letter was delivered. */
  deliveredDay: number;
  /** Body copy. */
  body: string;
  /** True until the player opens the letter. */
  unread: boolean;
}

/** Player mailbox shape. Lives on Player.mail. */
export interface Mailbox {
  /** Inbox in delivery order; oldest first. */
  inbox: Letter[];
  /** Per-NPC array of tiers already delivered, so we never duplicate. */
  delivered: Record<string, number[]>;
}

/** Returns a fresh empty mailbox. */
export function emptyMailbox(): Mailbox {
  return { inbox: [], delivered: {} };
}

/** Lazy mailbox getter — creates one on first access. */
export function getMailbox(player: Player): Mailbox {
  const p = player as Player & { mail?: Mailbox };
  if (!p.mail) p.mail = emptyMailbox();
  return p.mail;
}

/** Letter body catalog, keyed by `${npcId}-${tier}`. */
export const LETTER_TEXT: Record<string, string> = {
  // Mayor Bramble — civic warmth, gets more vulnerable with each tier.
  'mayor-2': 'Dear friend,\n\nThe village book of new neighbours has a blank line by your name and I keep almost filling it in. Stop by my office? - Bramble',
  'mayor-4': 'Dear friend,\n\nI drafted a town poem last night. Most of the verses are about you. Forgive the schmaltz. - Bramble',
  'mayor-6': "Dear,\n\nThe lavender by the well bloomed twice this season. I'd like to take that as a sign. Yours, - Bramble",
  'mayor-8': "My dearest,\n\nI would resign as mayor tomorrow if it meant waking beside you. Say the word and I'll start packing. - Bramble",
  // Vallie — playful shopkeep, slips little gifts in the mail.
  'maple-2': "Hey neighbour!\n\nSet aside an extra seed packet for you. Free of charge - just don't tell the rest of the village. - Vallie",
  'maple-4': 'Hey you,\n\nI close the shop early some afternoons just to walk down to your farm. Hope that\u2019s alright. - Vallie',
  'maple-6': "Hello, sun,\n\nI sleep with one of your sunflowers pressed in a book. Don't tell anyone. - Vallie",
  'maple-8': "Love,\n\nTake the shop key. Take all of it. I just want to walk into a future that has you in it. - Vallie",
  // Finn — fisher, dreamy and a little goofy.
  'finn-2': 'Hi!\n\nCaught a heart-shaped pebble at the pond. It\u2019s in my pocket right now. Cheers, - Finn',
  'finn-4': "Friend,\n\nI rehearse what I'll say to you while I wait for a bite. Never sticks the landing. - Finn",
  'finn-6': 'You,\n\nMarry me by the pond, would you? I\u2019ll bring the frogs as witnesses. - Finn',
  'finn-8': "Heart,\n\nMade you a ring out of fishing line and a river-pebble. It's yours whenever you want it. - Finn",
  // Callie — innkeeper, hearth-warm.
  'rose-2': 'Welcome anytime,\n\nThe last bowl of pumpkin soup has your name on it tonight. - Callie',
  'rose-4': 'Dear,\n\nThe fire burns a little warmer on the nights you stay for supper. - Callie',
  'rose-6': 'Sweet one,\n\nThe upstairs room with the window facing your farm - it\u2019s yours if you want it. - Callie',
  'rose-8': "Beloved,\n\nLet's share the inn, the hearth, the years. I've set a place for you at every meal. - Callie",
};

/** Build a Letter object for (npcId, tier, day). Uses canned text or a fallback. */
export function makeLetter(npcId: string, tier: number, day: number): Letter {
  const body =
    LETTER_TEXT[`${npcId}-${tier}`] ?? `A short letter from ${CANDIDATES[npcId]?.name ?? npcId}.`;
  return {
    npcId,
    tier,
    deliveredDay: day,
    body,
    unread: true,
  };
}

/**
 * Walk every candidate; if their current hearts crossed a tier the
 * player hasn't received a letter for yet, drop a new letter into the
 * inbox. Returns the count of new letters delivered (useful for a
 * "1 new letter" morning toast).
 *
 * Idempotent — safe to call every day rollover. The same tier never
 * delivers twice.
 */
export function deliverDailyMail(player: Player, day: number): number {
  if (!player.hearts) return 0;
  const mail = getMailbox(player);
  let count = 0;
  for (const id of Object.keys(CANDIDATES)) {
    const hearts = getHearts(player.hearts, id);
    const got = mail.delivered[id] ?? [];
    for (const tier of LETTER_TIERS) {
      if (hearts >= tier && !got.includes(tier)) {
        mail.inbox.push(makeLetter(id, tier, day));
        got.push(tier);
        count++;
      }
    }
    mail.delivered[id] = got;
  }
  return count;
}

/** Returns the count of unread letters in the mailbox. */
export function unreadCount(player: Player): number {
  const mail = getMailbox(player);
  return mail.inbox.filter((l) => l.unread).length;
}

/**
 * Pop the oldest unread letter, mark it read, and return it. Returns
 * null when the inbox has nothing fresh. We KEEP read letters in the
 * inbox so the player can re-read them later (a recipe codex / letters
 * panel can list them all).
 */
export function readNextLetter(player: Player): Letter | null {
  const mail = getMailbox(player);
  const idx = mail.inbox.findIndex((l) => l.unread);
  if (idx === -1) return null;
  mail.inbox[idx].unread = false;
  return mail.inbox[idx];
}

/** Pretty preview (first 40 chars) for the future letters list. */
export function letterPreview(letter: Letter): string {
  const head = letter.body.split('\n')[0] ?? '';
  return head.length > 40 ? head.slice(0, 38) + '...' : head;
}
