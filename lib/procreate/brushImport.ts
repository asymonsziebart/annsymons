import { parse as parsePlist } from "plist";
import type { BrushDef } from "./types";

export type ImportedBrushSet = {
  id: string;
  name: string;
  importedAt: number;
  brushes: BrushDef[];
};

export type BplistRoot = {
  $objects: unknown[];
};

type BrushEntry =
  | { kind: "folder"; path: string; label?: string }
  | { kind: "brush"; path: string; label?: string };

function isUid(v: unknown): v is { uid: number } | { UID: number } {
  if (!v || typeof v !== "object") return false;
  const o = v as { uid?: number; UID?: number };
  return typeof o.uid === "number" || typeof o.UID === "number";
}

function uidIndex(v: { uid?: number; UID?: number }): number {
  return v.uid ?? v.UID ?? 0;
}

function deref(root: BplistRoot, val: unknown): unknown {
  if (isUid(val)) return root.$objects[uidIndex(val)];
  return val;
}

function findBrushSettings(root: BplistRoot): Record<string, unknown> | null {
  for (let i = 1; i < root.$objects.length; i++) {
    const obj = deref(root, root.$objects[i]);
    if (!obj || typeof obj !== "object") continue;
    const rec = obj as Record<string, unknown>;
    if (
      "paintSize" in rec ||
      "plotSpacing" in rec ||
      (typeof rec.name === "string" && ("renderingMaxTransfer" in rec || "plotJitter" in rec))
    ) {
      return rec;
    }
  }
  return null;
}

function normalizeRoot(top: unknown): BplistRoot | null {
  if (!top || typeof top !== "object") return null;

  if ("$objects" in top && Array.isArray((top as BplistRoot).$objects)) {
    const root = top as BplistRoot;
    const settings = findBrushSettings(root);
    if (settings) {
      return { $objects: [null, settings, ...root.$objects] };
    }
    return root;
  }

  if ("name" in top || "paintSize" in top) {
    return { $objects: [null, top] };
  }

  return null;
}

function loadSetting(root: BplistRoot, key: string): unknown {
  const settings = root.$objects[1] as Record<string, unknown> | undefined;
  if (!settings || typeof settings !== "object") return undefined;
  return deref(root, settings[key]);
}

function loadString(root: BplistRoot, key: string, fallback = ""): string {
  const v = loadSetting(root, key);
  return typeof v === "string" ? v : fallback;
}

function loadNumber(root: BplistRoot, key: string, fallback = 0): number {
  const v = loadSetting(root, key);
  return typeof v === "number" ? v : fallback;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function bytesToDataUrl(bytes: Uint8Array, mime = "image/png"): string {
  const chunk = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function isBinaryPlist(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x62 &&
    bytes[1] === 0x70 &&
    bytes[2] === 0x6c &&
    bytes[3] === 0x69 &&
    bytes[4] === 0x73 &&
    bytes[5] === 0x74
  );
}

function decodePlistText(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  }
  return new TextDecoder("utf-8").decode(bytes);
}

/** Never throws — plist treats all Uint8Array as binary, so decode XML as text first. */
function safeParsePlistBytes(bytes: Uint8Array): unknown {
  try {
    if (isBinaryPlist(bytes)) {
      return parsePlist(bytes);
    }
    const text = decodePlistText(bytes).trimStart();
    if (!text) return null;
    return parsePlist(text);
  } catch {
    return null;
  }
}

function mapProcreateToBrushDef(
  root: BplistRoot,
  setName: string,
  brushPath: string,
  tipImage?: string,
): BrushDef {
  const name = loadString(root, "name", brushPath.split("/").pop()?.replace(/\.brush$/i, "") ?? "Imported Brush");
  const paintSize = loadNumber(root, "paintSize", 0.15);
  const paintOpacity = loadNumber(root, "paintOpacity", 1);
  const plotSpacing = loadNumber(root, "plotSpacing", 0.04);
  const plotJitter = loadNumber(root, "plotJitter", 0);
  const plotSmoothing = loadNumber(root, "plotSmoothing", 0);
  const pressureSmooth = loadNumber(root, "dynamicsPressureSmoothing", 0);
  const maxTransfer = loadNumber(root, "renderingMaxTransfer", 1);
  const modulatedTransfer = loadNumber(root, "renderingModulatedTransfer", 1);

  const spacing = Math.min(0.5, Math.max(0.02, Math.sqrt(Math.max(plotSpacing, 0.0001) * 100) / 100));
  const scatter = Math.min(1, Math.sqrt(Math.max(plotJitter, 0)) / 2);
  const streamline = Math.min(0.95, Math.max(plotSmoothing, pressureSmooth));
  const flow = Math.min(1, Math.max(0.1, modulatedTransfer || maxTransfer || 1));
  const size = Math.min(120, Math.max(4, paintSize * 320));

  const id = `imported-${slugify(setName)}-${slugify(name)}-${slugify(brushPath || "brush")}`;

  return {
    id,
    name,
    category: "imported",
    preview: tipImage ?? "#636366",
    size,
    opacity: Math.min(1, Math.max(0.05, paintOpacity)),
    spacing,
    flow,
    hardness: tipImage ? 0.85 : 0.5,
    scatter,
    streamline,
    wetMix: loadNumber(root, "dynamicsGlazedFlow", 0),
    texture: tipImage ? "grain" : "smooth",
    taper: loadNumber(root, "taperSize", 0.15),
    tipImage,
    setName,
    imported: true,
  };
}

