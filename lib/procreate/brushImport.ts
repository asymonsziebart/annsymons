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
  | { kind: "folder"; path: string }
  | { kind: "brush"; path: string };

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

function normalizeRoot(top: unknown): BplistRoot | null {
  if (!top || typeof top !== "object") return null;

  if ("$objects" in top && Array.isArray((top as BplistRoot).$objects)) {
    return top as BplistRoot;
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
    bytes.length >= 6 &&
    bytes[0] === 0x62 &&
    bytes[1] === 0x70 &&
    bytes[2] === 0x6c &&
    bytes[3] === 0x69 &&
    bytes[4] === 0x73 &&
    bytes[5] === 0x74
  );
}

/** plist treats all Uint8Array as binary — decode XML plists as text first. */
function parsePlistBytes(bytes: Uint8Array): unknown {
  if (isBinaryPlist(bytes)) {
    return parsePlist(bytes);
  }
  const text = new TextDecoder("utf-8").decode(bytes);
  return parsePlist(text);
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

async function pickTipImage(zip: ZipFile, prefix: string): Promise<string | undefined> {
  const candidates = [
    `${prefix}Shape.png`,
    `${prefix}Brushtip.png`,
    `${prefix}Stamp.png`,
    `${prefix}QuickLook/Thumbnail.png`,
    `${prefix}Preview.png`,
  ];
  for (const path of candidates) {
    const file = zip.file(path);
    if (!file) continue;
    const bytes = await file.async("uint8array");
    return bytesToDataUrl(bytes);
  }
  return undefined;
}

async function parseBrushFromFolderZip(
  zip: ZipFile,
  folderPath: string,
  setName: string,
  displayName?: string,
): Promise<BrushDef | null> {
  const prefix = folderPath ? `${folderPath}/` : "";
  const archiveFile = zip.file(`${prefix}Brush.archive`);
  const tipImage = await pickTipImage(zip, prefix);
  const label = displayName ?? (folderPath || "brush");

  if (!archiveFile) {
    return fallbackBrush(setName, label, tipImage);
  }

  try {
    const archiveBytes = await archiveFile.async("uint8array");
    const top = parsePlistBytes(archiveBytes);
    const root = normalizeRoot(top);
    if (root) {
      return mapProcreateToBrushDef(root, setName, label, tipImage);
    }
  } catch {
    /* fall through to thumbnail-only brush */
  }

  return fallbackBrush(setName, label, tipImage);
}

function discoverBrushEntries(zip: ZipFile): BrushEntry[] {
  const folders = new Set<string>();
  const brushFiles: string[] = [];

  zip.forEach((relPath: string) => {
    if (relPath.startsWith("__MACOSX/")) return;
    if (relPath.endsWith("Brush.archive")) {
      folders.add(relPath.replace(/\/?Brush\.archive$/, ""));
    } else if (/\.brush$/i.test(relPath)) {
      brushFiles.push(relPath);
    }
  });

  const entries: BrushEntry[] = brushFiles.map((path) => ({ kind: "brush", path }));
  for (const path of folders) {
    if (!brushFiles.some((b) => b.startsWith(`${path}/`) || b === `${path}.brush`)) {
      entries.push({ kind: "folder", path });
    }
  }
  return entries;
}

function readBrushPathsFromSetPlist(zip: ZipFile): Promise<string[]> {
  const plistFile = zip.file("brushset.plist");
  if (!plistFile) return Promise.resolve([]);

  return plistFile.async("uint8array").then((bytes: Uint8Array) => {
    const top = parsePlistBytes(bytes);
    if (!top || typeof top !== "object") return [];
    const root = normalizeRoot(top);
    const record = top as Record<string, unknown>;
    let val = record.brushes;
    if (root) val = deref(root, val);
    if (!Array.isArray(val)) return [];
    return val
      .map((item) => (root ? deref(root, item) : item))
      .filter((item): item is string => typeof item === "string");
  });
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

  if (lower.endsWith(".brushset")) {
    let plistPaths: string[] = [];
    try {
      plistPaths = await readBrushPathsFromSetPlist(zip);
    } catch {
      plistPaths = [];
    }

    const entries = discoverBrushEntries(zip);

    for (const p of plistPaths) {
      if (entries.some((e) => e.path === p || e.path.endsWith(`/${p}`))) continue;
      entries.push({ kind: "folder", path: p });
    }

    for (const entry of entries) {
      try {
        if (entry.kind === "folder") {
          addBrush(await parseBrushFromFolderZip(zip, entry.path, setName));
        } else {
          const innerFile = zip.file(entry.path);
          if (!innerFile) continue;
          const innerBytes = await innerFile.async("uint8array");
          const innerZip = await JSZip.loadAsync(innerBytes);
          const label = entry.path.replace(/\.brush$/i, "").split("/").pop() ?? entry.path;
          addBrush(await parseBrushFromFolderZip(innerZip, "", setName, label));
        }
      } catch {
        /* try next brush */
      }
    }
  } else if (lower.endsWith(".brush")) {
    addBrush(await parseBrushFromFolderZip(zip, "", setName));
  } else {
    throw new Error("Please choose a .brushset or .brush file from Procreate.");
  }

  if (brushes.length === 0) {
    throw new Error(
      "No brushes could be imported. Try re-exporting the set from Procreate, or use a pack with custom brush shapes.",
    );
  }

  return {
    id: `set-${slugify(setName)}-${Date.now()}`,
    name: setName,
    importedAt: Date.now(),
    brushes,
  };
}
