import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { put } from "@vercel/blob";
import { BACKYARD_MAX_UPLOAD_BYTES } from "@/lib/admin/uploadLimits";

export const ADMIN_UPLOAD_FOLDERS = [
  "recipes",
  "blog",
  "gallery",
  "garage",
  "truck-fund",
  "backyard",
  "instagram",
  "family-tree",
  "pokemon-cards",
] as const;

export type AdminUploadFolder = (typeof ADMIN_UPLOAD_FOLDERS)[number];

const ALLOWED_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

const MAX_BYTES_BY_FOLDER: Partial<Record<AdminUploadFolder, number>> = {
  backyard: BACKYARD_MAX_UPLOAD_BYTES,
};

function maxBytesFor(folder: AdminUploadFolder): number {
  return MAX_BYTES_BY_FOLDER[folder] ?? DEFAULT_MAX_BYTES;
}

function extensionFor(file: File): string {
  const fromName = path.extname(file.name || "").slice(1).toLowerCase();
  if (fromName && ALLOWED_EXT.has(fromName)) return fromName;
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/png") return "png";
  if (file.type === "image/gif") return "gif";
  if (file.type === "image/jpeg" || file.type === "image/jpg") return "jpg";
  return "jpg";
}

export async function storeAdminImageFile(
  file: File,
  folder: AdminUploadFolder
): Promise<string> {
  const maxBytes = maxBytesFor(folder);
  if (!file.size || file.size > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`File too large (max ${maxMb} MB).`);
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
