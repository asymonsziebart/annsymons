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

type UidRef = { uid: number };

function isUid(v: unknown): v is UidRef {
  return !!v && typeof v === "object" && "uid" in v && typeof (v as UidRef).uid === "number";
}

function deref(root: BplistRoot, val: unknown): unknown {
  if (isUid(val)) return root.$objects[val.uid];
  return val;
}

function loadSetting(root: BplistRoot, key: string): unknown {
  const settings = root.$objects[1] as Record<string, unknown> | undefined;
  if (!settings) return undefined;
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

function bufferToDataUrl(buf: Buffer, mime = "image/png"): string {
  return `data:${mime};base64,${buf.toString("base64")}`;
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

async function pickTipImage(
  zip: ZipFile,
  prefix: string,
): Promise<string | undefined> {
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
    const buf = await file.async("nodebuffer");
    return bufferToDataUrl(buf);
  }
  return undefined;
}

async function parseBrushArchive(
  zip: ZipFile,
  brushPath: string,
  setName: string,
  bplist: { parseBuffer: (buf: Buffer) => unknown[] },
): Promise<BrushDef | null> {
  const prefix = brushPath ? `${brushPath}/` : "";
  const archiveFile = zip.file(`${prefix}Brush.archive`);
  if (!archiveFile) return null;

  const archiveBytes = await archiveFile.async("nodebuffer");
  const parsed = bplist.parseBuffer(archiveBytes);
  const root = parsed[0] as BplistRoot;
  if (!root?.$objects) return null;

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

export async function importProcreateBrushBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<ImportedBrushSet> {
  const JSZip = (await import("jszip")).default;
  const bplist = await import("bplist-parser");

  const zip = await JSZip.loadAsync(buffer);
  const setName = fileName.replace(/\.(brushset|brush)$/i, "") || "Imported Brushes";
  const brushes: BrushDef[] = [];
  const lower = fileName.toLowerCase();

  if (lower.endsWith(".brushset")) {
    let paths: string[] = [];
    const plistFile = zip.file("brushset.plist");
    if (plistFile) {
      const plistBytes = await plistFile.async("nodebuffer");
      const [plistRoot] = bplist.parseBuffer(plistBytes) as [Record<string, unknown>];
      const raw = plistRoot?.brushes;
      if (Array.isArray(raw)) {
        paths = raw.filter((p): p is string => typeof p === "string");
      }
    }
    if (paths.length === 0) paths = discoverBrushPaths(zip);

    for (const brushPath of paths) {
      const brush = await parseBrushArchive(zip, brushPath, setName, bplist);
      if (brush) brushes.push(brush);
    }
  } else if (lower.endsWith(".brush")) {
    const brush = await parseBrushArchive(zip, "", setName, bplist);
    if (brush) brushes.push(brush);
  } else {
    throw new Error("Please upload a .brushset or .brush file from Procreate.");
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
