// World state: tiles, entities, and the player.
// Tile-space is 40 wide x 30 tall, each tile TILE_SIZE px on screen.
// Player position is stored in tile-space; `moveProgress` interpolates
// to (targetX,targetY) for smooth tile-by-tile movement.

import { TILE_SIZE } from '../engine/grid';

export type TileType = 'grass' | 'tilled' | 'water' | 'path' | 'wood' | 'stone';

export interface Tile {
  type: TileType;
  /** Optional variant index used by the renderer for organic patchiness. */
  variant?: number;
}

export type Facing = 'up' | 'down' | 'left' | 'right';

export interface Player {
  /** Current tile-space coordinates (fractional during a move). */
  x: number;
  y: number;
  facing: Facing;
  /** 0..1 progress from previous tile to (targetX, targetY). */
  moveProgress: number;
  targetX: number;
  targetY: number;
  /** Tile-space coordinates the player is moving away from. */
  fromX: number;
  fromY: number;
  inventory: Record<string, number>;
  gold: number;
  quests: any[];
  /** Per-NPC relationship rows (v0.5.0 marriage candidates). */
  hearts?: import('../game/hearts').HeartsState;
  /** Marriage engagement record (v0.5.0). One fiancé at a time. */
  engagement?: import('../game/engagement').Engagement;
  /** Marriage record (v0.5.0). Terminal — set after wedding held. */
  marriage?: import('../game/marriage').Marriage;
}

export interface NPC {
  id: string;
  name: string;
  /** Tile-space coordinates. */
  x: number;
  y: number;
  color: string;
  hat: string;
  facing: Facing;
}

export interface Crop {
  /** Tile-space coordinates. */
  x: number;
  y: number;
  kind: 'turnip' | 'carrot' | 'potato' | 'tomato';
  /** Growth stage 0..3 (seed, sprout, mid, ripe). */
  stage: number;
  /** Accumulated growth ticks; renderer doesn't need this but logic later will. */
  growth: number;
}

export interface Building {
  id: string;
  kind: 'inn' | 'shop' | 'farmhouse' | 'well';
  /** Tile-space top-left coordinate. */
  x: number;
  y: number;
  /** Footprint in tiles. */
  w: number;
  h: number;
  name: string;
}

const PATH_COLOR_KEY = 'path'; // path tiles render as #B89F75 in the renderer

export class World {
  public readonly width: number = 40;
  public readonly height: number = 30;
  public tiles: Tile[][] = [];
  public players: Player[] = [];
  public npcs: NPC[] = [];
  public crops: Crop[] = [];
  public buildings: Building[] = [];

  /** Convenience getter for the local player (always index 0 for now). */
  get player(): Player {
    return this.players[0];
  }

  /** World-space pixel dimensions. */
  get pixelWidth(): number {
    return this.width * TILE_SIZE;
  }
  get pixelHeight(): number {
    return this.height * TILE_SIZE;
  }

  constructor() {
    this.initTiles();
    this.carvePlazaAndPaths();
    this.placeBuildings();
    this.placeTilledPatch();
    this.placeCaveOutcrop();
    this.spawnNPCs();
    this.spawnPlayer();
  }

  /** True if (tx,ty) is inside the map. */
  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  /** Returns the tile at (tx,ty) or a synthetic wood tile when out of bounds. */
  getTile(tx: number, ty: number): Tile {
    if (!this.inBounds(tx, ty)) return { type: 'wood' };
    return this.tiles[ty][tx];
  }

