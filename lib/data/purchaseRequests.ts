import { getSql, getSqlOrThrow } from "@/lib/db";

export const PURCHASE_REQUEST_STATUSES = ["pending", "accepted", "rejected"] as const;

export type PurchaseRequestStatus = (typeof PURCHASE_REQUEST_STATUSES)[number];

export type PurchaseRequestRow = {
  id: number;
  itemName: string;
  details: string | null;
  requestedBy: string | null;
  status: PurchaseRequestStatus;
  decisionReason: string | null;
  createdAt: string;
  decidedAt: string | null;
  updatedAt: string;
};

export type CreatePurchaseRequestInput = {
  itemName: string;
  details?: string | null;
  requestedBy?: string | null;
};

export type PurchaseRequestDecisionInput = {
  status: PurchaseRequestStatus;
  decisionReason?: string | null;
};

export const PURCHASE_REQUESTS_MIGRATION_HINT =
  "Run db/create-purchase-requests.sql on the database to enable purchase requests.";

function normalizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function normalizePurchaseRequestStatus(value: unknown): PurchaseRequestStatus {
  const s = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (PURCHASE_REQUEST_STATUSES as readonly string[]).includes(s)
    ? (s as PurchaseRequestStatus)
    : "pending";
}

function mapRow(row: Record<string, unknown>): PurchaseRequestRow {
  return {
    id: Number(row.id),
    itemName: String(row.item_name ?? ""),
    details: row.details != null ? String(row.details) : null,
    requestedBy: row.requested_by != null ? String(row.requested_by) : null,
    status: normalizePurchaseRequestStatus(row.status),
    decisionReason: row.decision_reason != null ? String(row.decision_reason) : null,
    createdAt: String(row.created_at ?? ""),
    decidedAt: row.decided_at != null ? String(row.decided_at) : null,
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function getPurchaseRequests(): Promise<PurchaseRequestRow[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    const rows = await sql`
      SELECT id, item_name, details, requested_by, status, decision_reason,
             created_at::text AS created_at,
             decided_at::text AS decided_at,
             updated_at::text AS updated_at
      FROM purchase_requests
      ORDER BY
        CASE status WHEN 'pending' THEN 0 ELSE 1 END,
        created_at DESC,
        id DESC
    `;
    return (rows as Record<string, unknown>[]).map(mapRow);
  } catch {
    return [];
  }
}

export async function getPurchaseRequestCounts(): Promise<{
  total: number;
  pending: number;
}> {
  const sql = getSql();
  if (!sql) return { total: 0, pending: 0 };
  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE status = 'pending')::int AS pending
      FROM purchase_requests
    `;
    const row = (rows as Record<string, unknown>[])[0];
    return {
      total: Number(row?.total ?? 0),
      pending: Number(row?.pending ?? 0),
    };
  } catch {
    return { total: 0, pending: 0 };
  }
}

export async function createPurchaseRequest(
  input: CreatePurchaseRequestInput
): Promise<PurchaseRequestRow> {
  const itemName = normalizeText(input.itemName, 160);
  if (!itemName) throw new Error("Item name is required");

  const details = normalizeText(input.details, 2000);
  const requestedBy = normalizeText(input.requestedBy, 80);
  const sql = getSqlOrThrow();
  const rows = await sql`
    INSERT INTO purchase_requests (item_name, details, requested_by)
    VALUES (${itemName}, ${details}, ${requestedBy})
    RETURNING id, item_name, details, requested_by, status, decision_reason,
              created_at::text AS created_at,
              decided_at::text AS decided_at,
              updated_at::text AS updated_at
  `;
  return mapRow((rows as Record<string, unknown>[])[0]!);
}

export async function decidePurchaseRequest(
  id: number,
  input: PurchaseRequestDecisionInput
): Promise<PurchaseRequestRow | null> {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid request id");

  const status = normalizePurchaseRequestStatus(input.status);
  const decisionReason = normalizeText(input.decisionReason, 1000);
  const sql = getSqlOrThrow();
  const rows = await sql`
    UPDATE purchase_requests
    SET status = ${status},
        decision_reason = ${decisionReason},
        decided_at = CASE WHEN ${status} = 'pending' THEN NULL ELSE NOW() END,
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, item_name, details, requested_by, status, decision_reason,
              created_at::text AS created_at,
              decided_at::text AS decided_at,
              updated_at::text AS updated_at
  `;
  const row = (rows as Record<string, unknown>[])[0];
  return row ? mapRow(row) : null;
}
