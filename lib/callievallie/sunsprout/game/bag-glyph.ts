// Bag row glyphs — resolve a categorized bag row into a small drawable
// glyph descriptor so the inventory list reads at a glance, the way the
// hotbar shows seed sprites instead of bare words.
//
// The bag panel (ui/bag-panel.ts) lists every stack as label + count, but
// a text-only list is slow to scan: a column of "Cave Ruby / Old Pike /
// Wheat" makes the player read rather than recognise. This module is the
// pure half of a per-row pixel pip: given a BagItem it returns a tiny
// tagged descriptor (which sprite + what colour) that a thin renderer
// (render/bag-glyph-sprite.ts) paints in the row's left margin. Seeds and
// crops reuse the existing crop sprites; forage reuses its world sprite;
// fish / gems / eggs / dishes get small recognisable silhouettes tinted
// from the catalogs so a Cave Ruby pip is red and a Gold Nugget pip is
// gold without a second colour table to maintain.
//
// Pure: no canvas, no engine imports. Reads the catalogs + the BagItem,
// returns plain data. The UI owns the draw.

import type { BagItem } from './bag';
import { parseHarvestKey } from './crop-quality';
import { CROPS } from './crops';
import { FISH, type FishKey } from './fish';
import { GEMS, type GemKey } from './gems';
import { FORAGE, type ForageKind } from './forage';
import {
  EGG_INVENTORY_KEY,
  FANCY_EGG_INVENTORY_KEY,
  BREEDER_EGG_INVENTORY_KEY,
} from './coop';
import { RECIPE_KEYS } from './cooking';

/**
 * A resolved glyph for one bag row. Discriminated by `kind` so the
 * renderer can branch into the right tiny sprite:
 * - `crop`: a procedural crop sprite at its ripe stage (seeds + harvests).
 * - `forage`: the world forage sprite (berry / mushroom / herb).
 * - `fish`: a small fish silhouette tinted by tier.
 * - `gem`: a faceted pebble tinted by the gem's catalog colour.
 * - `egg`: an egg tinted plain / fancy-gold / breeder-violet.
 * - `dish`: a bowl, for any cooked dish.
 * - `supply`: a generic crate pip for tools / kits / cosmetics.
 */
export type BagGlyph =
  | { kind: 'crop'; cropKey: string }
  | { kind: 'forage'; forage: ForageKind }
  | { kind: 'fish'; color: string }
  | { kind: 'gem'; color: string }
  | { kind: 'egg'; color: string }
  | { kind: 'dish'; color: string }
  | { kind: 'supply' };

/** Egg pip tints — plain shell, fancy gold, breeder violet. */
export const EGG_GLYPH_COLOR = {
  plain: '#F0E0CA',
  fancy: '#F0C24A',
  breeder: '#C8A0E8',
} as const;

/** A cooked dish always pips as the same warm bowl. */
export const DISH_GLYPH_COLOR = '#D8A472';

/**
 * Fish pip tint by sell-price tier so a humble minnow reads cool-grey and
 * a prized pike reads deep blue. Pure ramp over FISH[key].sellPrice with
 * fixed thresholds — no second catalog column to drift.
 */
export function fishGlyphColor(key: FishKey): string {
  const price = FISH[key]?.sellPrice ?? 0;
  if (price >= 50) return '#3B6EA5'; // pike — deep blue
  if (price >= 25) return '#4E8FB5'; // trout
  if (price >= 18) return '#6FA8C0'; // bass
  if (price >= 10) return '#8FBCC8'; // carp
  return '#AEC4CC'; // minnow — pale steel
}

/**
 * Resolve a raw inventory key into its glyph. Mirrors classifyBagKey's
 * key parsing so the pip always matches the row's category. Anything
 * unrecognised falls back to the generic `supply` crate so every row
 * still gets a pip. Pure — the core resolver behind both bagGlyph (which
 * reads a BagItem) and loreRowGlyph (which maps a bestiary row's catalog
 * id onto the right inventory-key shape).
 */
export function bagGlyphForKey(key: string): BagGlyph {
  // Seeds — a bare crop key.
  if (CROPS[key]) return { kind: 'crop', cropKey: key };

  // Harvested crops (normal / silver / gold buckets).
  const harvest = parseHarvestKey(key);
  if (harvest && CROPS[harvest.cropKey]) {
    return { kind: 'crop', cropKey: harvest.cropKey };
  }

  // Fish.
  if (key.startsWith('fish-')) {
    const fk = key.slice('fish-'.length) as FishKey;
    if (FISH[fk]) return { kind: 'fish', color: fishGlyphColor(fk) };
  }

  // Gems — tinted by the catalog colour.
  if (key.startsWith('gem-')) {
    const gk = key.slice('gem-'.length) as GemKey;
    if (GEMS[gk]) return { kind: 'gem', color: GEMS[gk].color };
  }

  // Forage — reuse the world sprite.
  if (key.startsWith('forage-')) {
    const fk = key.slice('forage-'.length) as ForageKind;
    if (FORAGE[fk]) return { kind: 'forage', forage: fk };
  }

  // Eggs.
  if (key === EGG_INVENTORY_KEY) return { kind: 'egg', color: EGG_GLYPH_COLOR.plain };
  if (key === FANCY_EGG_INVENTORY_KEY) return { kind: 'egg', color: EGG_GLYPH_COLOR.fancy };
  if (key === BREEDER_EGG_INVENTORY_KEY) return { kind: 'egg', color: EGG_GLYPH_COLOR.breeder };

  // Cooked dishes.
  if (key.startsWith('dish-')) return { kind: 'dish', color: DISH_GLYPH_COLOR };

  // Everything else — a generic crate pip.
  return { kind: 'supply' };
}

