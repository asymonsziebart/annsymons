/**
 * eBay sold-comp helpers for the collection tracker.
 *
 * Prefers Marketplace Insights (true sold prices, last ~90 days). That API is
 * limited-release — if the app key lacks buy.marketplace.insights, we fall back
 * to the public Browse API (active listings only) so the page still works.
 *
 * Env:
 *   EBAY_CLIENT_ID / EBAY_CLIENT_SECRET  – OAuth app credentials
 *   EBAY_ENV=sandbox|production         – optional, default production
 *   EBAY_MARKETPLACE_ID                 – optional, default EBAY_US
 */

import type { CardCompInput, CollectionCard } from "@/lib/collectionCardsShared";

const TOKEN_URL = {
  production: "https://api.ebay.com/identity/v1/oauth2/token",
  sandbox: "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
} as const;

const API_BASE = {
  production: "https://api.ebay.com",
  sandbox: "https://api.sandbox.ebay.com",
} as const;

const SOLD_SCOPE = "https://api.ebay.com/oauth/api_scope/buy.marketplace.insights";
const BROWSE_SCOPE = "https://api.ebay.com/oauth/api_scope";

/** Pokémon TCG Singles on eBay US. LEGO / Magic use keyword search only. */
const CATEGORY_IDS: Record<string, string | undefined> = {
  pokemon: "183454",
  lego: "19006",
  magic: "19107",
};

type EbayEnv = keyof typeof TOKEN_URL;

type CachedToken = {
  accessToken: string;
  expiresAt: number;
  scope: string;
};

declare global {
  // Reuse tokens across hot reloads / warm serverless instances.
  var ebayTokenCache: Map<string, CachedToken> | undefined;
}

export type EbayLookupMode = "sold" | "active" | "unavailable";

export type EbayLookupResult = {
  mode: EbayLookupMode;
  comps: CardCompInput[];
  query: string;
  message?: string;
};

function getEnv(): EbayEnv {
  return process.env.EBAY_ENV === "sandbox" ? "sandbox" : "production";
}

function getCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.EBAY_CLIENT_ID?.trim();
  const clientSecret = process.env.EBAY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isEbayConfigured(): boolean {
  return getCredentials() != null;
}

function marketplaceId(): string {
  return process.env.EBAY_MARKETPLACE_ID?.trim() || "EBAY_US";
}

function tokenCache(): Map<string, CachedToken> {
  if (!global.ebayTokenCache) global.ebayTokenCache = new Map();
  return global.ebayTokenCache;
}

async function getAppToken(scope: string): Promise<string> {
  const creds = getCredentials();
  if (!creds) {
    throw new Error(
      "eBay is not configured. Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET."
    );
  }

  const cacheKey = `${getEnv()}:${scope}`;
  const cached = tokenCache().get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) {
    return cached.accessToken;
  }

  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString(
    "base64"
  );
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope,
  });

  const res = await fetch(TOKEN_URL[getEnv()], {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };

  if (!res.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        data.error ||
        `eBay OAuth failed (${res.status}).`
    );
  }

  tokenCache().set(cacheKey, {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000,
    scope,
  });
  return data.access_token;
}

/** Builds a tight sold-search query from the card's identity fields. */
export function buildSearchQuery(card: CollectionCard): string {
  const parts = [
    card.name,
    card.setName,
    card.cardNumber ? `#${card.cardNumber}` : null,
    card.variant,
    card.grader && card.grade ? `${card.grader} ${card.grade}` : card.grade,
    card.category === "pokemon" ? "Pokemon" : null,
    card.category === "magic" ? "MTG" : null,
    card.category === "lego" ? "LEGO" : null,
  ]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);

  // Deduplicate while keeping order
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }
  return unique.join(" ").slice(0, 180);
}

function parseMoney(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === "object" && value !== null && "value" in value) {
    return parseMoney((value as { value: unknown }).value);
  }
  const num = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100) / 100;
}

function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

type EbaySoldItem = {
  itemId?: string;
  legacyItemId?: string;
  title?: string;
  lastSoldPrice?: { value?: string; currency?: string };
  lastSoldDate?: string;
  condition?: string;
  itemWebUrl?: string;
  image?: { imageUrl?: string };
  thumbnailImages?: Array<{ imageUrl?: string }>;
};

type EbayBrowseItem = {
  itemId?: string;
  title?: string;
  price?: { value?: string; currency?: string };
  condition?: string;
  itemWebUrl?: string;
  image?: { imageUrl?: string };
  thumbnailImages?: Array<{ imageUrl?: string }>;
};

