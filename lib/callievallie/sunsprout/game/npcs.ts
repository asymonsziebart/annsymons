// NPC schedules and cozy dialogue.
//
// The world ships with four named NPCs (Mayor Bramble, Vallie the Shopkeep,
// Finn the Fisher, and Callie the Innkeeper). This module hangs daily
// schedules and warm, wholesome dialogue off each of them. We don't try
// to do real path-finding — NPCs simply ease toward their scheduled
// (x,y) anchor when the in-game hour falls inside their window.
//
// Dialogue selection is deterministic per (day * 100 + npc-id-hash) so
// the player gets the same line if they re-open the box in the same day,
// but the lines rotate as the days roll over.

import type { NPC, World } from '../world/world';
import type { TimeOfDay } from './time';
import { spouseAnchor } from './spouse';
import { routeAnchor } from './npc-route';

/** A schedule slot: between `from` and `to` the NPC drifts toward (x,y).
 *  If `walkTo` is set, the NPC paces between (x,y) and (walkTo.x, walkTo.y)
 *  across the hour window — see npc-route.ts for the lerp math. */
export interface ScheduleSlot {
  from: number;
  to: number;
  x: number;
  y: number;
  /** Optional secondary waypoint — NPC paces (x,y) <-> walkTo. */
  walkTo?: { x: number; y: number };
  /** Override the default route period (in in-game hours). */
  periodHours?: number;
}

/** Dialogue + schedule metadata, keyed by NPC id. */
export interface NPCDef {
  schedule: ScheduleSlot[];
  dialogue: string[];
  role: string;
  /**
   * Extra dialogue unlocked at heart tiers. Keys are minimum heart counts
   * required (2, 4, 6). When the player has ≥ tier hearts, the line pool
   * is *extended* with those lines so the romance ramps up gradually
   * instead of replacing the friendly small-talk entirely.
   */
  affection?: Record<number, string[]>;
}

/** Heart tiers that can unlock extra dialogue, descending. */
export const AFFECTION_TIERS = [8, 6, 4, 2] as const;

export const NPC_DEFS: Record<string, NPCDef> = {
  mayor: {
    role: 'Mayor of the Valley',
    schedule: [
      // Morning: paces the well plaza, weighing in on village business.
      { from: 6, to: 10, x: 19, y: 6, walkTo: { x: 21, y: 6 } },
      // Midday: walks down to the south path to inspect the road.
      { from: 10, to: 14, x: 18, y: 9, walkTo: { x: 18, y: 11 } },
      // Afternoon: settles back near the plaza, ambling between two posts.
      { from: 14, to: 22, x: 20, y: 7, walkTo: { x: 22, y: 7 } },
    ],
    dialogue: [
      'The lavender by the well bloomed early this year — must be a good omen.',
      "I've been keeping a list of every newcomer's favourite flower. Yours?",
      'A village is just neighbours who agreed to learn each other\'s names.',
      'Mind the loose stone by the south path. I keep meaning to fix it.',
      'There\'s an old cave mouth in the northeast — copper in the walls, if you bring a pickaxe.',
      'Spring rain on a clay roof is the best lullaby in the world.',
      'You\'ve been farming hard. I hope the work has been kind to you too.',
    ],
    affection: {
      2: ['I find myself looking for you at the well some mornings. Strange habit.'],
      4: ['The village feels brighter on the days you stop by my office.'],
      6: ['I drafted a town poem last night. Most of the verses are about you.'],
      8: ['I would resign as mayor tomorrow if it meant waking beside you. Say the word.'],
    },
  },
  maple: {
    role: 'Shopkeep',
    schedule: [
      { from: 6, to: 9, x: 24, y: 7 },
      // Shop hours: paces between the counter and the door.
      { from: 9, to: 19, x: 24, y: 8, walkTo: { x: 25, y: 9 } },
      { from: 19, to: 22, x: 24, y: 7 },
    ],
    dialogue: [
      'Fresh seeds came in this morning — tomatoes love a sunny patch.',
      'If you ever bring me a perfect pumpkin, the price goes up. Just a warning.',
      "Flowers won't fill your belly, but they pay the rent in cheer.",
      'A copper coin saved is two you don\'t have to chase down later.',
      'Bring me five wheat and I\'ll tell you a little secret about the well.',
      'Plant something every week. The harvest knows when you\'ve been faithful.',
    ],
    affection: {
      2: ['I set aside the prettiest seed packets when I know you\'re coming by.'],
      4: ['Sometimes I close the shop early just to walk down to your farm.'],
      6: ['I sleep with one of your sunflowers pressed in a book. Don\'t tell anyone.'],
      8: ['Take the shop key. Take all of it. I just want to walk into a future that has you in it.'],
    },
  },
  finn: {
    role: 'Fisher',
    schedule: [
      // Dawn: paces the pond edge.
      { from: 6, to: 11, x: 7, y: 21, walkTo: { x: 8, y: 22 } },
      { from: 11, to: 14, x: 8, y: 21 },
      { from: 14, to: 18, x: 7, y: 21, walkTo: { x: 6, y: 22 } },
      { from: 18, to: 22, x: 18, y: 8 },
    ],
    dialogue: [
      'Caught a fish with stripes today. Threw it back — it had work to do.',
      'The pond gets quieter just before dusk. That\'s when the big ones bite.',
      "I caught a frog! It blinked at me!",
      'A patient angler hears more secrets than a tavern keep.',
      'If you\'re ever lost, follow the water. It always knows the way home.',
      'Trade you a rare fish for a pumpkin. Don\'t ask me why — just an old craving.',
    ],
    affection: {
      2: ['Caught a heart-shaped pebble at the pond. Kept it in my pocket all day.'],
      4: ['I rehearse what I\'ll say to you while I wait for a bite. Never sticks the landing.'],
      6: ['Marry me by the pond, would you? I\'ll bring the frogs as witnesses.'],
      8: ['Made you a ring out of fishing line and a river-pebble. It\'s yours whenever you want it.'],
    },
  },
  rose: {
    role: 'Innkeeper',
    schedule: [
      { from: 6, to: 8, x: 15, y: 9 },
      // Service hours: paces between the long table and the kitchen window.
      { from: 8, to: 22, x: 15, y: 8, walkTo: { x: 16, y: 9 }, periodHours: 3 },
    ],
    dialogue: [
      "Carrots forgive a missed watering. Tomatoes do not.",
      'There\'s a room upstairs with your name on the door, if you ever need it.',
      'Plant flowers between your crops. Bees will thank you.',
      'I make a soup on rainy days. You\'re always welcome at the long table.',
      'Sleep early, dream gentle, wake with dirt under your nails. That\'s the village way.',
      'A stranger is just a friend who hasn\'t taken off their boots yet.',
    ],
    affection: {
      2: ['I saved the last bowl of pumpkin soup with your name on it.'],
      4: ['The fire burns a little warmer on the nights you stay for supper.'],
      6: ['Move into the upstairs room. The one with the window facing your farm.'],
      8: ['Let\'s share the inn, the hearth, the years. I\'ve set a place for you at every meal.'],
    },
  },
};

