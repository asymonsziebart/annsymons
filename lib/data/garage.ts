import { getSql, getSqlOrThrow } from "@/lib/db";

type SqlClient = ReturnType<typeof getSqlOrThrow>;

export type GarageBin = {
  id: number;
  bin_code: string;
  label: string | null;
  photo_path: string | null;
  inventory_text: string;
  notes: string | null;
  updated_at: string;
  created_at: string;
};

export type GarageBinInput = {
  bin_code: string;
  label?: string | null;
  photo_path?: string | null;
  inventory_text?: string | null;
  notes?: string | null;
};

async function ensureGarageTable(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS garage_bins (
      id SERIAL PRIMARY KEY,
      bin_code TEXT NOT NULL UNIQUE,
      label TEXT,
      photo_path TEXT,
      inventory_text TEXT NOT NULL DEFAULT '',
      notes TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function cleanOptional(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanRequired(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function mapGarageBin(row: Record<string, unknown>): GarageBin {
  return {
    id: Number(row.id),
    bin_code: String(row.bin_code ?? ""),
    label: cleanOptional(row.label),
    photo_path: cleanOptional(row.photo_path),
    inventory_text: String(row.inventory_text ?? ""),
    notes: cleanOptional(row.notes),
    updated_at: String(row.updated_at ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

export async function getGarageBins(): Promise<GarageBin[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureGarageTable(sql);
  const rows = await sql`
    SELECT id, bin_code, label, photo_path, inventory_text, notes,
           updated_at::text AS updated_at,
           created_at::text AS created_at
    FROM garage_bins
    ORDER BY updated_at DESC, id DESC
  `;
  return (rows as Record<string, unknown>[]).map(mapGarageBin);
}

export async function upsertGarageBin(input: GarageBinInput): Promise<GarageBin> {
  const sql = getSqlOrThrow();
  await ensureGarageTable(sql);

  const binCode = cleanRequired(input.bin_code);
  if (!binCode) throw new Error("Bin code is required");

  const label = cleanOptional(input.label);
  const photoPath = cleanOptional(input.photo_path);
  const inventoryText = typeof input.inventory_text === "string" ? input.inventory_text.trim() : "";
  const notes = cleanOptional(input.notes);

  const rows = await sql`
    INSERT INTO garage_bins (bin_code, label, photo_path, inventory_text, notes)
    VALUES (${binCode}, ${label}, ${photoPath}, ${inventoryText}, ${notes})
    ON CONFLICT (bin_code) DO UPDATE SET
      label = EXCLUDED.label,
      photo_path = EXCLUDED.photo_path,
      inventory_text = EXCLUDED.inventory_text,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING id, bin_code, label, photo_path, inventory_text, notes,
              updated_at::text AS updated_at,
              created_at::text AS created_at
  `;
  const row = (rows as Record<string, unknown>[])[0];
  if (!row) throw new Error("Failed to save garage bin");
  return mapGarageBin(row);
}

export async function deleteGarageBin(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  const sql = getSqlOrThrow();
  await ensureGarageTable(sql);
  await sql`
    DELETE FROM garage_bins
    WHERE id = ${id}
  `;
}
