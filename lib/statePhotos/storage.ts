import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";

const ALLOWED_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const MAX_BYTES = 20 * 1024 * 1024;

export async function storeStatePhotoFile(file: File): Promise<string> {
  if (!file.size || file.size > MAX_BYTES) {
    throw new Error("File too large (max 20 MB).");
  }
  const orig = file.name || "photo";
  const rawExt = path.extname(orig).slice(1).toLowerCase();
  const ext = rawExt || "jpg";
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error("Allowed types: PNG, JPG, JPEG, WebP, GIF.");
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const name = `statephotos/${randomUUID()}.${ext}`;
    const blob = await put(name, file, { access: "public" });
    return blob.url;
  }

  if (process.env.NODE_ENV !== "production") {
    const unique = `${randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "statephotos-uploads");
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, unique), buf);
    return `/statephotos-uploads/${unique}`;
  }

  throw new Error(
    "Set BLOB_READ_WRITE_TOKEN in Vercel (Blob storage) so photo uploads work in production."
  );
}
