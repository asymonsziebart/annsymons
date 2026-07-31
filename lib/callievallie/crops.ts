import type { CropDef, CropId } from "./types";

export const CROPS: Record<CropId, CropDef> = {
  turnip: {
    id: "turnip",
    name: "Turnip",
    seedId: "turnip_seed",
    daysToMature: 2,
    sellPrice: 12,
    seedPrice: 5,
    color: "#e8dcc8",
    sproutColor: "#7cb342",
  },
  bean: {
    id: "bean",
    name: "Bean",
    seedId: "bean_seed",
    daysToMature: 3,
    sellPrice: 18,
    seedPrice: 8,
    color: "#5a8f3c",
    sproutColor: "#8bc34a",
  },
  berry: {
    id: "berry",
    name: "Valley Berry",
    seedId: "berry_seed",
    daysToMature: 4,
    sellPrice: 28,
    seedPrice: 12,
    color: "#c2185b",
    sproutColor: "#81c784",
  },
  corn: {
    id: "corn",
    name: "Corn",
    seedId: "corn_seed",
    daysToMature: 5,
    sellPrice: 35,
    seedPrice: 15,
    color: "#f4c430",
    sproutColor: "#9ccc65",
  },
  sunflower: {
    id: "sunflower",
    name: "Sunflower",
    seedId: "sunflower_seed",
    daysToMature: 6,
    sellPrice: 45,
    seedPrice: 18,
    color: "#ffb300",
    sproutColor: "#aed581",
  },
};

export const CROP_LIST = Object.values(CROPS);

export function cropFromSeed(
  seedId: string
): CropDef | undefined {
  return CROP_LIST.find((c) => c.seedId === seedId);
}
