// Tiny quest system. Three starter quests are seeded onto the player at
// spawn. Each in-game event (plant / harvest / talk) calls checkQuests
// which advances any matching quest and applies its reward on completion.

import type { Player } from '../world/world';
import { addItem } from './economy';
import { GEM_KEYS } from './gems';

export type QuestEvent =
  | { kind: 'plant'; cropKey: string }
  | { kind: 'harvest'; cropKey: string }
  | { kind: 'talk'; npcId: string }
  | { kind: 'cook'; dishKey: string }
  | { kind: 'mine'; gemKey: string }
  | { kind: 'gift'; npcId: string; hearts: number }
  | { kind: 'marry'; npcId: string };

export interface QuestReward {
  gold?: number;
  items?: Record<string, number>;
  cosmetic?: string;
}

export interface Quest {
  id: string;
  name: string;
  description: string;
  /** Target count to complete the quest. */
  goal: number;
  /** Current progress, 0..goal. */
  progress: number;
  /** Players we've already credited for "talk" quests (deduplicates per NPC). */
  seen: string[];
  reward: QuestReward;
  complete: boolean;
}

/** Fresh quest objects, used on player spawn. */
export function startingQuests(): Quest[] {
  return [
    {
      id: 'first-sprout',
      name: 'First Sprout',
      description: 'Plant your first seed.',
      goal: 1,
      progress: 0,
      seen: [],
      reward: { gold: 10 },
      complete: false,
    },
    {
      id: 'wheat-five',
      name: 'A Good Harvest',
      description: 'Harvest five wheat.',
      goal: 5,
      progress: 0,
      seen: [],
      reward: { gold: 50, items: { tomato: 3 } },
      complete: false,
    },
    {
      id: 'good-neighbor',
      name: 'Good Neighbour',
      description: 'Say hello to every villager.',
      goal: 4,
      progress: 0,
      seen: [],
      reward: { gold: 100, cosmetic: 'sunhat' },
      complete: false,
    },
    {
      id: 'first-recipe',
      name: 'First Recipe',
      description: 'Cook your first dish at the inn.',
      goal: 1,
      progress: 0,
      seen: [],
      reward: { gold: 40, items: { wheat: 2 } },
      complete: false,
    },
    {
      id: 'first-gem',
      name: 'First Gem',
      description: 'Mine your first gem from the cave.',
      goal: 1,
      progress: 0,
      seen: [],
      reward: { gold: 60, items: { wheat: 3 } },
      complete: false,
    },
    {
      id: 'geologist',
      name: 'Geologist',
      description: 'Mine at least one of every gem kind.',
      goal: GEM_KEYS.length,
      progress: 0,
      seen: [],
      reward: { gold: 250, items: { pumpkin: 2 } },
      complete: false,
    },
    {
      id: 'sweetheart',
      name: 'Sweetheart',
      description: 'Reach 2 hearts with any villager.',
      goal: 1,
      progress: 0,
      seen: [],
      reward: { gold: 80, items: { flower: 2 } },
      complete: false,
    },
    {
      id: 'confidant',
      name: 'Confidant',
      description: 'Reach 4 hearts with any villager.',
      goal: 1,
      progress: 0,
      seen: [],
      reward: { gold: 160, items: { flower: 3 } },
      complete: false,
    },
    {
      id: 'devoted',
      name: 'Devoted',
      description: 'Reach 6 hearts with any villager.',
      goal: 1,
      progress: 0,
      seen: [],
      reward: { gold: 320, items: { pumpkin: 2, flower: 5 } },
      complete: false,
    },
    {
      id: 'soulmate',
      name: 'Soulmate',
      description: 'Reach 8 hearts with any villager.',
      goal: 1,
      progress: 0,
      seen: [],
      reward: { gold: 640, items: { bouquet: 1, pumpkin: 3 } },
      complete: false,
    },
    {
      id: 'newlywed',
      name: 'Newlywed',
      description: 'Hold a wedding at the village well.',
      goal: 1,
      progress: 0,
      seen: [],
      reward: { gold: 1000, items: { bouquet: 2, pumpkin: 5 } },
      complete: false,
    },
  ];
}

/**
 * Inspect the event against every open quest. Advances progress and
 * applies reward on completion. Returns the list of quest ids that
 * completed during this call (often empty).
 */
export function checkQuests(player: Player, event: QuestEvent): string[] {
  const completed: string[] = [];
  const quests = (player.quests as Quest[]) || [];
  for (const q of quests) {
    if (q.complete) continue;
    let advanced = false;
    if (event.kind === 'plant' && q.id === 'first-sprout') {
      advanced = true;
    } else if (
      event.kind === 'harvest' &&
      q.id === 'wheat-five' &&
      event.cropKey === 'wheat'
    ) {
      advanced = true;
    } else if (event.kind === 'talk' && q.id === 'good-neighbor') {
      if (!q.seen.includes(event.npcId)) {
        q.seen.push(event.npcId);
        advanced = true;
      }
    } else if (event.kind === 'cook' && q.id === 'first-recipe') {
      advanced = true;
    } else if (event.kind === 'mine' && q.id === 'first-gem') {
      advanced = true;
    } else if (event.kind === 'mine' && q.id === 'geologist') {
      if (!q.seen.includes(event.gemKey)) {
        q.seen.push(event.gemKey);
        advanced = true;
      }
    } else if (event.kind === 'gift' && q.id === 'sweetheart') {
      if (event.hearts >= 2) advanced = true;
    } else if (event.kind === 'gift' && q.id === 'confidant') {
      if (event.hearts >= 4) advanced = true;
    } else if (event.kind === 'gift' && q.id === 'devoted') {
      if (event.hearts >= 6) advanced = true;
    } else if (event.kind === 'gift' && q.id === 'soulmate') {
      if (event.hearts >= 8) advanced = true;
    } else if (event.kind === 'marry' && q.id === 'newlywed') {
      advanced = true;
    }
    if (advanced) {
      q.progress = Math.min(q.goal, q.progress + 1);
      if (q.progress >= q.goal) {
        q.complete = true;
        applyReward(player, q.reward);
        completed.push(q.id);
      }
    }
  }
  return completed;
}

function applyReward(player: Player, reward: QuestReward): void {
  if (reward.gold) player.gold += reward.gold;
  if (reward.items) {
    for (const [k, v] of Object.entries(reward.items)) {
      addItem(player, k, v);
    }
  }
  if (reward.cosmetic) {
    addItem(player, `cosmetic_${reward.cosmetic}`, 1);
  }
}