  /** Whether the given tile is walkable by a player or NPC. */
  isWalkable(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return false;
    const t = this.tiles[ty][tx].type;
    if (t === 'water' || t === 'wood' || t === 'stone') return false;
    // Buildings block their footprint.
    for (const b of this.buildings) {
      if (b.kind === 'well') {
        // Well only blocks its single centre tile (treated as stone).
        if (tx === b.x && ty === b.y) return false;
        continue;
      }
      if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) {
        return false;
      }
    }
    return true;
  }

  // ---------------------------------------------------------------------
  // Initialisation helpers
  // ---------------------------------------------------------------------

  private initTiles(): void {
    this.tiles = [];
    for (let y = 0; y < this.height; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < this.width; x++) {
        // Variant biased by a cheap pseudo-random pattern so grass looks
        // organic without needing real noise.
        const v = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
        const variant = Math.floor(Math.abs(v) * 4);
        row.push({ type: 'grass', variant });
      }
      this.tiles.push(row);
    }
  }

  /** Draws the dirt-coloured village plaza and connecting paths. */
  private carvePlazaAndPaths(): void {
    // Plaza: an open path-tile rectangle in the upper-middle of the map.
    const plaza = { x: 12, y: 4, w: 16, h: 8 };
    for (let y = plaza.y; y < plaza.y + plaza.h; y++) {
      for (let x = plaza.x; x < plaza.x + plaza.w; x++) {
        if (this.inBounds(x, y)) this.setTile(x, y, PATH_COLOR_KEY);
      }
    }
    // Vertical path running south from the plaza to the farmhouse area.
    const cx = plaza.x + Math.floor(plaza.w / 2);
    for (let y = plaza.y + plaza.h; y < this.height - 2; y++) {
      this.setTile(cx - 1, y, PATH_COLOR_KEY);
      this.setTile(cx, y, PATH_COLOR_KEY);
    }
    // Horizontal path along the south edge of the plaza for variety.
    for (let x = 6; x < this.width - 4; x++) {
      this.setTile(x, plaza.y + plaza.h, PATH_COLOR_KEY);
    }
    // Small pond on the west side for ambience.
    for (let y = 18; y < 22; y++) {
      for (let x = 2; x < 6; x++) {
        this.setTile(x, y, 'water');
      }
    }
  }

  private setTile(x: number, y: number, type: TileType): void {
    if (!this.inBounds(x, y)) return;
    this.tiles[y][x] = { type, variant: this.tiles[y][x].variant };
  }

  private placeBuildings(): void {
    // Inn: top-left of plaza.
    this.buildings.push({
      id: 'inn',
      kind: 'inn',
      name: "Callie's Hearth",
      x: 13,
      y: 5,
      w: 4,
      h: 3,
    });
    // Shop: top-right of plaza.
    this.buildings.push({
      id: 'shop',
      kind: 'shop',
      name: "Vallie's General Goods",
      x: 23,
      y: 5,
      w: 4,
      h: 3,
    });
    // Farmhouse: south of plaza, west of the tilled patch.
    this.buildings.push({
      id: 'farmhouse',
      kind: 'farmhouse',
      name: 'Your Farmhouse',
      x: 13,
      y: 18,
      w: 4,
      h: 3,
    });
    // Well: a single-tile structure in the centre of the plaza.
    this.buildings.push({
      id: 'well',
      kind: 'well',
      name: 'Village Well',
      x: 19,
      y: 8,
      w: 1,
      h: 1,
    });
    // Mark the well's tile as stone so it's non-walkable and renders darker.
    this.setTile(19, 8, 'stone');
  }

  /** 8x6 tilled patch south of plaza for the starter farm. */
  private placeTilledPatch(): void {
    const px = 19;
    const py = 22;
    for (let y = py; y < py + 6; y++) {
      for (let x = px; x < px + 8; x++) {
        if (this.inBounds(x, y)) this.setTile(x, y, 'tilled');
      }
    }
  }

  /**
   * Stone cave outcrop in the NE corner — the v0.4.0 mining area entrance.
   * A small cluster of stone tiles forms a visible landmark. The single
   * non-stone gap tile at the south face is the cave mouth (cavemouth-tile),
   * which the input layer will read in a later tick to arm the pickaxe.
   */
  private placeCaveOutcrop(): void {
    const ox = 33;
    const oy = 2;
    const ow = 5;
    const oh = 5;
    for (let y = oy; y < oy + oh; y++) {
      for (let x = ox; x < ox + ow; x++) {
        if (this.inBounds(x, y)) this.setTile(x, y, 'stone');
      }
    }
    // Carve a 1-tile path of grass leading up to the south face so the
    // player can walk right up to the outcrop without getting boxed in.
    const mouthX = ox + Math.floor(ow / 2);
    const mouthY = oy + oh; // first walkable tile south of the outcrop
    if (this.inBounds(mouthX, mouthY)) this.setTile(mouthX, mouthY, 'path');
  }

  private spawnNPCs(): void {
    // Four NPCs scattered around the plaza so the village feels alive.
    this.npcs.push({
      id: 'mayor',
      name: 'Mayor Bramble',
      x: 19,
      y: 6,
      color: '#A23B3B',
      hat: '#3B2A1A',
      facing: 'down',
    });
    this.npcs.push({
      id: 'maple',
      name: 'Vallie the Shopkeep',
      x: 24,
      y: 8,
      color: '#7A5BAE',
      hat: '#F0C24A',
      facing: 'down',
    });
    this.npcs.push({
      id: 'finn',
      name: 'Finn the Fisher',
      x: 7,
      y: 21,
      color: '#3B7AAE',
      hat: '#E0B070',
      facing: 'right',
    });
    this.npcs.push({
      id: 'rose',
      name: 'Callie the Innkeeper',
      x: 15,
      y: 9,
      color: '#C85A8A',
      hat: '#E8E8E8',
      facing: 'down',
    });
  }

  private spawnPlayer(): void {
    const spawnX = 19;
    const spawnY = 13;
    this.players.push({
      x: spawnX,
      y: spawnY,
      facing: 'down',
      moveProgress: 1,
      targetX: spawnX,
      targetY: spawnY,
      fromX: spawnX,
      fromY: spawnY,
      inventory: {
        'turnip-seed': 8,
        'carrot-seed': 4,
        hoe: 1,
        'watering-can': 1,
      },
      gold: 50,
      quests: [],
    });
  }

  // ---------------------------------------------------------------------
  // Per-tick updates
  // ---------------------------------------------------------------------

  /**
   * Advances player movement. dt is in milliseconds; we treat 250ms as the
   * time to traverse a single tile, matching the spec.
   */
  update(dtMs: number, desired: { dx: number; dy: number }): void {
    const p = this.player;
    if (!p) return;

    // Update facing from any current input even if mid-move so the
    // player visibly turns mid-step.
    if (desired.dx === -1) p.facing = 'left';
    else if (desired.dx === 1) p.facing = 'right';
    else if (desired.dy === -1) p.facing = 'up';
    else if (desired.dy === 1) p.facing = 'down';

    if (p.moveProgress >= 1) {
      // Snap to the destination tile then optionally start a new move.
      p.x = p.targetX;
      p.y = p.targetY;
      p.fromX = p.x;
      p.fromY = p.y;
      if (desired.dx !== 0 || desired.dy !== 0) {
        const nx = p.x + desired.dx;
        const ny = p.y + desired.dy;
        if (this.isWalkable(nx, ny)) {
          p.targetX = nx;
          p.targetY = ny;
          p.moveProgress = 0;
        }
      }
    } else {
      p.moveProgress += dtMs / 250;
      if (p.moveProgress > 1) p.moveProgress = 1;
      const t = p.moveProgress;
      p.x = p.fromX + (p.targetX - p.fromX) * t;
      p.y = p.fromY + (p.targetY - p.fromY) * t;
    }
  }
}
