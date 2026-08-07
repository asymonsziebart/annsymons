import { readFile } from "fs/promises";
import path from "path";

export type FamilyHistorySource = {
  label: string;
  url: string;
};

export type FamilyHistorySection = {
  id: string;
  title: string;
  line: string;
  status: "confirmed" | "needs_review" | "unverified";
  personIds: string[];
  summary: string;
  highlights: string[];
  sources: FamilyHistorySource[];
};

export type FamilyHistoryData = {
  title: string;
  updatedAt: string;
  note: string;
  sections: FamilyHistorySection[];
};

let cache: FamilyHistoryData | null = null;

export async function getFamilyHistory(): Promise<FamilyHistoryData> {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "content", "family-history.json");
  const raw = await readFile(filePath, "utf8");
  cache = JSON.parse(raw) as FamilyHistoryData;
  return cache;
}
