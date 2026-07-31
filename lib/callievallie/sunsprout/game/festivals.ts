// Festivals — village-wide special days with banners and economic boosts.
//
// Two festivals fire on fixed calendar dates:
//
//   Spring Planting Fair — Spring (season 0), day 7
//     Vallie stocks bulk seeds at half price for a day. We model the
//     buyer-side benefit as a seed-sell discount: any *seed* purchase
//     made during the fair pays HALF the catalog price. Crops sold
//     into the well/shop are unaffected (the fair is about NEW crops).
//
//   Fall Harvest Festival — Fall (season 2), day 7
//     The village pays a premium for the season's labour. Every crop
//     sold into the well gets a 1.5x boost on top of star multipliers,
//     so a gold-star pumpkin clears 240g instead of 160g.
//
// Both festivals also trigger a thin banner under the top status bar
// (same chrome as the birthday banner). Gift multipliers and other
// systems can layer on later — this module exposes the multipliers
// so callers stay decoupled.

import type { TimeOfDay } from './time';

/** Catalog of named festivals. */
export type FestivalKey = 'planting-fair' | 'harvest-festival';

export interface FestivalDef {
  key: FestivalKey;
  /** Human-readable name shown on the banner. */
  name: string;
  /** Season the festival happens in (0=Spring, 1=Summer, 2=Fall, 3=Winter). */
  season: 0 | 1 | 2 | 3;
  /** Day-of-season (1..7) it lands on. */
  day: number;
  /** Multiplier applied to seed purchase prices (1 = no change). */
  seedBuyMultiplier: number;
  /** Multiplier applied to crop sell prices at the well (1 = no change). */
  cropSellMultiplier: number;
  /** Banner blurb for the HUD. */
  banner: string;
}

export const FESTIVALS: Record<FestivalKey, FestivalDef> = {
  'planting-fair': {
    key: 'planting-fair',
    name: 'Spring Planting Fair',
    season: 0,
    day: 7,
    seedBuyMultiplier: 0.5,
    cropSellMultiplier: 1,
    banner: 'Spring Planting Fair: every seed is half-price today!',
  },
  'harvest-festival': {
    key: 'harvest-festival',
    name: 'Fall Harvest Festival',
    season: 2,
    day: 7,
    seedBuyMultiplier: 1,
    cropSellMultiplier: 1.5,
    banner: 'Fall Harvest Festival: the village pays 1.5x for your crops!',
  },
};

/** All keys in calendar order. */
export const FESTIVAL_KEYS: FestivalKey[] = Object.keys(FESTIVALS) as FestivalKey[];

/** Returns the festival happening today, or null. (At most one per day.) */
export function festivalToday(time: TimeOfDay): FestivalDef | null {
  for (const key of FESTIVAL_KEYS) {
    const f = FESTIVALS[key];
    if (f.season === time.season && f.day === time.day) return f;
  }
  return null;
}

/** True when today is the given festival's date. */
export function isFestivalToday(key: FestivalKey, time: TimeOfDay): boolean {
  const f = FESTIVALS[key];
  return f.season === time.season && f.day === time.day;
}

/** Banner string for the HUD. Returns null when there's no festival. */
export function festivalBanner(time: TimeOfDay): string | null {
  const f = festivalToday(time);
  return f ? f.banner : null;
}

/** Multiplier applied to a seed-buy price today (defaults to 1). */
export function seedBuyMultiplier(time: TimeOfDay): number {
  const f = festivalToday(time);
  return f ? f.seedBuyMultiplier : 1;
}

/** Multiplier applied to crop sell prices today (defaults to 1). */
export function cropSellMultiplier(time: TimeOfDay): number {
  const f = festivalToday(time);
  return f ? f.cropSellMultiplier : 1;
}

/** Days until the next festival from `time`. 0 means today. Wraps full year. */
export function daysUntilFestival(key: FestivalKey, time: TimeOfDay): number {
  const f = FESTIVALS[key];
  const todayIdx = time.season * 7 + (time.day - 1);
  const festIdx = f.season * 7 + (f.day - 1);
  return (festIdx - todayIdx + 28) % 28;
}

/** Calendar listing of every festival, sorted by next-up. */
export function festivalCalendar(
  time: TimeOfDay,
): Array<{ key: FestivalKey; name: string; daysUntil: number; season: number; day: number }> {
  return FESTIVAL_KEYS.map((k) => ({
    key: k,
    name: FESTIVALS[k].name,
    daysUntil: daysUntilFestival(k, time),
    season: FESTIVALS[k].season,
    day: FESTIVALS[k].day,
  })).sort((a, b) => a.daysUntil - b.daysUntil);
}