function fallbackBrush(
  setName: string,
  brushPath: string,
  tipImage?: string,
): BrushDef | null {
  if (!tipImage) return null;
  const name = brushPath.split("/").pop()?.replace(/\.brush$/i, "") || "Imported Brush";
  const id = `imported-${slugify(setName)}-${slugify(name)}-fallback`;
  return {
    id,
    name,
    category: "imported",
    preview: tipImage,
    size: 18,
    opacity: 0.9,
    spacing: 0.08,
    flow: 0.85,
    hardness: 0.7,
    scatter: 0.05,
    streamline: 0.4,
    wetMix: 0,
    texture: "grain",
    taper: 0.2,
    tipImage,
    setName,
    imported: true,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZipFile = any;

const ARCHIVE_NAMES = ["Brush.archive", "Brush.brusharchive", "Preset.archive"];

function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+/, "");
}

async function pickTipImage(zip: ZipFile, prefix: string): Promise<string | undefined> {
  const base = prefix ? `${prefix}/` : "";
  const candidates = [
    `${base}Shape.png`,
    `${base}Brushtip.png`,
    `${base}Stamp.png`,
    `${base}QuickLook/Thumbnail.png`,
    `${base}Preview.png`,
    `${base}QuickLook/Preview.png`,
  ];
  for (const path of candidates) {
    const file = zip.file(path);
    if (!file) continue;
    const bytes = await file.async("uint8array");
    return bytesToDataUrl(bytes);
  }
  return undefined;
}

async function findArchiveFile(zip: ZipFile, prefix: string): Promise<ZipFile | null> {
  const base = prefix ? `${prefix}/` : "";
  for (const name of ARCHIVE_NAMES) {
    const file = zip.file(`${base}${name}`);
    if (file) return file;
  }
  const lowerPrefix = base.toLowerCase();
  let match: ZipFile | null = null;
  zip.forEach((relPath: string, file: ZipFile) => {
    if (match) return;
    const norm = normalizeZipPath(relPath);
    if (!norm.toLowerCase().startsWith(lowerPrefix)) return;
    const leaf = norm.slice(base.length);
    if (/^brush\.archive$/i.test(leaf) || /\.archive$/i.test(leaf)) {
      match = file;
    }
  });
  return match;
}

async function parseBrushFromFolderZip(
  zip: ZipFile,
  folderPath: string,
  setName: string,
  displayName?: string,
): Promise<BrushDef | null> {
  const prefix = normalizeZipPath(folderPath);
  const archiveFile = await findArchiveFile(zip, prefix);
  const tipImage = await pickTipImage(zip, prefix);
  const label = displayName ?? (prefix || "brush");

  if (!archiveFile) {
    return fallbackBrush(setName, label, tipImage);
  }

  const archiveBytes = await archiveFile.async("uint8array");
  const top = safeParsePlistBytes(archiveBytes);
  const root = normalizeRoot(top);
  if (root) {
    return mapProcreateToBrushDef(root, setName, label, tipImage);
  }

  return fallbackBrush(setName, label, tipImage);
}

function discoverBrushEntries(zip: ZipFile): BrushEntry[] {
  const folders = new Set<string>();
  const brushFiles: string[] = [];
  const previewFolders = new Set<string>();

  zip.forEach((relPath: string) => {
    const path = normalizeZipPath(relPath);
    if (!path || path.startsWith("__MACOSX/")) return;

    if (/brush\.archive$/i.test(path) || /\.archive$/i.test(path)) {
      folders.add(path.replace(/\/?[^/]+\.archive$/i, ""));
    } else if (/\.brush$/i.test(path)) {
      brushFiles.push(path);
    } else if (/(?:Shape\.png|QuickLook\/Thumbnail\.png|Brushtip\.png)$/i.test(path)) {
      previewFolders.add(path.replace(/\/?(?:Shape\.png|QuickLook\/Thumbnail\.png|Brushtip\.png)$/i, ""));
    }
  });

  const entries: BrushEntry[] = brushFiles.map((path) => ({
    kind: "brush",
    path,
    label: path.replace(/\.brush$/i, "").split("/").pop(),
  }));

  for (const path of folders) {
    if (!brushFiles.some((b) => b.startsWith(`${path}/`) || b === `${path}.brush`)) {
      entries.push({ kind: "folder", path, label: path.split("/").pop() });
    }
  }

  for (const path of previewFolders) {
    if (
      folders.has(path) ||
      brushFiles.some((b) => b.startsWith(`${path}/`) || b.replace(/\.brush$/i, "") === path)
    ) {
      continue;
    }
    entries.push({ kind: "folder", path, label: path.split("/").pop() });
  }

  return entries;
}

