-- Run in Neon SQL Editor. Singleton settings for /admin/truck-fund.

CREATE TABLE IF NOT EXISTS truck_fund (
  id                      INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  down_payment_saved      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  interest_rate_percent   NUMERIC(5, 2) NOT NULL DEFAULT 5,
  vehicle_price           NUMERIC(12, 2) NOT NULL DEFAULT 28000,
  loan_term_months        INT NOT NULL DEFAULT 60,
  image_path              TEXT,
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO truck_fund (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