/** Cheap deterministic hash for picking a dialogue line per (npc,day). */
function hash(s: string, day: number): number {
  let h = day * 2654435761;
  for (let i = 0; i < s.length; i++) {
    h = (h ^ s.charCodeAt(i)) * 16777619;
    h = h | 0;
  }
  return Math.abs(h);
}

/** Returns the dialogue pool for an NPC, including affection lines unlocked at `hearts`. */
export function dialoguePool(npcId: string, hearts: number): string[] {
  const def = NPC_DEFS[npcId];
  if (!def) return [];
  const pool = [...def.dialogue];
  if (def.affection) {
    for (const tier of AFFECTION_TIERS) {
      if (hearts >= tier && def.affection[tier]) {
        pool.push(...def.affection[tier]);
      }
    }
  }
  return pool;
}

/** Picks a single dialogue line for the given NPC + current day. */
export function getDialogue(npc: NPC, day: number, hearts: number = 0): string {
  const pool = dialoguePool(npc.id, hearts);
  if (pool.length === 0) {
    return `${npc.name} smiles at you warmly.`;
  }
  const i = hash(npc.id, day) % pool.length;
  return pool[i];
}

/** Looks up role text for the dialogue box header. */
export function getRole(npc: NPC): string {
  return NPC_DEFS[npc.id]?.role ?? '';
}

/** Returns the schedule anchor for the current hour, or null for "stay put". */
export function getCurrentAnchor(
  npc: NPC,
  hour: number,
  minute: number = 0,
): { x: number; y: number } | null {
  const def = NPC_DEFS[npc.id];
  if (!def) return null;
  for (const slot of def.schedule) {
    if (hour >= slot.from && hour < slot.to) {
      // If the slot has a walkTo waypoint, interpolate via cosine wave
      // so the NPC eases between (x,y) and walkTo across the period.
      if (slot.walkTo) {
        return routeAnchor(
          { x: slot.x, y: slot.y },
          slot.walkTo,
          hour,
          minute,
          slot.periodHours,
        );
      }
      return { x: slot.x, y: slot.y };
    }
  }
  return null;
}

/**
 * Eases each NPC toward its current schedule anchor. NPCs don't do real
 * path-finding — they just nudge a tiny fraction of a tile per tick toward
 * the target, which is plenty for ambient village motion.
 *
 * Special-case: if the player is married to this NPC, the spouse anchor
 * (south of the farmhouse during day, inside at night) takes priority
 * over the public schedule — they've moved in.
 */
export function updateNPCs(world: World, time: TimeOfDay, dtMs: number): void {
  const speed = 0.0008; // tiles per ms when far from anchor
  const spouseId = world.player?.marriage?.npcId;
  const spouse = spouseId ? spouseAnchor(world, time) : null;
  for (const npc of world.npcs) {
    let anchor: { x: number; y: number } | null;
    if (spouse && spouseId === npc.id) {
      anchor = { x: spouse.x, y: spouse.y };
    } else {
      anchor = getCurrentAnchor(npc, time.hour, time.minute);
    }
    if (!anchor) continue;
    const dx = anchor.x - npc.x;
    const dy = anchor.y - npc.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.05) {
      npc.x = anchor.x;
      npc.y = anchor.y;
      continue;
    }
    const step = Math.min(dist, speed * dtMs);
    npc.x += (dx / dist) * step;
    npc.y += (dy / dist) * step;
    // Update facing for visual variety.
    if (Math.abs(dx) > Math.abs(dy)) {
      npc.facing = dx > 0 ? 'right' : 'left';
    } else {
      npc.facing = dy > 0 ? 'down' : 'up';
    }
  }
}

/** Returns the NPC adjacent to (or on the tile in front of) the player, or null. */
export function npcInFrontOf(
  world: World,
  tx: number,
  ty: number,
): NPC | null {
  for (const npc of world.npcs) {
    const ntx = Math.round(npc.x);
    const nty = Math.round(npc.y);
    if (ntx === tx && nty === ty) return npc;
  }
  return null;
}
