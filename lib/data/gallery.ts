import { getSql } from "@/lib/db";
import { galleryItems as staticGalleryItems, type GalleryItem } from "@/lib/gallery";

export type { GalleryItem };

export async function getGalleryItems(): Promise<GalleryItem[]> {
  const sql = getSql();
  if (!sql) return staticGalleryItems;
  try {
    const rows = await sql`
      SELECT id::text as id, title, description, src, type
      FROM gallery_items
      ORDER BY sort_order ASC, created_at ASC
    `;
    if (Array.isArray(rows) && rows.length > 0) {
      return rows as GalleryItem[];
    }
  } catch {
    // fallback
  }
  return staticGalleryItems;
}

export async function getGalleryItemById(id: string): Promise<GalleryItem | undefined> {
  const sql = getSql();
  if (!sql) return undefined;
  try {
    const rows = await sql`
      SELECT id::text as id, title, description, src, type
      FROM gallery_items
      WHERE id = ${parseInt(id, 10)}
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (row && typeof row === "object") return row as GalleryItem;
  } catch {
    // ignore
  }
  return undefined;
}
