import type { ArtworkDocument, ArtworkMeta } from "./types";
import type { ImportedBrushSet } from "./brushImport";

const DB_NAME = "annsymons-procreate";
const DB_VERSION = 2;
const STORE = "artworks";
const BRUSH_STORE = "brushSets";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(BRUSH_STORE)) {
        db.createObjectStore(BRUSH_STORE, { keyPath: "id" });
      }
    };
  });
}

export async function listArtworks(): Promise<ArtworkMeta[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const docs = (req.result as ArtworkDocument[]).map(({ layers: _l, backgroundColor: _b, ...meta }) => meta);
      docs.sort((a, b) => b.modifiedAt - a.modifiedAt);
      resolve(docs);
    };
  });
}

export async function loadArtwork(id: string): Promise<ArtworkDocument | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve((req.result as ArtworkDocument) ?? null);
  });
}

export async function saveArtwork(doc: ArtworkDocument): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).put(doc);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function deleteArtwork(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const req = tx.objectStore(STORE).delete(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function duplicateArtwork(id: string): Promise<ArtworkDocument | null> {
  const original = await loadArtwork(id);
  if (!original) return null;
  const now = Date.now();
  const copy: ArtworkDocument = {
    ...original,
    id: crypto.randomUUID(),
    name: `${original.name} Copy`,
    createdAt: now,
    modifiedAt: now,
    layers: original.layers.map((l) => ({ ...l, id: crypto.randomUUID() })),
  };
  await saveArtwork(copy);
  return copy;
}

export function canvasToDataUrl(canvas: HTMLCanvasElement, quality = 0.92): string {
  return canvas.toDataURL("image/png", quality);
}

export function makeThumbnail(
  source: HTMLCanvasElement,
  maxSize = 400,
): string {
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const thumb = document.createElement("canvas");
  thumb.width = w;
  thumb.height = h;
  const ctx = thumb.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(source, 0, 0, w, h);
  return thumb.toDataURL("image/jpeg", 0.82);
}

export function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function createLayerCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return c;
}

export function generateId(): string {
  return crypto.randomUUID();
}

export async function listImportedBrushSets(): Promise<ImportedBrushSet[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BRUSH_STORE, "readonly");
    const req = tx.objectStore(BRUSH_STORE).getAll();
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const sets = (req.result as ImportedBrushSet[]).sort((a, b) => b.importedAt - a.importedAt);
      resolve(sets);
    };
  });
}

export async function saveImportedBrushSet(set: ImportedBrushSet): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BRUSH_STORE, "readwrite");
    const req = tx.objectStore(BRUSH_STORE).put(set);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}

export async function deleteImportedBrushSet(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BRUSH_STORE, "readwrite");
    const req = tx.objectStore(BRUSH_STORE).delete(id);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
  });
}
