import { getSql, getSqlOrThrow } from "@/lib/db";

type SqlClient = ReturnType<typeof getSqlOrThrow>;

export type ManualDocument = {
  label: string;
  url: string;
};

export type ManualItem = {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  location: string | null;
  support_url: string | null;
  documents: ManualDocument[];
  notes: string | null;
  updated_at: string;
  created_at: string;
};

export type ManualItemInput = {
  slug?: string | null;
  name: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  location?: string | null;
  support_url?: string | null;
  documents?: ManualDocument[] | null;
  notes?: string | null;
};

const SEED_MANUALS: Array<Omit<ManualItemInput, "slug"> & { slug: string }> = [
  {
    slug: "brother-ls-2125i",
    name: "Brother LS-2125i Sewing Machine",
    brand: "Brother",
    model: "LS-2125i",
    category: "Sewing",
    location: null,
    support_url:
      "https://support.brother.com/g/b/producttop.aspx?c=us&lang=en&prod=hf_ls2125eus",
    documents: [
      {
        label: "User's Guide",
        url: "https://download.brother.com/welcome/doch000042/ls2220272015202125_iug03enfrespt.pdf",
      },
      {
        label: "Quick Reference Guide",
        url: "https://download.brother.com/welcome/doch000098/ls2125i_qg03en.pdf",
      },
    ],
    notes:
      "Free-arm sewing machine. Official Brother manuals for the LS-2125 / LS-2125i / LS-2129 series.",
  },
];

/** Built-in manuals shown when the database is unavailable. */
export function getSeedManuals(): ManualItem[] {
  return SEED_MANUALS.map((seed, index) => ({
    id: -(index + 1),
    slug: seed.slug,
    name: seed.name,
    brand: seed.brand ?? null,
    model: seed.model ?? null,
    category: seed.category ?? null,
    location: seed.location ?? null,
    support_url: seed.support_url ?? null,
    documents: [...(seed.documents ?? [])],
    notes: seed.notes ?? null,
    updated_at: "",
    created_at: "",
  }));
}

async function ensureManualsTable(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS manuals (
      id SERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      category TEXT,
      location TEXT,
      support_url TEXT,
      documents JSONB NOT NULL DEFAULT '[]'::jsonb,
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

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseDocuments(value: unknown): ManualDocument[] {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = cleanRequired(row.label);
      const url = cleanRequired(row.url);
      if (!label || !url) return null;
      return { label, url };
    })
    .filter((doc): doc is ManualDocument => Boolean(doc));
}

function mapManualItem(row: Record<string, unknown>): ManualItem {
  return {
    id: Number(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    brand: cleanOptional(row.brand),
    model: cleanOptional(row.model),
    category: cleanOptional(row.category),
    location: cleanOptional(row.location),
    support_url: cleanOptional(row.support_url),
    documents: parseDocuments(row.documents),
    notes: cleanOptional(row.notes),
    updated_at: String(row.updated_at ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

async function seedDefaultManuals(sql: SqlClient): Promise<void> {
  for (const seed of SEED_MANUALS) {
    const documentsJson = JSON.stringify(seed.documents ?? []);
    await sql`
      INSERT INTO manuals (
        slug, name, brand, model, category, location, support_url, documents, notes
      )
      VALUES (
        ${seed.slug},
        ${seed.name},
        ${seed.brand},
        ${seed.model},
        ${seed.category},
        ${seed.location},
        ${seed.support_url},
        CAST(${documentsJson} AS jsonb),
        ${seed.notes}
      )
      ON CONFLICT (slug) DO NOTHING
    `;
  }
}

export async function getManuals(): Promise<ManualItem[]> {
  const sql = getSql();
  if (!sql) return [];
  await ensureManualsTable(sql);
  await seedDefaultManuals(sql);
  const rows = await sql`
    SELECT id, slug, name, brand, model, category, location, support_url,
           documents, notes,
           updated_at::text AS updated_at,
           created_at::text AS created_at
    FROM manuals
    ORDER BY name ASC, id ASC
  `;
  return (rows as Record<string, unknown>[]).map(mapManualItem);
}

export async function upsertManual(input: ManualItemInput): Promise<ManualItem> {
  const sql = getSqlOrThrow();
  await ensureManualsTable(sql);

  const name = cleanRequired(input.name);
  if (!name) throw new Error("Name is required");

  const brand = cleanOptional(input.brand);
  const model = cleanOptional(input.model);
  const category = cleanOptional(input.category);
  const location = cleanOptional(input.location);
  const supportUrl = cleanOptional(input.support_url);
  const notes = cleanOptional(input.notes);
  const documents = parseDocuments(input.documents ?? []);
  const documentsJson = JSON.stringify(documents);

  let slug = cleanOptional(input.slug) ?? slugify([brand, model, name].filter(Boolean).join(" "));
  if (!slug) slug = `manual-${Date.now()}`;

  const rows = await sql`
    INSERT INTO manuals (
      slug, name, brand, model, category, location, support_url, documents, notes
    )
    VALUES (
      ${slug},
      ${name},
      ${brand},
      ${model},
      ${category},
      ${location},
      ${supportUrl},
      CAST(${documentsJson} AS jsonb),
      ${notes}
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      brand = EXCLUDED.brand,
      model = EXCLUDED.model,
      category = EXCLUDED.category,
      location = EXCLUDED.location,
      support_url = EXCLUDED.support_url,
      documents = EXCLUDED.documents,
      notes = EXCLUDED.notes,
      updated_at = NOW()
    RETURNING id, slug, name, brand, model, category, location, support_url,
              documents, notes,
              updated_at::text AS updated_at,
              created_at::text AS created_at
  `;
  const row = (rows as Record<string, unknown>[])[0];
  if (!row) throw new Error("Failed to save manual");
  return mapManualItem(row);
}

export async function deleteManual(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  const sql = getSqlOrThrow();
  await ensureManualsTable(sql);
  await sql`
    DELETE FROM manuals
    WHERE id = ${id}
  `;
}