async function searchSold(query: string, category: string): Promise<CardCompInput[]> {
  const token = await getAppToken(SOLD_SCOPE);
  const params = new URLSearchParams({
    q: query,
    limit: "20",
    sort: "lastSoldDate",
  });
  const categoryId = CATEGORY_IDS[category];
  if (categoryId) params.set("category_ids", categoryId);
  params.set("filter", `itemLocationCountry:US,priceCurrency:USD`);

  const res = await fetch(
    `${API_BASE[getEnv()]}/buy/marketplace_insights/v1_beta/item_sales/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": marketplaceId(),
      },
      cache: "no-store",
    }
  );

  const data = (await res.json()) as {
    itemSales?: EbaySoldItem[];
    errors?: Array<{ message?: string; errorId?: number }>;
  };

  if (!res.ok) {
    const message =
      data.errors?.[0]?.message || `Marketplace Insights failed (${res.status}).`;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const comps: CardCompInput[] = [];
  for (const item of data.itemSales ?? []) {
    const soldPrice = parseMoney(item.lastSoldPrice);
    if (soldPrice == null) continue;
    comps.push({
      source: "ebay-sold",
      externalId: item.itemId || item.legacyItemId || null,
      title: item.title?.trim() || "eBay sold listing",
      soldPrice,
      currency: item.lastSoldPrice?.currency || "USD",
      soldOn: parseDate(item.lastSoldDate),
      conditionLabel: item.condition?.trim() || null,
      listingUrl: item.itemWebUrl?.trim() || null,
      imageUrl:
        item.image?.imageUrl?.trim() ||
        item.thumbnailImages?.[0]?.imageUrl?.trim() ||
        null,
    });
  }
  return comps;
}

async function searchActive(query: string, category: string): Promise<CardCompInput[]> {
  const token = await getAppToken(BROWSE_SCOPE);
  const params = new URLSearchParams({
    q: query,
    limit: "20",
    sort: "price",
  });
  const categoryId = CATEGORY_IDS[category];
  if (categoryId) params.set("category_ids", categoryId);
  params.set(
    "filter",
    "buyingOptions:{FIXED_PRICE|AUCTION},conditions:{NEW|LIKE_NEW|VERY_GOOD|GOOD|ACCEPTABLE},itemLocationCountry:US,priceCurrency:USD"
  );

  const res = await fetch(
    `${API_BASE[getEnv()]}/buy/browse/v1/item_summary/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-EBAY-C-MARKETPLACE-ID": marketplaceId(),
      },
      cache: "no-store",
    }
  );

  const data = (await res.json()) as {
    itemSummaries?: EbayBrowseItem[];
    errors?: Array<{ message?: string }>;
  };

  if (!res.ok) {
    throw new Error(
      data.errors?.[0]?.message || `Browse API failed (${res.status}).`
    );
  }

  const comps: CardCompInput[] = [];
  for (const item of data.itemSummaries ?? []) {
    const price = parseMoney(item.price);
    if (price == null) continue;
    comps.push({
      source: "ebay-active",
      externalId: item.itemId || null,
      title: item.title?.trim() || "eBay listing",
      soldPrice: price,
      currency: item.price?.currency || "USD",
      soldOn: null,
      conditionLabel: item.condition?.trim() || null,
      listingUrl: item.itemWebUrl?.trim() || null,
      imageUrl:
        item.image?.imageUrl?.trim() ||
        item.thumbnailImages?.[0]?.imageUrl?.trim() ||
        null,
    });
  }
  return comps;
}

/**
 * Looks up sold comps when Insights is available; otherwise falls back to
 * active asking prices so the catalogue still gets a market estimate.
 */
export async function lookupEbayComps(card: CollectionCard): Promise<EbayLookupResult> {
  if (!isEbayConfigured()) {
    return {
      mode: "unavailable",
      comps: [],
      query: buildSearchQuery(card),
      message:
        "Add EBAY_CLIENT_ID and EBAY_CLIENT_SECRET to enable automatic eBay comps.",
    };
  }

  const query = buildSearchQuery(card);
  if (!query) {
    return {
      mode: "unavailable",
      comps: [],
      query: "",
      message: "Add a card name before looking up eBay comps.",
    };
  }

  try {
    const comps = await searchSold(query, card.category);
    return {
      mode: "sold",
      comps,
      query,
      message:
        comps.length === 0
          ? "No sold listings matched in the last ~90 days."
          : undefined,
    };
  } catch (soldError) {
    const status =
      soldError instanceof Error && "status" in soldError
        ? Number((soldError as Error & { status?: number }).status)
        : undefined;
    // 403 / 401 usually means Insights isn't provisioned for this app key.
    if (status === 401 || status === 403 || status === 404) {
      try {
        const comps = await searchActive(query, card.category);
        return {
          mode: "active",
          comps,
          query,
          message:
            "Sold-history API isn't enabled for this eBay app, so these are active asking prices. Request buy.marketplace.insights in the eBay Developer Program for true sold comps.",
        };
      } catch (activeError) {
        return {
          mode: "unavailable",
          comps: [],
          query,
          message:
            activeError instanceof Error
              ? activeError.message
              : "eBay lookup failed.",
        };
      }
    }

    return {
      mode: "unavailable",
      comps: [],
      query,
      message:
        soldError instanceof Error ? soldError.message : "eBay sold lookup failed.",
    };
  }
}
