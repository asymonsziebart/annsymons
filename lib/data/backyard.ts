import { getSql, getSqlOrThrow } from "@/lib/db";
import { clampFocus } from "@/lib/statePhotos/framing";
import { unstable_noStore as noStore } from "next/cache";

type SqlClient = ReturnType<typeof getSqlOrThrow>;

export type BackyardPhoto = {
  id: number;
  title: string | null;
  photo_path: string;
  created_at: string;
};

export type PlantPin = {
  id: number;
  photo_id: number;
  x_pct: number;
  y_pct: number;
  plant_name: string;
  common_name: string | null;
  species: string | null;
  planted_year: number | null;
  notes: string | null;
  created_at: string;
};

export type BackyardPhotoInput = {
  title?: string | null;
  photo_path: string;
};

export type PlantPinInput = {
  photo_id: number;
  x_pct: number;
  y_pct: number;
  plant_name: string;
  common_name?: string | null;
  species?: string | null;
  planted_year?: number | null;
  notes?: string | null;
};

export type PlantPinUpdate = {
  plant_name?: string;
  common_name?: string | null;
  species?: string | null;
  planted_year?: number | null;
  notes?: string | null;
  x_pct?: number;
  y_pct?: number;
};

async function ensureBackyardTables(sql: SqlClient): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS backyard_photos (
      id SERIAL PRIMARY KEY,
      title TEXT,
      photo_path TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS plant_pins (
      id SERIAL PRIMARY KEY,
      photo_id INT NOT NULL REFERENCES backyard_photos(id) ON DELETE CASCADE,
      x_pct DOUBLE PRECISION NOT NULL CHECK (x_pct >= 0 AND x_pct <= 100),
      y_pct DOUBLE PRECISION NOT NULL CHECK (y_pct >= 0 AND y_pct <= 100),
      plant_name TEXT NOT NULL,
      common_name TEXT,
      species TEXT,
      planted_year SMALLINT,
      notes TEXT,
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

function cleanYear(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1900 || n > 2100) return null;
  return n;
}

function mapBackyardPhoto(row: Record<string, unknown>): BackyardPhoto {
  return {
    id: Number(row.id),
    title: cleanOptional(row.title),
    photo_path: String(row.photo_path ?? ""),
    created_at: String(row.created_at ?? ""),
  };
}

function mapPlantPin(row: Record<string, unknown>): PlantPin {
  const year = row.planted_year;
  return {
    id: Number(row.id),
    photo_id: Number(row.photo_id),
    x_pct: Number(row.x_pct ?? 0),
    y_pct: Number(row.y_pct ?? 0),
    plant_name: String(row.plant_name ?? ""),
    common_name: cleanOptional(row.common_name),
    species: cleanOptional(row.species),
    planted_year: year == null ? null : Number(year),
    notes: cleanOptional(row.notes),
    created_at: String(row.created_at ?? ""),
  };
}

export async function getBackyardData(): Promise<{
  photos: BackyardPhoto[];
  pins: PlantPin[];
}> {
  noStore();
  const sql = getSql();
  if (!sql) return { photos: [], pins: [] };
  await ensureBackyardTables(sql);

  const photos = await sql`
    SELECT id, title, photo_path, created_at::text AS created_at
    FROM backyard_photos
    ORDER BY created_at DESC, id DESC
  `;
  const pins = await sql`
    SELECT id, photo_id, x_pct, y_pct, plant_name, common_name, species,
           planted_year, notes, created_at::text AS created_at
    FROM plant_pins
    ORDER BY plant_name ASC, id ASC
  `;

  return {
    photos: (photos as Record<string, unknown>[]).map(mapBackyardPhoto),
    pins: (pins as Record<string, unknown>[]).map(mapPlantPin),
  };
}

export async function createBackyardPhoto(input: BackyardPhotoInput): Promise<BackyardPhoto> {
  const sql = getSqlOrThrow();
  await ensureBackyardTables(sql);

  const photoPath = cleanRequired(input.photo_path);
  if (!photoPath) throw new Error("Photo path is required");
  const title = cleanOptional(input.title);

  const rows = await sql`
    INSERT INTO backyard_photos (title, photo_path)
    VALUES (${title}, ${photoPath})
    RETURNING id, title, photo_path, created_at::text AS created_at
  `;
  const row = (rows as Record<string, unknown>[])[0];
  if (!row) throw new Error("Failed to save backyard photo");
  return mapBackyardPhoto(row);
}

export async function deleteBackyardPhoto(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  const sql = getSqlOrThrow();
  await ensureBackyardTables(sql);
  await sql`DELETE FROM backyard_photos WHERE id = ${id}`;
}

export async function createPlantPin(input: PlantPinInput): Promise<PlantPin> {
  const sql = getSqlOrThrow();
  await ensureBackyardTables(sql);

  const photoId = Number(input.photo_id);
  if (!Number.isInteger(photoId) || photoId <= 0) throw new Error("Valid photo is required");

  const plantName = cleanRequired(input.plant_name);
  if (!plantName) throw new Error("Plant name is required");

  const xPct = clampFocus(input.x_pct);
  const yPct = clampFocus(input.y_pct);
  const commonName = cleanOptional(input.common_name);
  const species = cleanOptional(input.species);
  const plantedYear = cleanYear(input.planted_year);
  const notes = cleanOptional(input.notes);

  const rows = await sql`
    INSERT INTO plant_pins (photo_id, x_pct, y_pct, plant_name, common_name, species, planted_year, notes)
    VALUES (${photoId}, ${xPct}, ${yPct}, ${plantName}, ${commonName}, ${species}, ${plantedYear}, ${notes})
    RETURNING id, photo_id, x_pct, y_pct, plant_name, common_name, species,
              planted_year, notes, created_at::text AS created_at
  `;
  const row = (rows as Record<string, unknown>[])[0];
  if (!row) throw new Error("Failed to save plant pin");
  return mapPlantPin(row);
}

export async function updatePlantPin(id: number, input: PlantPinUpdate): Promise<PlantPin> {
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid pin id");
  const sql = getSqlOrThrow();
  await ensureBackyardTables(sql);

  const existing = await sql`
    SELECT id, photo_id, x_pct, y_pct, plant_name, common_name, species,
           planted_year, notes, created_at::text AS created_at
    FROM plant_pins
    WHERE id = ${id}
    LIMIT 1
  `;
  const current = (existing as Record<string, unknown>[])[0];
  if (!current) throw new Error("Plant pin not found");

  const plantName =
    input.plant_name !== undefined ? cleanRequired(input.plant_name) : String(current.plant_name ?? "");
  if (!plantName) throw new Error("Plant name is required");

  const xPct = input.x_pct !== undefined ? clampFocus(input.x_pct) : Number(current.x_pct);
  const yPct = input.y_pct !== undefined ? clampFocus(input.y_pct) : Number(current.y_pct);
  const commonName =
    input.common_name !== undefined ? cleanOptional(input.common_name) : cleanOptional(current.common_name);
  const species =
    input.species !== undefined ? cleanOptional(input.species) : cleanOptional(current.species);
  const plantedYear =
    input.planted_year !== undefined ? cleanYear(input.planted_year) : cleanYear(current.planted_year);
  const notes = input.notes !== undefined ? cleanOptional(input.notes) : cleanOptional(current.notes);

  const rows = await sql`
    UPDATE plant_pins
    SET x_pct = ${xPct},
        y_pct = ${yPct},
        plant_name = ${plantName},
        common_name = ${commonName},
        species = ${species},
        planted_year = ${plantedYear},
        notes = ${notes}
    WHERE id = ${id}
    RETURNING id, photo_id, x_pct, y_pct, plant_name, common_name, species,
              planted_year, notes, created_at::text AS created_at
  `;
  const row = (rows as Record<string, unknown>[])[0];
  if (!row) throw new Error("Failed to update plant pin");
  return mapPlantPin(row);
}

export async function deletePlantPin(id: number): Promise<void> {
  if (!Number.isInteger(id) || id <= 0) return;
  const sql = getSqlOrThrow();
  await ensureBackyardTables(sql);
  await sql`DELETE FROM plant_pins WHERE id = ${id}`;
}
