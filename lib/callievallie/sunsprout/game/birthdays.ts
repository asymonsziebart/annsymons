// NPC birthdays — calendar-tied special days with banner + gift multiplier.
//
// Every romanceable NPC has a single fixed (season, day) birthday. On
// their birthday:
//   1. A persistent banner appears in the HUD ("Today is Vallie's birthday!")
//   2. Gifts to that NPC apply a 8× point multiplier — a single loved gift
//      can clear two whole heart tiers, making birthdays the easiest way
//      to land a wedding bouquet.
//   3. Birthday flavour shows in the candidate's dialogue pool.
//
// Pure data + helper module. Wired into hearts.giveGift via a small
// `birthdayMultiplier` lookup the gifting layer calls before applying
// points.

import type { TimeOfDay } from './time';
import { CANDIDATES } from './hearts';

/** Birthday spec: which (season, day) the NPC turns one year older. */
export interface Birthday {
  /** 0=Spring, 1=Summer, 2=Fall, 3=Winter. */
  season: 0 | 1 | 2 | 3;
  /** Day-of-season 1..7. */
  day: number;
}

/**
 * Birthdays are fixed per NPC. Chosen to spread across the four seasons:
 *   Mayor Bramble — Spring day 3 (the village's first festival energy)
 *   Vallie        — Summer day 5 (mid-summer shop bustle)
 *   Finn         — Fall day 2 (the great trout migration)
 *   Callie         — Winter day 6 (the long-night feast)
 */
export const BIRTHDAYS: Record<string, Birthday> = {
  mayor: { season: 0, day: 3 },
  maple: { season: 1, day: 5 },
  finn:  { season: 2, day: 2 },
  rose:  { season: 3, day: 6 },
};

/** Gift point multiplier on an NPC's birthday — applied in hearts.giveGift. */
export const BIRTHDAY_GIFT_MULTIPLIER = 8;

/** Pretty season label for the banner. */
export const SEASON_NAMES = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

/** True when today is the given NPC's birthday. */
export function isBirthdayToday(npcId: string, time: TimeOfDay): boolean {
  const b = BIRTHDAYS[npcId];
  if (!b) return false;
  return b.season === time.season && b.day === time.day;
}

/** Returns the NPC whose birthday is today, or null. (At most one per day.) */
export function birthdayCelebrant(time: TimeOfDay): string | null {
  for (const [id, b] of Object.entries(BIRTHDAYS)) {
    if (b.season === time.season && b.day === time.day) return id;
  }
  return null;
}

/** Multiplier to apply to a gift's points. Returns 1× unless it's their birthday. */
export function giftMultiplier(npcId: string, time: TimeOfDay): number {
  return isBirthdayToday(npcId, time) ? BIRTHDAY_GIFT_MULTIPLIER : 1;
}

/** Pretty banner string for the HUD when somebody has a birthday. */
export function birthdayBanner(time: TimeOfDay): string | null {
  const id = birthdayCelebrant(time);
  if (!id) return null;
  const name = CANDIDATES[id]?.name ?? id;
  return `Today is ${name}'s birthday! Gifts count for ${BIRTHDAY_GIFT_MULTIPLIER}x.`;
}

/**
 * Days until the next birthday for `npcId`. Counts from `time` forward.
 * Used by the calendar/relationships panel to surface a soft reminder.
 * 0 means "today". Wraps full year (28 days = 4 seasons × 7).
 */
export function daysUntilBirthday(npcId: string, time: TimeOfDay): number {
  const b = BIRTHDAYS[npcId];
  if (!b) return -1;
  const todayIdx = time.season * 7 + (time.day - 1);
  const bdayIdx = b.season * 7 + (b.day - 1);
  const diff = (bdayIdx - todayIdx + 28) % 28;
  return diff;
}

/** Returns every NPC id with a birthday, sorted by next-up. */
export function birthdayCalendar(time: TimeOfDay): Array<{
  npcId: string;
  name: string;
  daysUntil: number;
  season: number;
  day: number;
}> {
  return Object.keys(BIRTHDAYS)
    .map((id) => ({
      npcId: id,
      name: CANDIDATES[id]?.name ?? id,
      daysUntil: daysUntilBirthday(id, time),
      season: BIRTHDAYS[id].season,
      day: BIRTHDAYS[id].day,
    }))
    .sort((a, b) => a.daysUntil - b.daysUntil);
}