/**
 * Resolve a bag row into its glyph. Thin wrapper over bagGlyphForKey —
 * the BagItem only contributes its key.
 */
export function bagGlyph(item: BagItem): BagGlyph {
  return bagGlyphForKey(item.key);
}

/**
 * A single representative glyph for a whole bag CATEGORY, so an empty tab
 * can show a large dim "this is what lives here" symbol behind its
 * text — a wheat sheaf for Crops, a fish for Fish, a gem for Gems, and so
 * on. Lets a Fish tab with no fish read as "fish go here, you have none"
 * at a glance, the way the empty-state hint already teaches in words.
 * Reuses the exact bagGlyphForKey resolver each row uses (so the pip
 * matches the rows that WOULD fill the tab), with a sensible exemplar key
 * per tab. Supplies / Seeds have no single icon so they fall back to the
 * generic crate. Pure.
 */
export function bagCategoryGlyph(category: BagItem['category']): BagGlyph {
  switch (category) {
    case 'Crops':
    case 'Seeds':
      return bagGlyphForKey('wheat');
    case 'Fish':
      return bagGlyphForKey('fish-pike');
    case 'Gems':
      return bagGlyphForKey('gem-ruby');
    case 'Forage':
      return bagGlyphForKey('forage-berry');
    case 'Kitchen':
      return bagGlyphForKey(EGG_INVENTORY_KEY);
    case 'Supplies':
    default:
      return { kind: 'supply' };
  }
}

/**
 * Resolve a bestiary (lore-panel) row into its glyph so the discovery
 * log scans like the bag. The lore catalogue keys entries by a BARE
 * catalog id (e.g. `minnow`, `copper`, `berry`, `wheat`) within a
 * category, so we rebuild the inventory-key shape bagGlyphForKey expects
 * and resolve through it. Folk + Rumors rows have no item sprite, so they
 * return null and the panel keeps its plain pip for those tabs. Pure.
 */
export function loreRowGlyph(category: string, id: string): BagGlyph | null {
  switch (category) {
    case 'Fish':
      return bagGlyphForKey(`fish-${id}`);
    case 'Gems':
      return bagGlyphForKey(`gem-${id}`);
    case 'Forage':
      return bagGlyphForKey(`forage-${id}`);
    case 'Crops':
      return bagGlyphForKey(id);
    default:
      // Folk / Rumors — no catalog sprite.
      return null;
  }
}

/**
 * Resolve a candidate's adored-gift key into a glyph for the relationship
 * panel. Gift keys live in a DISPLAY namespace that only partly overlaps
 * inventory keys: harvest keys (`flower_harvest`) are already valid, but
 * gems / fish / dishes are stored bare (`ruby`, `frog`, `hearty-stew`)
 * and need their inventory prefix rebuilt before the shared resolver can
 * find the sprite. Rather than a brittle per-catalog membership table, we
 * probe: try the key as-is, then each namespace prefix, returning the
 * first that resolves to a real sprite (bagGlyphForKey returns `supply`
 * for anything it can't place, so a non-`supply` result means a hit).
 * Genuinely off-catalog gifts (`frog`, `amethyst`, `bouquet`) resolve to
 * nothing and return null, so the panel keeps a clean bullet rather than
 * a misleading crate. Pure.
 */
export function giftKeyGlyph(rawKey: string): BagGlyph | null {
  const direct = bagGlyphForKey(rawKey);
  if (direct.kind !== 'supply') return direct;
  // Gem / fish / forage prefixes self-validate inside bagGlyphForKey (it
  // checks catalog membership), so a non-`supply` result is a real hit.
  for (const prefix of ['gem-', 'fish-', 'forage-']) {
    const g = bagGlyphForKey(`${prefix}${rawKey}`);
    if (g.kind !== 'supply') return g;
  }
  // The dish branch accepts ANY `dish-*` key (premium dishes use compound
  // keys), so it can't self-validate — gate the dish probe on the bare
  // key actually being a known recipe before trusting it.
  if ((RECIPE_KEYS as readonly string[]).includes(rawKey)) {
    return bagGlyphForKey(`dish-${rawKey}`);
  }
  return null;
}
