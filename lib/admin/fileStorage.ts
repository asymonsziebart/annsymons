import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";

export const ADMIN_UPLOAD_FOLDERS = [
  "recipes",
  "blog",
  "gallery",
  "garage",
  "truck-fund",
  "backyard",
] as const;

export type AdminUploadFolder = (typeof ADMIN_UPLOAD_FOLDERS)[number];

const ALLOWED_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const MAX_BYTES = 10 * 1024 * 1024;

function extensionFor(file: File): string {
  const fromName = path.extname(file.name || "").slice(1).toLowerCase();
  if (fromName && ALLOWED_EXT.has(fromName)) return fromName;
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/png") return "png";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

export async function storeAdminImageFile(
  file: File,
  folder: AdminUploadFolder
): Promise<string> {
  if (!file.size || file.size > MAX_BYTES) {
    throw new Error("File too large (max 10 MB).");
  }

  const ext = extensionFor(file);
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error("Invalid type. Use JPEG, PNG, GIF, or WebP.");
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const name = `${folder}/${randomUUID()}.${ext}`;
    const blob = await put(name, file, { access: "public" });
    return blob.url;
  }

  if (process.env.NODE_ENV !== "production") {
    const base =
      path
        .basename(file.name || "image", path.extname(file.name || ""))
        .replace(/\W+/g, "-")
        .slice(0, 40) || "image";
    const unique = `${base}-${Date.now()}.${ext}`;
    const dir = path.join(process.cwd(), "public", folder);
    await mkdir(dir, { recursive: true });
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, unique), buf);
    return `/${folder}/${unique}`;
  }

  throw new Error(
    "Set BLOB_READ_WRITE_TOKEN in Vercel (Blob storage) so photo uploads work in production."
  );
}