function findSetPlistFile(zip: ZipFile): ZipFile | null {
  if (zip.file("brushset.plist")) return zip.file("brushset.plist");
  let match: ZipFile | null = null;
  zip.forEach((relPath: string, file: ZipFile) => {
    if (match) return;
    const path = normalizeZipPath(relPath);
    if (path.startsWith("__MACOSX/")) return;
    if (/brushset\.plist$/i.test(path)) match = file;
  });
  return match;
}

async function readBrushPathsFromSetPlist(zip: ZipFile): Promise<string[]> {
  const plistFile = findSetPlistFile(zip);
  if (!plistFile) return [];

  const bytes = await plistFile.async("uint8array");
  const top = safeParsePlistBytes(bytes);
  if (!top || typeof top !== "object") return [];

  const root = normalizeRoot(top);
  const record = top as Record<string, unknown>;
  let val = record.brushes;
  if (root) val = deref(root, val);
  if (!Array.isArray(val)) return [];

  return val
    .map((item) => (root ? deref(root, item) : item))
    .filter((item): item is string => typeof item === "string")
    .map(normalizeZipPath);
}

async function parseBrushEntry(
  zip: ZipFile,
  entry: BrushEntry,
  setName: string,
  JSZip: { loadAsync: (data: Uint8Array) => Promise<ZipFile> },
): Promise<BrushDef | null> {
  if (entry.kind === "folder") {
    return parseBrushFromFolderZip(zip, entry.path, setName, entry.label);
  }

  const innerFile = zip.file(entry.path);
  if (!innerFile) return null;

  const innerBytes = await innerFile.async("uint8array");
  const label = entry.label ?? entry.path.replace(/\.brush$/i, "").split("/").pop() ?? entry.path;

  try {
    const innerZip = await JSZip.loadAsync(innerBytes);
    return parseBrushFromFolderZip(innerZip, "", setName, label);
  } catch {
    const folderPath = entry.path.replace(/\.brush$/i, "");
    return parseBrushFromFolderZip(zip, folderPath, setName, label);
  }
}

function userFacingImportError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Import failed";
  if (/binary plist|bplist|malformed document|Invalid PLIST/i.test(message)) {
    return "Could not read brush metadata from this file. Try a hard refresh (Ctrl+Shift+R), then import again. If it still fails, re-export the set from Procreate.";
  }
  return message;
}

/** Parse a Procreate .brushset or .brush file entirely in the browser (no upload). */
export async function importProcreateBrushFile(file: File): Promise<ImportedBrushSet> {
  const JSZip = (await import("jszip")).default;

  let zip: ZipFile;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("Could not read this file. Make sure it is a .brushset or .brush from Procreate.");
  }

  const setName = file.name.replace(/\.(brushset|brush)$/i, "") || "Imported Brushes";
  const brushes: BrushDef[] = [];
  const lower = file.name.toLowerCase();
  const seen = new Set<string>();

  function addBrush(brush: BrushDef | null) {
    if (!brush || seen.has(brush.id)) return;
    seen.add(brush.id);
    brushes.push(brush);
  }

  try {
    if (lower.endsWith(".brushset")) {
      const plistPaths = await readBrushPathsFromSetPlist(zip);
      const entries = discoverBrushEntries(zip);

      for (const p of plistPaths) {
        const exists = entries.some((e) => {
          const ep = normalizeZipPath(e.path);
          return ep === p || ep.endsWith(`/${p}`) || p.endsWith(`/${ep}`);
        });
        if (!exists) {
          entries.push({ kind: "folder", path: p, label: p.split("/").pop() });
        }
      }

      for (const entry of entries) {
        try {
          addBrush(await parseBrushEntry(zip, entry, setName, JSZip));
        } catch {
          /* try next brush */
        }
      }
    } else if (lower.endsWith(".brush")) {
      addBrush(await parseBrushFromFolderZip(zip, "", setName));
    } else {
      throw new Error("Please choose a .brushset or .brush file from Procreate.");
    }
  } catch (err) {
    if (brushes.length === 0) {
      throw new Error(userFacingImportError(err));
    }
  }

  if (brushes.length === 0) {
    throw new Error(
      "No brushes could be imported from this pack. Brushes that only use Procreate built-in shapes may not include importable tip images — try a pack with custom shape PNGs, or re-export from Procreate.",
    );
  }

  return {
    id: `set-${slugify(setName)}-${Date.now()}`,
    name: setName,
    importedAt: Date.now(),
    brushes,
  };
}
