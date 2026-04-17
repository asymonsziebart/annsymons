"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSql } from "@/lib/db";
import { clampFocus, clampZoom } from "@/lib/statePhotos/framing";
import { normalizeStateCode } from "@/lib/statePhotos/states";
import { storeStatePhotoFile } from "@/lib/statePhotos/storage";

function readFraming(formData: FormData) {
  return {
    fx: clampFocus(Number(formData.get("focus_x"))),
    fy: clampFocus(Number(formData.get("focus_y"))),
    z: clampZoom(Number(formData.get("zoom"))),
  };
}

export async function uploadStatePhoto(formData: FormData) {
  const code = normalizeStateCode(String(formData.get("state_code") ?? ""));
  if (!code) redirect("/statephotos?err=1");

  const sql = getSql();
  if (!sql) redirect(`/statephotos/${code}?err=no-database`);

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/statephotos/${code}?err=no-file`);
  }

  /** Server Actions send the whole file through Vercel (~4.5 MB limit). Use Blob client upload when token is set. */
  const maxServerBytes = 4 * 1024 * 1024;
  if (file.size > maxServerBytes) {
    redirect(`/statephotos/${code}?err=too-large`);
  }

  let url: string;
  try {
    url = await storeStatePhotoFile(file);
  } catch (e) {
    console.error(e);
    redirect(`/statephotos/${code}?err=upload`);
  }

  const { fx, fy, z } = readFraming(formData);

  try {
    const rows = await sql`
      SELECT COUNT(*)::int AS n FROM state_photos WHERE state_code = ${code}
    `;
    const row0 = Array.isArray(rows) ? rows[0] : rows;
    const n = Number((row0 as { n: number })?.n ?? 0);
    const isCover = n === 0;

    await sql`
      INSERT INTO state_photos (state_code, public_url, original_name, is_cover, focus_x, focus_y, frame_zoom)
      VALUES (${code}, ${url}, ${file.name}, ${isCover}, ${fx}, ${fy}, ${z})
    `;
  } catch (e) {
    console.error(e);
    redirect(`/statephotos/${code}?err=save`);
  }

  revalidatePath("/statephotos");
  revalidatePath(`/statephotos/${code}`);
  redirect(`/statephotos/${code}?ok=upload`);
}

export async function setPhotoCover(formData: FormData) {
  const id = Number(formData.get("photo_id"));
  if (!Number.isFinite(id)) redirect("/statephotos");

  const sql = getSql();
  if (!sql) redirect("/statephotos?err=no-database");

  let stateCode: string;
  try {
    const rows = await sql`SELECT state_code FROM state_photos WHERE id = ${id} LIMIT 1`;
    const row0 = Array.isArray(rows) ? rows[0] : rows;
    const r = row0 as { state_code: string } | undefined;
    if (!r?.state_code) redirect("/statephotos");
    stateCode = r.state_code;

    await sql`UPDATE state_photos SET is_cover = false WHERE state_code = ${stateCode}`;
    await sql`UPDATE state_photos SET is_cover = true WHERE id = ${id}`;
  } catch (e) {
    console.error(e);
    redirect("/statephotos?err=save");
  }

  revalidatePath("/statephotos");
  revalidatePath(`/statephotos/${stateCode}`);
  redirect(`/statephotos/${stateCode}?ok=cover`);
}

export async function savePhotoFraming(formData: FormData) {
  const id = Number(formData.get("photo_id"));
  if (!Number.isFinite(id)) redirect("/statephotos");

  const sql = getSql();
  if (!sql) redirect("/statephotos?err=no-database");

  const { fx, fy, z } = readFraming(formData);

  let stateCode: string;
  try {
    const rows = await sql`SELECT state_code FROM state_photos WHERE id = ${id} LIMIT 1`;
    const row0 = Array.isArray(rows) ? rows[0] : rows;
    const r = row0 as { state_code: string } | undefined;
    if (!r?.state_code) redirect("/statephotos");
    stateCode = r.state_code;

    await sql`
      UPDATE state_photos SET focus_x = ${fx}, focus_y = ${fy}, frame_zoom = ${z}
      WHERE id = ${id}
    `;
  } catch (e) {
    console.error(e);
    redirect("/statephotos?err=save");
  }

  revalidatePath("/statephotos");
  revalidatePath(`/statephotos/${stateCode}`);
  redirect(`/statephotos/${stateCode}?ok=frame`);
}

export async function deleteStatePhoto(formData: FormData) {
  const id = Number(formData.get("photo_id"));
  if (!Number.isFinite(id)) redirect("/statephotos");

  const sql = getSql();
  if (!sql) redirect("/statephotos?err=no-database");

  let stateCode: string;
  try {
    const rows = await sql`
      SELECT id, state_code, is_cover FROM state_photos WHERE id = ${id} LIMIT 1
    `;
    const row0 = Array.isArray(rows) ? rows[0] : rows;
    const photo = row0 as { id: number; state_code: string; is_cover: boolean } | undefined;
    if (!photo) redirect("/statephotos");
    stateCode = photo.state_code;
    const wasCover = photo.is_cover;

    await sql`DELETE FROM state_photos WHERE id = ${id}`;

    if (wasCover) {
      const nextRows = await sql`
        SELECT id FROM state_photos WHERE state_code = ${stateCode}
        ORDER BY created_at DESC LIMIT 1
      `;
      const next0 = Array.isArray(nextRows) ? nextRows[0] : nextRows;
      const nextP = next0 as { id: number } | undefined;
      if (nextP?.id) {
        await sql`UPDATE state_photos SET is_cover = true WHERE id = ${nextP.id}`;
      }
    }
  } catch (e) {
    console.error(e);
    redirect("/statephotos?err=save");
  }

  revalidatePath("/statephotos");
  revalidatePath(`/statephotos/${stateCode}`);
  redirect(`/statephotos/${stateCode}?ok=delete`);
}
