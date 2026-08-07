import JSZip from "jszip";
import type {
  FamilyTreeData,
  FamilyTreeDate,
  FamilyTreeFamily,
  FamilyTreePerson,
} from "@/lib/familyTree/types";

function parseDate(
  flagRaw: string | undefined,
  yearRaw: string | undefined,
  monthRaw: string | undefined,
  dayRaw: string | undefined
): FamilyTreeDate | null {
  const year = Number.parseInt(yearRaw || "0", 10);
  if (!Number.isFinite(year) || year <= 0) return null;
  const flag = Number.parseInt(flagRaw || "0", 10);
  const month = Number.parseInt(monthRaw || "0", 10);
  const day = Number.parseInt(dayRaw || "0", 10);
  return {
    year,
    month: month > 0 ? month : null,
    day: day > 0 ? day : null,
    known: flag === 128 || year > 0,
  };
}

function parseGender(codeRaw: string | undefined): FamilyTreePerson["gender"] {
  const code = Number.parseInt(codeRaw || "0", 10);
  if (code === 1) return "male";
  if (code === 2) return "female";
  return "unknown";
}

function personDisplayName(person: FamilyTreePerson): string {
  return [person.given, person.middle, person.surname].filter(Boolean).join(" ").trim();
}

function pickDefaultFocusId(people: FamilyTreePerson[]): string | null {
  const preferred = people.find((p) => {
    const name = personDisplayName(p).toLowerCase();
    return name === "ann krause" || name === "ann symons";
  });
  if (preferred) return preferred.id;
  const withCoords = people.find((p) => p.x !== 0 || p.y !== 0);
  return withCoords?.id ?? people[0]?.id ?? null;
}

/** Parse Quick Family Tree / Digital Gene `node.ftt` TSV text. */
export function parseFttText(raw: string, sourceFilename: string | null = null): FamilyTreeData {
  const text = raw.replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length < 2) {
    throw new Error("Family tree file is empty.");
  }

  const people: FamilyTreePerson[] = [];
  const families: FamilyTreeFamily[] = [];

  for (const line of lines.slice(1)) {
    const cols = line.split("\t");
    if (cols.length === 12) {
      families.push({
        id: cols[0],
        partner1Id: cols[2] && cols[2] !== "0" ? cols[2] : null,
        partner2Id: cols[4] && cols[4] !== "0" ? cols[4] : null,
        x: Number.parseFloat(cols[6] || "0") || 0,
        y: Number.parseFloat(cols[7] || "0") || 0,
      });
      continue;
    }

    if (cols.length < 25) continue;

    people.push({
      id: cols[0],
      familyId: cols[2] && cols[2] !== "0" ? cols[2] : null,
      siblingOrder: Number.parseInt(cols[3] || "0", 10) || 0,
      x: Number.parseFloat(cols[6] || "0") || 0,
      y: Number.parseFloat(cols[7] || "0") || 0,
      surname: (cols[12] || "").trim(),
      given: (cols[13] || "").trim(),
      middle: (cols[14] || "").trim() || null,
      birth: parseDate(cols[16], cols[17], cols[18], cols[19]),
      death: parseDate(cols[20], cols[21], cols[22], cols[23]),
      gender: parseGender(cols[24]),
    });
  }

  // Drop unnamed placeholder people with no relationships (noise rows).
  const familyPartnerIds = new Set<string>();
  for (const family of families) {
    if (family.partner1Id) familyPartnerIds.add(family.partner1Id);
    if (family.partner2Id) familyPartnerIds.add(family.partner2Id);
  }
  const childFamilyIds = new Set(
    people.filter((p) => p.familyId).map((p) => p.familyId as string)
  );

  const cleanedPeople = people.filter((person) => {
    const named = Boolean(person.given || person.surname);
    if (named) return true;
    if (familyPartnerIds.has(person.id)) return true;
    if (person.familyId && childFamilyIds.has(person.familyId)) return true;
    return false;
  });

  if (cleanedPeople.length === 0) {
    throw new Error("No people found in family tree file.");
  }

  return {
    name: "Family Tree",
    sourceFilename,
    defaultFocusId: pickDefaultFocusId(cleanedPeople),
    people: cleanedPeople,
    families,
  };
}

function asUint8Array(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  if (bytes instanceof Uint8Array) return bytes;
  return new Uint8Array(bytes);
}

/** Load a Quick Family Tree `.ftz` (zip) or `.ftt` export into structured data. */
export async function parseFamilyTreeFile(
  bytes: ArrayBuffer | Uint8Array,
  filename: string
): Promise<FamilyTreeData> {
  const lower = filename.toLowerCase();
  const data = asUint8Array(bytes);

  if (lower.endsWith(".ftt")) {
    const text = new TextDecoder("utf-8").decode(data);
    return parseFttText(text, filename);
  }

  if (!lower.endsWith(".ftz") && !lower.endsWith(".zip")) {
    throw new Error("Upload a FamilyTree.ftz (or .ftt) export from your family tree app.");
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(data);
  } catch {
    throw new Error("Could not read that file. Make sure it is a valid .ftz export.");
  }

  const fttEntry =
    zip.file(/node\.ftt$/i)[0] ||
    Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(".ftt"));

  if (!fttEntry) {
    throw new Error("No node.ftt found inside the .ftz archive.");
  }

  const text = await fttEntry.async("string");
  return parseFttText(text, filename);
}
