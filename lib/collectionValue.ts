import type {
  CardComp,
  CardValuation,
  CollectionCard,
  CollectionCategory,
  CollectionSnapshot,
  CompSource,
} from "@/lib/collectionCardsShared";

export type Timeframe = "1D" | "1W" | "1M" | "3M" | "1Y" | "3Y" | "ALL";

export const TIMEFRAMES: Timeframe[] = ["1D", "1W", "1M", "3M", "1Y", "3Y", "ALL"];

const TIMEFRAME_DAYS: Record<Exclude<Timeframe, "ALL">, number> = {
  "1D": 1,
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "1Y": 365,
  "3Y": 365 * 3,
};

/**
 * Median of included comps. Prefers true sold prices; if none exist, uses
 * active/manual prices so the card still gets an estimate.
 */
export function estimateFromComps(comps: CardComp[]): CardValuation {
  const included = comps.filter((comp) => !comp.isExcluded && comp.soldPrice > 0);
  if (included.length === 0) {
    return { marketValue: null, source: null, sampleSize: 0 };
  }

  const preferSource = (source: CompSource) =>
    included.filter((comp) => comp.source === source);

  let chosen = preferSource("ebay-sold");
  let source: CompSource = "ebay-sold";
  if (chosen.length === 0) {
    chosen = preferSource("manual");
    source = "manual";
  }
  if (chosen.length === 0) {
    chosen = preferSource("ebay-active");
    source = "ebay-active";
  }
  if (chosen.length === 0) {
    chosen = included;
    source = included[0]!.source;
  }

  const prices = chosen.map((comp) => comp.soldPrice).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 0
      ? (prices[mid - 1]! + prices[mid]!) / 2
      : prices[mid]!;

  return {
    marketValue: Math.round(median * 100) / 100,
    source,
    sampleSize: prices.length,
  };
}

export function portfolioTotals(cards: CollectionCard[]): {
  marketValue: number;
  costBasis: number;
  cardCount: number;
  valuedCount: number;
} {
  let marketValue = 0;
  let costBasis = 0;
  let cardCount = 0;
  let valuedCount = 0;

  for (const card of cards) {
    cardCount += card.quantity;
    if (card.purchasePrice != null) {
      costBasis += card.purchasePrice * card.quantity;
    }
    if (card.marketValue != null) {
      marketValue += card.marketValue * card.quantity;
      valuedCount += card.quantity;
    }
  }

  return {
    marketValue: Math.round(marketValue * 100) / 100,
    costBasis: Math.round(costBasis * 100) / 100,
    cardCount,
    valuedCount,
  };
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date;
}

export function filterSnapshots(
  snapshots: CollectionSnapshot[],
  timeframe: Timeframe
): CollectionSnapshot[] {
  if (timeframe === "ALL") return snapshots;
  const cutoff = daysAgo(TIMEFRAME_DAYS[timeframe]);
  return snapshots.filter((snap) => {
    const date = new Date(`${snap.capturedOn}T00:00:00Z`);
    return date >= cutoff;
  });
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function categoryHref(category: CollectionCategory): string {
  return `/admin/pokemon-cards?category=${category}`;
}
