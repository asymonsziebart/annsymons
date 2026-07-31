// Crops catalog and procedural pixel sprites.
//
// Each crop is described by a small data object — number of growth stages,
// real-day duration per stage (driven by the day/night cycle), and pricing
// for the shop economy. drawCropSprite() paints a 16x16 procedural sprite
// per crop + stage, so we never need image assets on disk.
//
// The sprite art is intentionally tiny — a sprout for early stages, a
// taller leafy stalk for mid-growth, and a recognisable head/fruit for
// the ripe stage. Colours follow the cozy palette used elsewhere in the
// renderer (warm greens, golden wheat, deep tomato red, plump orange
// pumpkin, soft violet flowers).

/** Sprite identifiers, used as the discriminator for drawCropSprite. */
export type CropSprite = 'wheat' | 'tomato' | 'pumpkin' | 'flower';

/** Static description of a crop type. */
export interface Crop {
  /** Human-readable name, used in the shop / HUD. */
  name: string;
  /** Total number of growth stages (final stage is the harvest-ready stage). */
  growthStages: number;
  /** How many in-game days the crop spends in each stage when watered. */
  daysPerStage: number;
  /** Gold earned when the player sells one harvested unit. */
  sellPrice: number;
  /** Gold cost of a single seed at the shop. */
  seedPrice: number;
  /** Which procedural sprite to use when rendering. */
  sprite: CropSprite;
}

/**
 * Catalog of crops the player can plant. Keys here double as the inventory
 * item key for the seed — e.g. `player.inventory.wheat` counts wheat seeds,
 * and `player.inventory.wheat_harvest` counts harvested wheat.
 */
export const CROPS: Record<string, Crop> = {
  wheat: {
    name: 'Wheat',
    growthStages: 3,
    daysPerStage: 1,
    sellPrice: 8,
    seedPrice: 2,
    sprite: 'wheat',
  },
  tomato: {
    name: 'Tomato',
    growthStages: 4,
    daysPerStage: 2,
    sellPrice: 25,
    seedPrice: 8,
    sprite: 'tomato',
  },
  pumpkin: {
    name: 'Pumpkin',
    growthStages: 5,
    daysPerStage: 3,
    sellPrice: 80,
    seedPrice: 25,
    sprite: 'pumpkin',
  },
  flower: {
    name: 'Flower',
    growthStages: 3,
    daysPerStage: 1,
    sellPrice: 15,
    seedPrice: 5,
    sprite: 'flower',
  },
};

/** Look up a crop by its catalog key (returns undefined for unknown keys). */
export function getCropByKey(key: string): Crop | undefined {
  return CROPS[key];
}

/** List of all crop keys in catalog order (used by the hotbar). */
export const CROP_KEYS: string[] = ['wheat', 'tomato', 'pumpkin', 'flower'];

// ---------------------------------------------------------------------
// Procedural sprite rendering
// ---------------------------------------------------------------------

/**
 * Draws a single crop sprite at (x,y). (x,y) is the centre-bottom of the
 * sprite — i.e. the position where the crop "sits" on the soil. The
 * sprite occupies roughly 16x16 pixels above this anchor.
 */
export function drawCropSprite(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cropKey: string,
  stage: number,
): void {
  const crop = CROPS[cropKey];
  if (!crop) return;
  const s = Math.max(0, Math.min(crop.growthStages - 1, Math.floor(stage)));
  switch (crop.sprite) {
    case 'wheat':
      drawWheat(ctx, x, y, s);
      break;
    case 'tomato':
      drawTomato(ctx, x, y, s);
      break;
    case 'pumpkin':
      drawPumpkin(ctx, x, y, s);
      break;
    case 'flower':
      drawFlower(ctx, x, y, s);
      break;
  }
}

/** Small helper — single pixel rect. Avoids depending on render/pixel.ts. */
function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.max(1, w), Math.max(1, h));
}

// --- Wheat (3 stages) -------------------------------------------------
//
// Stage 0: a tiny green sprout.
// Stage 1: a taller green stalk with two leaves.
// Stage 2: golden wheat head ready to harvest.

function drawWheat(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  stage: number,
): void {
  const stalk = '#7CC55C';
  const stalkDark = '#5FA044';
  const golden = '#E8C648';
  const goldenDark = '#B89224';
  if (stage === 0) {
    // Tiny sprout: 2px tall green wisp.
    px(ctx, x, y - 3, 1, 3, stalk);
    px(ctx, x - 1, y - 4, 3, 1, stalkDark);
  } else if (stage === 1) {
    // Taller stalk with simple leaves.
    px(ctx, x, y - 8, 1, 8, stalk);
    px(ctx, x - 2, y - 6, 2, 1, stalkDark);
    px(ctx, x + 1, y - 4, 2, 1, stalkDark);
    px(ctx, x - 1, y - 9, 1, 1, stalk);
  } else {
    // Stage 2: golden head + a few visible grains.
    px(ctx, x, y - 10, 1, 10, stalkDark);
    px(ctx, x - 2, y - 11, 5, 3, golden);
    px(ctx, x - 1, y - 12, 3, 1, golden);
    px(ctx, x - 2, y - 8, 1, 1, goldenDark);
    px(ctx, x + 2, y - 8, 1, 1, goldenDark);
    px(ctx, x, y - 9, 1, 1, goldenDark);
  }
}

// --- Tomato (4 stages) ------------------------------------------------
//
// Stage 0: a single green sprout.
// Stage 1: bushy leaves.
// Stage 2: yellow flower forming.
// Stage 3: red ripe tomato.

