CREATE TABLE IF NOT EXISTS purchase_requests (
  id BIGSERIAL PRIMARY KEY,
  item_name TEXT NOT NULL,
  details TEXT,
  requested_by TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  decision_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS purchase_requests_status_created_idx
  ON purchase_requests (status, created_at DESC);

INSERT INTO purchase_requests (item_name, details, requested_by, status, decision_reason, decided_at)
SELECT
  'Truck',
  'Ford Maverick / reliable car purchase',
  'Ann',
  'accepted',
  'Accepted because you need a car.',
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM purchase_requests WHERE lower(item_name) = 'truck'
);

INSERT INTO purchase_requests (item_name, details, requested_by, status)
SELECT
  'AirTag for Copper''s collar',
  'Review whether Copper should have an AirTag on his collar.',
  'Ann',
  'pending'
WHERE NOT EXISTS (
  SELECT 1 FROM purchase_requests WHERE lower(item_name) = 'airtag for copper''s collar'
);
