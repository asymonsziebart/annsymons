export type CharacterId = "callie" | "vallie";

export type TileKind =
  | "grass"
  | "dirt"
  | "tilled"
  | "water"
  | "path"
  | "fence"
  | "stand";

export type CropId = "turnip" | "bean" | "berry" | "corn" | "sunflower";

export type ItemId = CropId | `${CropId}_seed` | "berry_wild" | "wood";

export type ToolId = "hoe" | "water" | "hand";

export interface CropDef {
  id: CropId;
  name: string;
  seedId: `${CropId}_seed`;
  daysToMature: number;
  sellPrice: number;
  seedPrice: number;
  color: string;
  sproutColor: string;
}

export interface GrowingCrop {
  cropId: CropId;
  stage: number; // 0..daysToMature
  wateredToday: boolean;
}

export interface Tile {
  kind: TileKind;
  crop?: GrowingCrop;
}

export interface InventorySlot {
  itemId: ItemId;
  qty: number;
}

export interface GameState {
  version: 1;
  day: number;
  energy: number;
  coins: number;
  activeCharacter: CharacterId;
  playerX: number;
  playerY: number;
  tool: ToolId;
  selectedSlot: number;
  inventory: InventorySlot[];
  map: Tile[][];
}
