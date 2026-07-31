// Tool rack — a cosmetic display of the player's tool kit, mounted on
// the farmhouse exterior wall (the left half; the ribbon hall hangs on
// the right). The game already lets the player upgrade four tools
// through metal tiers — hoe, watering can, pickaxe, fishing rod — but
// that investment was invisible once bought: there was no way to see
// your kit at a glance without walking to Vallie's shop. This surfaces
// it: each tool hangs as a small pixel sprite tinted by its tier metal,
// so a well-equipped farmer's home shows off the upgrades.
//
// Pure layout + data here (which tools, where, what metal); the canvas
// draw lives in render/tool-rack-sprite.ts. The engine reads the tier
// helpers and asks for the layout, so the placement maths + the
// "show it yet?" gate are unit-testable without a rendering context.

import type { Player } from '../world/world';
import { tierOf } from './tools';
import { pickaxeTier } from './pickaxe-upgrades';
import { rodTier } from './rod-upgrades';

/** The four tools the rack can display, in left-to-right hang order. */
export type RackToolKind = 'hoe' | 'can' | 'pickaxe' | 'rod';

/**
 * Every metal tier any tool can wear. The hoe / can / rod top out at
 * gold; the pickaxe adds a diamond tier — the union covers all four.
 */
export type AnyToolTier = 'wood' | 'copper' | 'iron' | 'gold' | 'diamond';

/** Palette per tier — tool body + a lighter sheen highlight. Shared by
 *  every tool so a gold hoe and a gold rod read as the same metal. */
export const TIER_METAL: Record<AnyToolTier, { body: string; sheen: string }> = {
  wood: { body: '#9A6B3F', sheen: '#C28A56' },
  copper: { body: '#C77B30', sheen: '#E8A85A' },
  iron: { body: '#9BA0AC', sheen: '#D6DAE2' },
  gold: { body: '#E8B23A', sheen: '#F7E08A' },
  diamond: { body: '#7FD8E0', sheen: '#D6F6FA' },
};

/** Tools in hang order (hoe first — the farmer's signature tool). */
export const RACK_TOOL_ORDER: RackToolKind[] = ['hoe', 'can', 'pickaxe', 'rod'];

/** Horizontal spacing between hung tools (px). */
export const RACK_SPACING = 11;

/** A single tool to draw: its kind, tier, metal colour, wall offset. */
export interface RackMount {
  kind: RackToolKind;
  tier: AnyToolTier;
  body: string;
  sheen: string;
  /** Horizontal offset (px) from the rack's left anchor. */
  dx: number;
}

/** Resolve the player's current tier for a rack tool. */
export function tierForRackTool(player: Player, kind: RackToolKind): AnyToolTier {
  switch (kind) {
    case 'hoe':
      return tierOf(player, 'hoe');
    case 'can':
      return tierOf(player, 'watering-can');
    case 'pickaxe':
      return pickaxeTier(player);
    case 'rod':
      return rodTier(player);
  }
}

/**
 * Build the tool-rack layout from the player's tool tiers. Returns one
 * mount per tool (always all four, in RACK_TOOL_ORDER) packed
 * left-to-right with even spacing — UNLESS every tool is still its
 * starting wood tier, in which case it returns an empty array so a
 * fresh farm's wall stays clean (mirroring ribbonHallMounts). Once the
 * player upgrades any one tool, the whole kit hangs so they can see
 * both what they've earned and what's still wood to upgrade.
 *
 * Pure + deterministic — same tiers always give the same layout.
 */
export function toolRackMounts(player: Player): RackMount[] {
  const tiers = RACK_TOOL_ORDER.map((kind) => ({
    kind,
    tier: tierForRackTool(player, kind),
  }));
  if (tiers.every((t) => t.tier === 'wood')) return [];
  return tiers.map((t, i) => {
    const c = TIER_METAL[t.tier];
    return { kind: t.kind, tier: t.tier, body: c.body, sheen: c.sheen, dx: i * RACK_SPACING };
  });
}

/** True when the rack would draw anything (any tool past wood). */
export function hasToolRack(player: Player): boolean {
  return toolRackMounts(player).length > 0;
}
