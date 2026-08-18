-- Trading card collection tracker for /admin/pokemon-cards.
-- Run in Neon SQL Editor (optional — tables are also created on first use).

CREATE TABLE IF NOT EXISTS collection_cards (
  id SERIAL PRIMARY KEY,
  -- pokemon | lego | magic — drives the tabs on the admin page
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
  -- Estimated per-copy value, refreshed from eBay comps
  market_value NUMERIC(12, 2),
  market_value_source TEXT,
  market_value_sample INT,
  market_value_updated_at TIMESTAMPTZ,
  image_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_cards_category
  ON collection_cards (category, updated_at DESC);

-- Sold/asking comparables from eBay (or typed in by hand)
CREATE TABLE IF NOT EXISTS collection_card_sales (
  id SERIAL PRIMARY KEY,
  card_id INT NOT NULL REFERENCES collection_cards(id) ON DELETE CASCADE,
  -- ebay-sold | ebay-active | manual
  source TEXT NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  sold_price NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  sold_on DATE,
  condition_label TEXT,
  listing_url TEXT,
  image_url TEXT,
  -- Bad matches stay in the list but stop counting toward the estimate
  is_excluded BOOLEAN NOT NULL DEFAULT FALSE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_collection_card_sales_card
  ON collection_card_sales (card_id, sold_on DESC NULLS LAST);

-- One row per category per day so the value chart has real history
CREATE TABLE IF NOT EXISTS collection_value_snapshots (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  captured_on DATE NOT NULL,
  market_value NUMERIC(14, 2) NOT NULL,
  cost_basis NUMERIC(14, 2) NOT NULL,
  card_count INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category, captured_on)
);
