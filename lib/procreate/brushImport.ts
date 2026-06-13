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

function normalizeRoot(parsed: unknown[]): BplistRoot | null {
  const top = parsed[0];
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

function mapProcreateToBrushDef(
  root: BplistRoot,
  setName: string,
  brushPath: string,
  tipImage?: string,
): BrushDef {
  const name = loadString(root, "name", brushPath.split("/").pop() ?? "Imported Brush");
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

  const id = `imported-${slugify(setName)}-${slugify(name)}-${brushPath.replace(/\//g, "-")}`;

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

async function parseBrushArchive(
  zip: ZipFile,
  brushPath: string,
  setName: string,
  parseBuffer: (buf: Uint8Array) => unknown[],
): Promise<BrushDef | null> {
  const prefix = brushPath ? `${brushPath}/` : "";
  const archiveFile = zip.file(`${prefix}Brush.archive`);
  if (!archiveFile) return null;

  const archiveBytes = await archiveFile.async("uint8array");
  const parsed = parseBuffer(archiveBytes);
  const root = normalizeRoot(parsed);
  if (!root) return null;

  const tipImage = await pickTipImage(zip, prefix);
  return mapProcreateToBrushDef(root, setName, brushPath || "brush", tipImage);
}

function discoverBrushPaths(zip: ZipFile): string[] {
  const discovered = new Set<string>();
  zip.forEach((relPath: string) => {
    if (relPath.endsWith("Brush.archive")) {
      discovered.add(relPath.replace(/\/Brush\.archive$/, ""));
    }
  });
  return [...discovered];
}

function resolveBrushPaths(raw: unknown, root: BplistRoot | null): string[] {
  let val = raw;
  if (root) val = deref(root, val);
  if (!Array.isArray(val)) return [];
  const paths: string[] = [];
  for (const item of val) {
    const resolved = root ? deref(root, item) : item;
    if (typeof resolved === "string") paths.push(resolved);
  }
  return paths;
}

/** Parse a Procreate .brushset or .brush file entirely in the browser (no upload). */
export async function importProcreateBrushFile(file: File): Promise<ImportedBrushSet> {
  const JSZip = (await import("jszip")).default;
  const bplist = await import("bplist-parser");

  const zip = await JSZip.loadAsync(file);
  const setName = file.name.replace(/\.(brushset|brush)$/i, "") || "Imported Brushes";
  const brushes: BrushDef[] = [];
  const lower = file.name.toLowerCase();
  const parseBuffer = (buf: Uint8Array) => bplist.parseBuffer(buf as unknown as Buffer);

  if (lower.endsWith(".brushset")) {
    let paths: string[] = [];
    const plistFile = zip.file("brushset.plist");
    if (plistFile) {
      const plistBytes = await plistFile.async("uint8array");
      const parsed = parseBuffer(plistBytes);
      const root = normalizeRoot(parsed);
      const plistRoot = parsed[0] as Record<string, unknown> | undefined;
      paths = resolveBrushPaths(plistRoot?.brushes, root);
    }
    if (paths.length === 0) paths = discoverBrushPaths(zip);

    for (const brushPath of paths) {
      const brush = await parseBrushArchive(zip, brushPath, setName, parseBuffer);
      if (brush) brushes.push(brush);
    }
  } else if (lower.endsWith(".brush")) {
    const brush = await parseBrushArchive(zip, "", setName, parseBuffer);
    if (brush) brushes.push(brush);
  } else {
    throw new Error("Please choose a .brushset or .brush file from Procreate.");
  }

  if (brushes.length === 0) {
    throw new Error(
      "No brushes found. Brushes that only use Procreate built-in shapes cannot be exported.",
    );
  }

  return {
    id: `set-${slugify(setName)}-${Date.now()}`,
    name: setName,
    importedAt: Date.now(),
    brushes,
  };
}
