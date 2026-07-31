// Grid helpers for the sunsprout tile world.
// All tiles are TILE_SIZE x TILE_SIZE pixels. Coordinates are in either
// tile-space (integer columns/rows) or world-space (pixels). The renderer
// converts world-space to screen-space via the Camera.

export const TILE_SIZE = 32;

/** Convert a world-space pixel coordinate to a tile-space coordinate. */
export function worldToTile(worldPx: number): number {
  return Math.floor(worldPx / TILE_SIZE);
}

/** Convert a tile-space coordinate to the top-left world-space pixel. */
export function tileToWorld(tile: number): number {
  return tile * TILE_SIZE;
}

/** Convert a tile-space coordinate to the centre world-space pixel. */
export function tileCenterToWorld(tile: number): number {
  return tile * TILE_SIZE + TILE_SIZE / 2;
}

/**
 * Convert world-space coordinates to screen-space using a camera origin.
 * The camera's (x,y) represents the world-space pixel currently shown at
 * the top-left of the viewport.
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  cameraX: number,
  cameraY: number,
): { sx: number; sy: number } {
  return {
    sx: Math.floor(worldX - cameraX),
    sy: Math.floor(worldY - cameraY),
  };
}

/** Clamp helper used in a few places. */
export function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}
