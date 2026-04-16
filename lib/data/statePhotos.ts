import { getSql } from "@/lib/db";
import { photoFramingValues } from "@/lib/statePhotos/framing";
import type { CoverSpec } from "@/lib/statePhotos/svgMap";

export type StatePhotoRow = {
  id: number;
  state_code: string;
  public_url: string;
  original_name: string | null;
  is_cover: boolean;
  focus_x: number | null;
  focus_y: number | null;
  frame_zoom: number | null;
  created_at: string;
};

export async function listPhotosForState(stateCode: string): Promise<StatePhotoRow[]> {
  const sql = getSql();
  if (!sql) return [];
  try {
    const rows = await sql`
      SELECT id, state_code, public_url, original_name, is_cover,
             focus_x, focus_y, frame_zoom, created_at
      FROM state_photos
      WHERE state_code = ${stateCode}
      ORDER BY is_cover DESC, created_at DESC
    `;
    return Array.isArray(rows) ? (rows as StatePhotoRow[]) : [];
  } catch {
    return [];
  }
}

export async function getCoverSpecsForMap(): Promise<Record<string, CoverSpec>> {
  const sql = getSql();
  if (!sql) return {};
  try {
    const rows = await sql`
      SELECT state_code, public_url, focus_x, focus_y, frame_zoom
      FROM state_photos
      WHERE is_cover = true
    `;
    const list = Array.isArray(rows) ? rows : [];
    const out: Record<string, CoverSpec> = {};
    for (const row of list as StatePhotoRow[]) {
      const [fx, fy, z] = photoFramingValues(row);
      out[row.state_code] = {
        href: row.public_url,
        focus_x: fx,
        focus_y: fy,
        zoom: z,
      };
    }
    return out;
  } catch {
    return {};
  }
}
