import { readFile } from "fs/promises";
import path from "path";
import { getSql, getSqlOrThrow } from "@/lib/db";
import type { FamilyTreeData, FamilyTreeFamily, FamilyTreePerson } from "@/lib/familyTree/types";

type SqlClient = ReturnType<typeof getSqlOrThrow>;

async function ensureFamilyTreeTable(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS family_trees (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Family Tree',
      source_filename TEXT,
      default_focus_id TEXT,
      people JSONB NOT NULL DEFAULT '[]'::jsonb,
      families JSONB NOT NULL DEFAULT '[]'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}

function asPeople(value: unknown): FamilyTreePerson[] {
  return Array.isArray(value) ? (value as FamilyTreePerson[]) : [];
}

function asFamilies(value: unknown): FamilyTreeFamily[] {
  return Array.isArray(value) ? (value as FamilyTreeFamily[]) : [];
}

function mapRow(row: Record<string, unknown>): FamilyTreeData {
  return {
    name: String(row.name ?? "Family Tree"),
    sourceFilename: row.source_filename ? String(row.source_filename) : null,
    defaultFocusId: row.default_focus_id ? String(row.default_focus_id) : null,
    people: asPeople(row.people),
    families: asFamilies(row.families),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

let seedCache: FamilyTreeData | null = null;

export async function getSeedFamilyTree(): Promise<FamilyTreeData> {
  if (seedCache) return seedCache;
  const filePath = path.join(process.cwd(), "content", "family-tree.json");
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as FamilyTreeData;
  seedCache = {
    name: parsed.name || "Family Tree",
    sourceFilename: parsed.sourceFilename ?? "FamilyTree.ftz",
    defaultFocusId: parsed.defaultFocusId ?? null,
    people: Array.isArray(parsed.people) ? parsed.people : [],
    families: Array.isArray(parsed.families) ? parsed.families : [],
    updatedAt: null,
  };
  return seedCache;
}

export async function getFamilyTree(): Promise<FamilyTreeData> {
  const sql = getSql();
  if (!sql) return getSeedFamilyTree();

  await ensureFamilyTreeTable(sql);
  const rows = await sql`
    SELECT name, source_filename, default_focus_id, people, families,
           updated_at::text AS updated_at
    FROM family_trees
    ORDER BY id ASC
    LIMIT 1
  `;

  if (!rows.length) {
    const seed = await getSeedFamilyTree();
    const peopleJson = JSON.stringify(seed.people);
    const familiesJson = JSON.stringify(seed.families);
    await sql`
      INSERT INTO family_trees (name, source_filename, default_focus_id, people, families)
      VALUES (
        ${seed.name},
        ${seed.sourceFilename},
        ${seed.defaultFocusId},
        CAST(${peopleJson} AS jsonb),
        CAST(${familiesJson} AS jsonb)
      )
    `;
    return seed;
  }

  return mapRow(rows[0] as Record<string, unknown>);
}

export async function saveFamilyTree(data: FamilyTreeData): Promise<FamilyTreeData> {
  const sql = getSqlOrThrow();
  await ensureFamilyTreeTable(sql);

  const peopleJson = JSON.stringify(data.people);
  const familiesJson = JSON.stringify(data.families);

  const existing = await sql`SELECT id FROM family_trees ORDER BY id ASC LIMIT 1`;
  let rows;
  if (existing.length) {
    const id = Number((existing[0] as { id: number }).id);
    rows = await sql`
      UPDATE family_trees
      SET name = ${data.name},
          source_filename = ${data.sourceFilename},
          default_focus_id = ${data.defaultFocusId},
          people = CAST(${peopleJson} AS jsonb),
          families = CAST(${familiesJson} AS jsonb),
          updated_at = NOW()
      WHERE id = ${id}
      RETURNING name, source_filename, default_focus_id, people, families,
                updated_at::text AS updated_at
    `;
  } else {
    rows = await sql`
      INSERT INTO family_trees (name, source_filename, default_focus_id, people, families)
      VALUES (
        ${data.name},
        ${data.sourceFilename},
        ${data.defaultFocusId},
        CAST(${peopleJson} AS jsonb),
        CAST(${familiesJson} AS jsonb)
      )
      RETURNING name, source_filename, default_focus_id, people, families,
                updated_at::text AS updated_at
    `;
  }

  return mapRow(rows[0] as Record<string, unknown>);
}
