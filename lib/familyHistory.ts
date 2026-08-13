import { readFile } from "fs/promises";
import path from "path";

export type FamilyHistorySource = {
  label: string;
  url: string;
};

export type FamilyHistoryVerbatimEntry = {
  title: string;
  paragraphs: string[];
};

export type FamilyHistoryQuestion = {
  id: string;
  category: string;
  prompt: string;
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
  /** Word-for-word family writings (journals, letters). Preserved as submitted. */
  verbatimEntries?: FamilyHistoryVerbatimEntry[];
};

export type FamilyHistoryData = {
  title: string;
  updatedAt: string;
  note: string;
  questions: FamilyHistoryQuestion[];
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
