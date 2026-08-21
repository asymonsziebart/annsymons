export const COLLECTION_CATEGORIES = ["pokemon", "lego", "magic"] as const;
export type CollectionCategory = (typeof COLLECTION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<CollectionCategory, string> = {
  pokemon: "Pokémon",
  lego: "LEGO",
  magic: "Magic",
};

export const COMP_SOURCES = ["ebay-sold", "ebay-active", "manual"] as const;
export type CompSource = (typeof COMP_SOURCES)[number];

export type CollectionCard = {
  id: number;
  category: CollectionCategory;
  name: string;
  setName: string | null;
  cardNumber: string | null;
  variant: string | null;
  condition: string | null;
  grader: string | null;
  grade: string | null;
  language: string | null;
  quantity: number;
  purchasePrice: number | null;
  acquiredOn: string | null;
  marketValue: number | null;
  marketValueSource: string | null;
  marketValueSample: number | null;
  marketValueUpdatedAt: string | null;
  imagePath: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  compCount: number;
};

export type CollectionCardInput = {
  category: CollectionCategory;
  name: string;
  setName?: string | null;
  cardNumber?: string | null;
  variant?: string | null;
  condition?: string | null;
  grader?: string | null;
  grade?: string | null;
  language?: string | null;
  quantity?: number | null;
  purchasePrice?: number | null;
  acquiredOn?: string | null;
  imagePath?: string | null;
  notes?: string | null;
};

export type CardComp = {
  id: number;
  cardId: number;
  source: CompSource;
  externalId: string | null;
  title: string;
  soldPrice: number;
  currency: string;
  soldOn: string | null;
  conditionLabel: string | null;
  listingUrl: string | null;
  imageUrl: string | null;
  isExcluded: boolean;
  fetchedAt: string;
};

export type CardCompInput = {
  source: CompSource;
  externalId?: string | null;
  title: string;
  soldPrice: number;
  currency?: string | null;
  soldOn?: string | null;
  conditionLabel?: string | null;
  listingUrl?: string | null;
  imageUrl?: string | null;
};

export type CollectionSnapshot = {
  capturedOn: string;
  marketValue: number;
  costBasis: number;
  cardCount: number;
};

export type CardValuation = {
  marketValue: number | null;
  source: CompSource | null;
  sampleSize: number;
};

/** Fields read from a card photo (client-safe; used by the scanner UI). */
export type ScannedCardFields = {
  name: string;
  setName: string | null;
  cardNumber: string | null;
  variant: string | null;
  condition: string | null;
  grader: string | null;
  grade: string | null;
  language: string | null;
};

export type CardScanResult = ScannedCardFields & {
  configured: boolean;
  matchedFromCatalog: boolean;
  confidence: string | null;
  message?: string;
};

export function normalizeCategory(value: unknown): CollectionCategory {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (COLLECTION_CATEGORIES as readonly string[]).includes(raw)
    ? (raw as CollectionCategory)
    : "pokemon";
}

export function normalizeCompSource(value: unknown): CompSource {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (COMP_SOURCES as readonly string[]).includes(raw) ? (raw as CompSource) : "manual";
}
