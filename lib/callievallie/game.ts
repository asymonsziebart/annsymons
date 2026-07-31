import { CROPS } from "./crops";
import type { GameState, Tile, TileKind } from "./types";

export const MAP_W = 16;
export const MAP_H = 12;
export const TILE = 40;
export const MAX_ENERGY = 20;
export const STORAGE_KEY = "annsymons.callievallie.v0";

const LAYOUT: TileKind[][] = [
  ["grass", "grass", "grass", "grass", "grass", "grass", "grass", "path", "path", "grass", "grass", "grass", "grass", "grass", "grass", "grass"],
  ["grass", "fence", "fence", "fence", "fence", "fence", "fence", "path", "path", "fence", "fence", "fence", "fence", "fence", "fence", "grass"],
  ["grass", "fence", "dirt", "dirt", "dirt", "dirt", "dirt", "path", "path", "dirt", "dirt", "dirt", "dirt", "dirt", "fence", "grass"],
  ["grass", "fence", "dirt", "dirt", "dirt", "dirt", "dirt", "path", "path", "dirt", "dirt", "dirt", "dirt", "dirt", "fence", "grass"],
  ["grass", "fence", "dirt", "dirt", "dirt", "dirt", "dirt", "path", "path", "dirt", "dirt", "dirt", "dirt", "dirt", "fence", "grass"],
  ["grass", "fence", "dirt", "dirt", "dirt", "dirt", "dirt", "path", "path", "dirt", "dirt", "dirt", "dirt", "dirt", "fence", "grass"],
  ["grass", "fence", "fence", "fence", "fence", "path", "path", "path", "path", "path", "path", "fence", "fence", "fence", "fence", "grass"],
  ["grass", "grass", "grass", "grass", "grass", "path", "path", "stand", "stand", "path", "path", "grass", "grass", "grass", "grass", "grass"],
  ["grass", "grass", "grass", "grass", "grass", "path", "path", "path", "path", "path", "path", "grass", "grass", "water", "water", "water"],
  ["grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "water", "water", "water", "water"],
  ["grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "water", "water", "water", "water", "grass"],
  ["grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "grass", "water", "water", "grass", "grass"],
];

function cloneMap(): Tile[][] {
  return LAYOUT.map((row) => row.map((kind) => ({ kind })));
}

export function createNewGame(): GameState {
  return {
    version: 1,
    day: 1,
    energy: MAX_ENERGY,
    coins: 40,
    activeCharacter: "callie",
    playerX: 7,
    playerY: 7,
    tool: "hoe",
    selectedSlot: 0,
    inventory: [
      { itemId: "turnip_seed", qty: 6 },
      { itemId: "bean_seed", qty: 4 },
      { itemId: "berry_seed", qty: 2 },
    ],
    map: cloneMap(),
  };
}

export function loadGame(): GameState {
  if (typeof window === "undefined") return createNewGame();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createNewGame();
    const parsed = JSON.parse(raw) as GameState;
    if (parsed?.version !== 1 || !Array.isArray(parsed.map)) {
      return createNewGame();
    }
    return parsed;
  } catch {
    return createNewGame();
  }
}

export function saveGame(state: GameState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function canWalk(kind: TileKind): boolean {
  return kind !== "water" && kind !== "fence";
}

export function facingTile(
  state: GameState,
  dx: number,
  dy: number
): { x: number; y: number; tile: Tile } | null {
  const x = state.playerX + dx;
  const y = state.playerY + dy;
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return null;
  return { x, y, tile: state.map[y][x] };
}

export function itemLabel(itemId: string): string {
  if (itemId.endsWith("_seed")) {
    const cropId = itemId.replace(/_seed$/, "") as keyof typeof CROPS;
    return CROPS[cropId] ? `${CROPS[cropId].name} seeds` : itemId;
  }
  if (itemId in CROPS) return CROPS[itemId as keyof typeof CROPS].name;
  if (itemId === "berry_wild") return "Wild berry";
  if (itemId === "wood") return "Wood";
  return itemId;
}