function drawTomato(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  stage: number,
): void {
  const leaf = '#4FA040';
  const leafDark = '#3A7A2E';
  const flower = '#F0D24A';
  const tomatoRed = '#D8442A';
  const tomatoShade = '#A8331F';
  if (stage === 0) {
    px(ctx, x, y - 3, 1, 3, leaf);
    px(ctx, x - 1, y - 4, 3, 1, leafDark);
  } else if (stage === 1) {
    px(ctx, x, y - 7, 1, 7, leafDark);
    px(ctx, x - 3, y - 6, 7, 1, leafDark);
    px(ctx, x - 4, y - 5, 9, 2, leaf);
    px(ctx, x - 3, y - 3, 7, 1, leafDark);
  } else if (stage === 2) {
    px(ctx, x, y - 9, 1, 9, leafDark);
    px(ctx, x - 4, y - 7, 9, 2, leaf);
    px(ctx, x - 3, y - 5, 7, 1, leafDark);
    px(ctx, x - 1, y - 10, 3, 2, flower);
  } else {
    px(ctx, x, y - 9, 1, 9, leafDark);
    px(ctx, x - 4, y - 6, 9, 2, leaf);
    // Ripe tomato circle (rough 5x5 pixel circle).
    px(ctx, x - 2, y - 11, 5, 4, tomatoRed);
    px(ctx, x - 1, y - 12, 3, 1, tomatoRed);
    px(ctx, x - 2, y - 7, 5, 1, tomatoShade);
    px(ctx, x - 1, y - 13, 1, 1, leafDark);
  }
}

// --- Pumpkin (5 stages) -----------------------------------------------

function drawPumpkin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  stage: number,
): void {
  const vine = '#3A7A2E';
  const leaf = '#5FA044';
  const baby = '#C8C44A';
  const orange = '#E8862A';
  const orangeDark = '#B25B14';
  const stem = '#7A5A2A';
  if (stage === 0) {
    px(ctx, x, y - 3, 1, 3, leaf);
    px(ctx, x - 1, y - 4, 3, 1, vine);
  } else if (stage === 1) {
    px(ctx, x - 4, y - 3, 9, 2, leaf);
    px(ctx, x - 3, y - 5, 7, 2, leaf);
    px(ctx, x - 2, y - 6, 5, 1, vine);
  } else if (stage === 2) {
    // Sprawling vine + a baby green pumpkin.
    px(ctx, x - 5, y - 3, 11, 2, leaf);
    px(ctx, x - 3, y - 5, 7, 2, leaf);
    px(ctx, x - 1, y - 7, 3, 2, baby);
    px(ctx, x, y - 8, 1, 1, vine);
  } else if (stage === 3) {
    // Pumpkin starting to ripen.
    px(ctx, x - 5, y - 3, 11, 2, leaf);
    px(ctx, x - 4, y - 5, 9, 2, leaf);
    px(ctx, x - 3, y - 9, 7, 4, orange);
    px(ctx, x - 4, y - 8, 1, 2, orangeDark);
    px(ctx, x + 4, y - 8, 1, 2, orangeDark);
    px(ctx, x, y - 10, 1, 1, stem);
  } else {
    // Fully ripe pumpkin — fat, round, deep orange.
    px(ctx, x - 6, y - 3, 13, 2, leaf);
    px(ctx, x - 5, y - 5, 11, 2, leaf);
    px(ctx, x - 4, y - 11, 9, 6, orange);
    px(ctx, x - 5, y - 9, 1, 4, orangeDark);
    px(ctx, x + 5, y - 9, 1, 4, orangeDark);
    px(ctx, x - 3, y - 12, 7, 1, orange);
    // Ribs.
    px(ctx, x - 2, y - 11, 1, 6, orangeDark);
    px(ctx, x + 2, y - 11, 1, 6, orangeDark);
    // Stem.
    px(ctx, x, y - 13, 1, 2, stem);
    px(ctx, x - 1, y - 13, 1, 1, vine);
  }
}

// --- Flower (3 stages) ------------------------------------------------

function drawFlower(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  stage: number,
): void {
  const stem = '#5FA044';
  const leaf = '#7CC55C';
  const bud = '#C29ACF';
  const petal = '#E47ACF';
  const petalDark = '#A8478F';
  const center = '#F0D24A';
  if (stage === 0) {
    px(ctx, x, y - 4, 1, 4, stem);
    px(ctx, x - 1, y - 5, 3, 1, leaf);
  } else if (stage === 1) {
    px(ctx, x, y - 8, 1, 8, stem);
    px(ctx, x - 2, y - 6, 2, 1, leaf);
    px(ctx, x + 1, y - 4, 2, 1, leaf);
    px(ctx, x - 1, y - 10, 3, 2, bud);
    px(ctx, x, y - 11, 1, 1, bud);
  } else {
    // In bloom!
    px(ctx, x, y - 9, 1, 9, stem);
    px(ctx, x - 2, y - 7, 2, 1, leaf);
    px(ctx, x + 1, y - 5, 2, 1, leaf);
    // Petals around a center.
    px(ctx, x - 1, y - 12, 3, 1, petal);
    px(ctx, x - 2, y - 11, 5, 1, petal);
    px(ctx, x - 2, y - 10, 5, 1, petalDark);
    px(ctx, x - 1, y - 9, 3, 1, petal);
    px(ctx, x, y - 11, 1, 1, center);
  }
}
