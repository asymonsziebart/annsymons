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
  {
    slug: "ford-fusion-titanium-hybrid-2020",
    name: "2020 Ford Fusion Titanium Hybrid",
    brand: "Ford",
    model: "Fusion Titanium Hybrid",
    category: "Vehicles",
    location: null,
    support_url: "https://www.ford.com/support/owner-manuals-details/fusion-hybrid-phev/2020/",
    documents: [
      {
        label: "Owner's Manual (PDF)",
        url: "https://www.fordservicecontent.com/Ford_Content/Catalog/owner_information/2020_Ford_Fusion-Hybrid-Energi-Owners-Mnaul-version-1_om_EN-US_06_2019.pdf",
      },
      {
        label: "Online Owner's Manual",
        url: "https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Index?Variantid=6952&languageCode=EN&countryCode=USA&marketCode=US&bookcode=O97504&VIN=&userMarket=USA&div=f&buildtype=web",
      },
    ],
    notes:
      "2020 Fusion Hybrid / Energi owner's manual (covers SE, SEL, and Titanium Hybrid).",
  },
  {
    slug: "ford-maverick-hybrid-awd-2026",
    name: "2026 Ford Maverick Hybrid AWD",
    brand: "Ford",
    model: "Maverick Hybrid AWD",
    category: "Vehicles",
    location: null,
    support_url: "https://www.ford.com/support/owner-manuals-details/maverick/2026",
    documents: [
      {
        label: "Owner's Manual (PDF)",
        url: "https://www.fordservicecontent.com/Ford_Content/Catalog/owner_information/2026-Maverick-OM-enUSA-V1.pdf",
      },
      {
        label: "Online Owner's Manual",
        url: "https://www.fordservicecontent.com/Ford_Content/vdirsnet/OwnerManual/Home/Content?ProcUid=G2190859&Uid=G2207589&buildtype=web&countryCode=USA&div=f&languageCode=en&moidRef=G2130109&userMarket=usa&vFilteringEnabled=False&variantid=10811",
      },
    ],
    notes: "Husband's truck. 2026 Maverick Hybrid with all-wheel drive.",
  },
  {
    slug: "macbook-pro-m4",
    name: "MacBook Pro (M4)",
    brand: "Apple",
    model: "MacBook Pro M4",
    category: "Computers",
    location: null,
    support_url: "https://support.apple.com/mac/macbook-pro",
    documents: [
      {
        label: "MacBook Pro Getting Started Guide",
        url: "https://support.apple.com/guide/macbook-pro/welcome/mac",
      },
      {
        label: "Mac User Guide",
        url: "https://support.apple.com/guide/mac-help/welcome/mac",
      },
      {
        label: "Tech Specs (14-inch, M4, 2024)",
        url: "https://support.apple.com/en-us/121552",
      },
    ],
    notes:
      "Covers current MacBook Pro M4 models. Use the Getting Started Guide for hardware basics and the Mac User Guide for macOS.",
  },
  {
    slug: "instax-mini-7-plus",
    name: "Fujifilm instax mini 7+",
    brand: "Fujifilm",
    model: "instax mini 7+",
    category: "Cameras",
    location: null,
    support_url: "https://www.fujifilm.com/us/en/consumer/support/instax/mini-7plus",
    documents: [
      {
        label: "Product page & specs",
        url: "https://www.fujifilm.com/us/en/consumer/instax/cameras/mini-7plus",
      },
      {
        label: "Owner's Manual (Mini 7S PDF)",
        url: "https://instax.com/support/pdf/instaxmini7s_manual_01.pdf",
      },
      {
        label: "instax US Support & FAQs",
        url: "https://www.instaxus.com/support/",
      },
    ],
    notes:
      "Instant camera using instax mini film. Fujifilm does not publish a separate Mini 7+ PDF; the official Mini 7S manual covers the same film loading, batteries, and shooting basics (exposure dial is on the lens barrel on the 7+).",
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
