import { readFile } from "fs/promises";
import path from "path";

export type AncestrySubregion = {
  label: string;
  percent: number;
};

export type AncestryRegion = {
  id: string;
  label: string;
  percent: number;
  color: string;
  subregions: AncestrySubregion[];
};

export type AncestryJourney = {
  id: string;
  label: string;
  subregions: string[];
};

export type AncestryDnaData = {
  title: string;
  personName: string;
  updatedAt: string;
  note: string;
  regions: AncestryRegion[];
  journeys: AncestryJourney[];
};

let cache: AncestryDnaData | null = null;

export async function getAncestryDna(): Promise<AncestryDnaData> {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "content", "ancestry-dna.json");
  const raw = await readFile(filePath, "utf8");
  cache = JSON.parse(raw) as AncestryDnaData;
  return cache;
}
