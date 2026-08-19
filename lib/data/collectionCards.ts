import { getSql, getSqlOrThrow } from "@/lib/db";
import {
  normalizeCategory,
  normalizeCompSource,
  type CardComp,
  type CardCompInput,
  type CardValuation,
  type CollectionCard,
  type CollectionCardInput,
  type CollectionCategory,
  type CollectionSnapshot,
} from "@/lib/collectionCardsShared";

export {
  CATEGORY_LABELS,
  COLLECTION_CATEGORIES,
  COMP_SOURCES,
  normalizeCategory,
  normalizeCompSource,
} from "@/lib/collectionCardsShared";
export type {
  CardComp,
  CardCompInput,
  CardValuation,
  CollectionCard,
  CollectionCardInput,
  CollectionCategory,
  CollectionSnapshot,
  CompSource,
} from "@/lib/collectionCardsShared";

type SqlClient = ReturnType<typeof getSqlOrThrow>;

const MAX_NOTES = 2_000;

let schemaReady: Promise<void> | null = null;

async function ensureSchema(sql: SqlClient): Promise<void> {
  if (!schemaReady) {
    schemaReady = runEnsureSchema(sql).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

async function runEnsureSchema(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS collection_cards (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL DEFAULT 'pokemon',
      name TEXT NOT NULL,
      set_name TEXT,
      card_number TEXT,
      variant TEXT,
      card_condition TEXT,
      grader TEXT,
      grade TEXT,
      card_language TEXT,
      quantity INT NOT NULL DEFAULT 1 CHECK (quantity >= 1),
      purchase_price NUMERIC(12, 2),
      acquired_on DATE,
      market_value NUMERIC(12, 2),
      market_value_source TEXT,
      market_value_sample INT,
      market_value_updated_at TIMESTAMPTZ,
      image_path TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_collection_cards_category
      ON collection_cards (category, updated_at DESC)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS collection_card_sales (
      id SERIAL PRIMARY KEY,
      card_id INT NOT NULL REFERENCES collection_cards(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      external_id TEXT,
      title TEXT NOT NULL,
      sold_price NUMERIC(12, 2) NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD',
      sold_on DATE,
      condition_label TEXT,
      listing_url TEXT,
      image_url TEXT,
      is_excluded BOOLEAN NOT NULL DEFAULT FALSE,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_collection_card_sales_card
      ON collection_card_sales (card_id, sold_on DESC NULLS LAST)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS collection_value_snapshots (
      id SERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      captured_on DATE NOT NULL,
      market_value NUMERIC(14, 2) NOT NULL,
      cost_basis NUMERIC(14, 2) NOT NULL,
      card_count INT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (category, captured_on)
    )
  `;
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed ? trimmed : null;
}

function money(value: unknown): number | null {
  const num = typeof value === "string" ? Number(value.replace(/[^0-9.-]/g, "")) : Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100) / 100;
}

function isoDate(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function timestamp(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  return typeof value === "string" && value ? value : null;
}

export async function getCollectionPageData(category: CollectionCategory): Promise<{
  cards: CollectionCard[];
  snapshots: CollectionSnapshot[];
}> {
  const [cards, snapshots] = await Promise.all([
    listCards(category),
    listSnapshots(category),
  ]);
  return { cards, snapshots };
}

function mapCard(row: Record<string, unknown>): CollectionCard {
  return {
    id: Number(row.id),
    category: normalizeCategory(row.category),
    name: String(row.name ?? ""),
    setName: text(row.set_name, 200),
    cardNumber: text(row.card_number, 50),
    variant: text(row.variant, 100),
    condition: text(row.card_condition, 50),
    grader: text(row.grader, 20),
    grade: text(row.grade, 10),
    language: text(row.card_language, 50),
    quantity: Number(row.quantity ?? 1),
    purchasePrice: row.purchase_price == null ? null : Number(row.purchase_price),
    acquiredOn: isoDate(row.acquired_on),
    marketValue: row.market_value == null ? null : Number(row.market_value),
    marketValueSource: text(row.market_value_source, 40),
    marketValueSample:
      row.market_value_sample == null ? null : Number(row.market_value_sample),
    marketValueUpdatedAt: timestamp(row.market_value_updated_at),
    imagePath: text(row.image_path, 500),
    notes: text(row.notes, MAX_NOTES),
    createdAt: timestamp(row.created_at) ?? "",
    updatedAt: timestamp(row.updated_at) ?? "",
    compCount: Number(row.comp_count ?? 0),
  };
}

function mapComp(row: Record<string, unknown>): CardComp {
  return {
    id: Number(row.id),
    cardId: Number(row.card_id),
    source: normalizeCompSource(row.source),
    externalId: text(row.external_id, 100),
    title: String(row.title ?? ""),
    soldPrice: Number(row.sold_price),
    currency: text(row.currency, 10) ?? "USD",
    soldOn: isoDate(row.sold_on),
    conditionLabel: text(row.condition_label, 100),
    listingUrl: text(row.listing_url, 1000),
    imageUrl: text(row.image_url, 1000),
    isExcluded: Boolean(row.is_excluded),
    fetchedAt: timestamp(row.fetched_at) ?? "",
  };
}

function normalizeCardFields(input: CollectionCardInput) {
  const quantity = Number(input.quantity);
  return {
    category: normalizeCategory(input.category),
    name: text(input.name, 200) ?? "",
    setName: text(input.setName, 200),
    cardNumber: text(input.cardNumber, 50),
    variant: text(input.variant, 100),
    condition: text(input.condition, 50),
    grader: text(input.grader, 20),
    grade: text(input.grade, 10),
    language: text(input.language, 50),
    quantity: Number.isFinite(quantity)
      ? Math.min(Math.max(Math.trunc(quantity), 1), 100_000)
      : 1,
    purchasePrice: money(input.purchasePrice),
    acquiredOn: isoDate(input.acquiredOn),
    imagePath: text(input.imagePath, 500),
    notes: text(input.notes, MAX_NOTES),
  };
}

export async function listCards(category?: CollectionCategory): Promise<CollectionCard[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureSchema(sql);

  const rows = category
    ? await sql`
        SELECT
          c.id, c.category, c.name, c.set_name, c.card_number, c.variant,
          c.card_condition, c.grader, c.grade, c.card_language, c.quantity,
          c.purchase_price, c.acquired_on::text AS acquired_on,
          c.market_value, c.market_value_source, c.market_value_sample,
          c.market_value_updated_at::text AS market_value_updated_at,
          c.image_path, c.notes,
          c.created_at::text AS created_at,
          c.updated_at::text AS updated_at,
          (
            SELECT COUNT(*)::int
            FROM collection_card_sales s
            WHERE s.card_id = c.id AND s.is_excluded = FALSE
          ) AS comp_count
        FROM collection_cards c
        WHERE c.category = ${category}
        ORDER BY c.name ASC, c.id ASC
      `
    : await sql`
        SELECT
          c.id, c.category, c.name, c.set_name, c.card_number, c.variant,
          c.card_condition, c.grader, c.grade, c.card_language, c.quantity,
          c.purchase_price, c.acquired_on::text AS acquired_on,
          c.market_value, c.market_value_source, c.market_value_sample,
          c.market_value_updated_at::text AS market_value_updated_at,
          c.image_path, c.notes,
          c.created_at::text AS created_at,
          c.updated_at::text AS updated_at,
          (
            SELECT COUNT(*)::int
            FROM collection_card_sales s
            WHERE s.card_id = c.id AND s.is_excluded = FALSE
          ) AS comp_count
        FROM collection_cards c
        ORDER BY c.name ASC, c.id ASC
      `;

  return (rows as Record<string, unknown>[]).map(mapCard);
}

export async function getCard(id: number): Promise<CollectionCard | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const sql = getSql();
  if (!sql) return null;
  await ensureSchema(sql);

  const rows = await sql`
    SELECT
      c.id, c.category, c.name, c.set_name, c.card_number, c.variant,
      c.card_condition, c.grader, c.grade, c.card_language, c.quantity,
      c.purchase_price, c.acquired_on::text AS acquired_on,
      c.market_value, c.market_value_source, c.market_value_sample,
      c.market_value_updated_at::text AS market_value_updated_at,
      c.image_path, c.notes,
      c.created_at::text AS created_at,
      c.updated_at::text AS updated_at,
      (
        SELECT COUNT(*)::int
        FROM collection_card_sales s
        WHERE s.card_id = c.id AND s.is_excluded = FALSE
      ) AS comp_count
    FROM collection_cards c
    WHERE c.id = ${id}
  `;
  const row = (rows as Record<string, unknown>[])[0];
  return row ? mapCard(row) : null;
}

export async function createCard(input: CollectionCardInput): Promise<CollectionCard> {
  const sql = getSqlOrThrow();
  await ensureSchema(sql);
  const fields = normalizeCardFields(input);
  if (!fields.name) throw new Error("Card name is required.");

  const rows = await sql`
    INSERT INTO collection_cards (
      category, name, set_name, card_number, variant, card_condition,
      grader, grade, card_language, quantity, purchase_price, acquired_on,
      image_path, notes
    )
    VALUES (
      ${fields.category}, ${fields.name}, ${fields.setName}, ${fields.cardNumber},
      ${fields.variant}, ${fields.condition}, ${fields.grader}, ${fields.grade},
      ${fields.language}, ${fields.quantity}, ${fields.purchasePrice},
      ${fields.acquiredOn}, ${fields.imagePath}, ${fields.notes}
    )
    RETURNING id
  `;
  const id = Number((rows as Record<string, unknown>[])[0]?.id);
  const card = await getCard(id);
  if (!card) throw new Error("Card was saved but could not be read back.");
  return card;
}

export async function updateCard(
  id: number,
  input: CollectionCardInput
): Promise<CollectionCard | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const sql = getSqlOrThrow();
  await ensureSchema(sql);
  const fields = normalizeCardFields(input);
  if (!fields.name) throw new Error("Card name is required.");

  await sql`
    UPDATE collection_cards
    SET
      category = ${fields.category},
      name = ${fields.name},
      set_name = ${fields.setName},
      card_number = ${fields.cardNumber},
      variant = ${fields.variant},
      card_condition = ${fields.condition},
      grader = ${fields.grader},
      grade = ${fields.grade},
      card_language = ${fields.language},
      quantity = ${fields.quantity},
      purchase_price = ${fields.purchasePrice},
      acquired_on = ${fields.acquiredOn},
      image_path = ${fields.imagePath},
      notes = ${fields.notes},
      updated_at = NOW()
    WHERE id = ${id}
  `;
  return getCard(id);
}

export async function deleteCard(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  const sql = getSqlOrThrow();
  await ensureSchema(sql);
  await sql`DELETE FROM collection_cards WHERE id = ${id}`;
}

export async function listComps(cardId: number): Promise<CardComp[]> {
  if (!Number.isInteger(cardId) || cardId <= 0) return [];
  const sql = getSql();
  if (!sql) return [];
  await ensureSchema(sql);

  const rows = await sql`
    SELECT
      id, card_id, source, external_id, title, sold_price, currency,
      sold_on::text AS sold_on, condition_label, listing_url, image_url,
      is_excluded, fetched_at::text AS fetched_at
    FROM collection_card_sales
    WHERE card_id = ${cardId}
    ORDER BY sold_on DESC NULLS LAST, id DESC
  `;
  return (rows as Record<string, unknown>[]).map(mapComp);
}

export async function addComp(cardId: number, input: CardCompInput): Promise<CardComp | null> {
  if (!Number.isInteger(cardId) || cardId <= 0) return null;
  const sql = getSqlOrThrow();
  await ensureSchema(sql);

  const price = money(input.soldPrice);
  if (price == null) throw new Error("A comp needs a sold price.");

  const rows = await sql`
    INSERT INTO collection_card_sales (
      card_id, source, external_id, title, sold_price, currency,
      sold_on, condition_label, listing_url, image_url
    )
    VALUES (
      ${cardId},
      ${normalizeCompSource(input.source)},
      ${text(input.externalId, 100)},
      ${text(input.title, 500) ?? "Untitled comp"},
      ${price},
      ${text(input.currency, 10) ?? "USD"},
      ${isoDate(input.soldOn)},
      ${text(input.conditionLabel, 100)},
      ${text(input.listingUrl, 1000)},
      ${text(input.imageUrl, 1000)}
    )
    RETURNING
      id, card_id, source, external_id, title, sold_price, currency,
      sold_on::text AS sold_on, condition_label, listing_url, image_url,
      is_excluded, fetched_at::text AS fetched_at
  `;
  const row = (rows as Record<string, unknown>[])[0];
  return row ? mapComp(row) : null;
}

/** Swaps in a fresh batch of eBay comps, keeping anything typed in by hand. */
export async function replaceEbayComps(
  cardId: number,
  comps: CardCompInput[]
): Promise<CardComp[]> {
  if (!Number.isInteger(cardId) || cardId <= 0) return [];
  const sql = getSqlOrThrow();
  await ensureSchema(sql);

  await sql`
    DELETE FROM collection_card_sales
    WHERE card_id = ${cardId} AND source <> 'manual'
  `;

  for (const comp of comps) {
    const price = money(comp.soldPrice);
    if (price == null) continue;
    await sql`
      INSERT INTO collection_card_sales (
        card_id, source, external_id, title, sold_price, currency,
        sold_on, condition_label, listing_url, image_url
      )
      VALUES (
        ${cardId},
        ${normalizeCompSource(comp.source)},
        ${text(comp.externalId, 100)},
        ${text(comp.title, 500) ?? "Untitled comp"},
        ${price},
        ${text(comp.currency, 10) ?? "USD"},
        ${isoDate(comp.soldOn)},
        ${text(comp.conditionLabel, 100)},
        ${text(comp.listingUrl, 1000)},
        ${text(comp.imageUrl, 1000)}
      )
    `;
  }

  return listComps(cardId);
}

export async function setCompExcluded(
  compId: number,
  isExcluded: boolean
): Promise<number | null> {
  if (!Number.isInteger(compId) || compId <= 0) return null;
  const sql = getSqlOrThrow();
  await ensureSchema(sql);

  const rows = await sql`
    UPDATE collection_card_sales
    SET is_excluded = ${isExcluded}
    WHERE id = ${compId}
    RETURNING card_id
  `;
  const cardId = Number((rows as Record<string, unknown>[])[0]?.card_id);
  return Number.isInteger(cardId) && cardId > 0 ? cardId : null;
}

export async function deleteComp(compId: number): Promise<number | null> {
  if (!Number.isInteger(compId) || compId <= 0) return null;
  const sql = getSqlOrThrow();
  await ensureSchema(sql);

  const rows = await sql`
    DELETE FROM collection_card_sales
    WHERE id = ${compId}
    RETURNING card_id
  `;
  const cardId = Number((rows as Record<string, unknown>[])[0]?.card_id);
  return Number.isInteger(cardId) && cardId > 0 ? cardId : null;
}

export async function saveCardValuation(
  cardId: number,
  valuation: CardValuation
): Promise<CollectionCard | null> {
  if (!Number.isInteger(cardId) || cardId <= 0) return null;
  const sql = getSqlOrThrow();
  await ensureSchema(sql);

  await sql`
    UPDATE collection_cards
    SET
      market_value = ${money(valuation.marketValue)},
      market_value_source = ${valuation.source},
      market_value_sample = ${valuation.sampleSize},
      market_value_updated_at = NOW(),
      updated_at = NOW()
    WHERE id = ${cardId}
  `;
  return getCard(cardId);
}

export async function listSnapshots(
  category: CollectionCategory
): Promise<CollectionSnapshot[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureSchema(sql);

  const rows = await sql`
    SELECT
      captured_on::text AS captured_on,
      market_value,
      cost_basis,
      card_count
    FROM collection_value_snapshots
    WHERE category = ${category}
    ORDER BY captured_on ASC
  `;

  return (rows as Record<string, unknown>[]).map((row) => ({
    capturedOn: isoDate(row.captured_on) ?? "",
    marketValue: Number(row.market_value),
    costBasis: Number(row.cost_basis),
    cardCount: Number(row.card_count),
  }));
}

/** Stores today's totals for a category, overwriting an earlier snapshot from the same day. */
export async function recordSnapshot(category: CollectionCategory): Promise<void> {
  const sql = getSqlOrThrow();
  await ensureSchema(sql);

  await sql`
    INSERT INTO collection_value_snapshots (
      category, captured_on, market_value, cost_basis, card_count
    )
    SELECT
      ${category},
      CURRENT_DATE,
      COALESCE(SUM(quantity * COALESCE(market_value, 0)), 0),
      COALESCE(SUM(quantity * COALESCE(purchase_price, 0)), 0),
      COALESCE(SUM(quantity), 0)::int
    FROM collection_cards
    WHERE category = ${category}
    ON CONFLICT (category, captured_on) DO UPDATE SET
      market_value = EXCLUDED.market_value,
      cost_basis = EXCLUDED.cost_basis,
      card_count = EXCLUDED.card_count
  `;
}
