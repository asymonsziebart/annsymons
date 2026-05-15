import { getSql, getSqlOrThrow } from "@/lib/db";

type SqlClient = ReturnType<typeof getSqlOrThrow>;

export type VoiceItem = {
  id: number;
  text: string;
  created_at: string;
};

async function ensureVoicesTable(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS voice_not_allowed_items (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function mapVoiceItem(row: Record<string, unknown>): VoiceItem {
  return {
    id: Number(row.id),
    text: String(row.text ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

export async function getVoiceItems(): Promise<VoiceItem[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureVoicesTable(sql);
  const rows = await sql`
    SELECT id, text, created_at::text AS created_at
    FROM voice_not_allowed_items
    ORDER BY created_at DESC, id DESC
  `;
  return (rows as Record<string, unknown>[]).map(mapVoiceItem);
}

export async function addVoiceItem(text: string): Promise<void> {
  const value = text.trim();
  if (!value) return;
  const sql = getSqlOrThrow();
  await ensureVoicesTable(sql);
  await sql`
    INSERT INTO voice_not_allowed_items (text)
    VALUES (${value})
  `;
}

export async function deleteVoiceItem(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  const sql = getSqlOrThrow();
  await ensureVoicesTable(sql);
  await sql`
    DELETE FROM voice_not_allowed_items
    WHERE id = ${id}
  `;
}
