import type {
  CardScanResult,
  CollectionCategory,
  ScannedCardFields,
} from "@/lib/collectionCardsShared";

export type { CardScanResult, ScannedCardFields };

const CONDITION_VALUES = [
  "Sealed",
  "Mint",
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged",
] as const;

function text(value: unknown, max = 200): string | null {
  // Models often return numbers for fields like grade or collector number.
  const raw =
    typeof value === "string"
      ? value
      : typeof value === "number" && Number.isFinite(value)
        ? String(value)
        : null;
  if (raw == null) return null;
  const trimmed = raw.trim().slice(0, max);
  if (!trimmed) return null;
  // "null"/"unknown"/"n/a" come back as strings surprisingly often.
  if (/^(null|none|n\/a|na|unknown|not visible|not specified|-{1,2})$/i.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/** Vision models wrap the answer in a container key more often than not. */
function unwrapCardObject(parsed: Record<string, unknown>): Record<string, unknown> {
  const WRAPPERS = [
    "card",
    "cardInfo",
    "card_info",
    "cardDetails",
    "card_details",
    "data",
    "result",
    "response",
    "output",
    "fields",
    "pokemon",
  ];
  for (const key of WRAPPERS) {
    const inner = parsed[key];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return inner as Record<string, unknown>;
    }
  }
  // A single unrecognised key holding an object is still a wrapper.
  const keys = Object.keys(parsed);
  if (keys.length === 1) {
    const inner = parsed[keys[0]!];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return inner as Record<string, unknown>;
    }
  }
  return parsed;
}

/** Reads the first present key, so alternate field names still resolve. */
function pick(
  source: Record<string, unknown>,
  keys: string[],
  max = 200
): string | null {
  for (const key of keys) {
    const found = text(source[key], max);
    if (found) return found;
  }
  return null;
}

function normalizeCondition(value: unknown): string | null {
  const raw = text(value, 50);
  if (!raw) return null;
  const lower = raw.toLowerCase();
  for (const option of CONDITION_VALUES) {
    if (lower === option.toLowerCase()) return option;
  }
  if (lower.includes("near mint") || lower === "nm") return "Near Mint";
  if (lower.includes("light") && lower.includes("play")) return "Lightly Played";
  if (lower.includes("moderate")) return "Moderately Played";
  if (lower.includes("heavy")) return "Heavily Played";
  if (lower.includes("mint")) return "Mint";
  if (lower.includes("damage")) return "Damaged";
  if (lower.includes("sealed")) return "Sealed";
  return raw;
}

export function scanPromptForCategory(category: CollectionCategory): string {
  const kind =
    category === "pokemon"
      ? "Pokemon TCG"
      : category === "magic"
        ? "Magic: The Gathering"
        : "LEGO trading/collectible card or minifig card";

  return (
    `You are cataloguing a ${kind} card from a photo. Read the card face: ` +
    `Pokemon name/title, set name, collector number (e.g. 4/102), variant ` +
    `(Holo, Reverse Holo, 1st Edition, Full Art, etc.), visible grade slab label if graded, ` +
    `and estimate condition from edges/centering/surface if raw. ` +
    `Return ONLY valid JSON (no markdown) with keys: ` +
    `name (string, required), setName, cardNumber, variant, condition, grader, grade, language, confidence (low|medium|high). ` +
    `Use null for unknown fields.`
  );
}

export function parseVisionScanJson(raw: string): ScannedCardFields & { confidence: string | null } {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;
  const objectMatch = candidate.match(/\{[\s\S]*\}/);
  const jsonText = objectMatch ? objectMatch[0] : candidate;

  // Surface what the model said, otherwise a chatty reply is impossible to debug.
  const unreadable = () =>
    new Error(
      `The AI didn't return card details. It said: "${trimmed.slice(0, 90) || "(nothing)"}" — try a clearer, well-lit photo.`
    );

  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(jsonText);
  } catch {
    throw unreadable();
  }

  // Some models answer with an array containing one card object.
  const asObject = Array.isArray(parsedRaw) ? parsedRaw[0] : parsedRaw;
  if (!asObject || typeof asObject !== "object") {
    throw unreadable();
  }

  const card = unwrapCardObject(asObject as Record<string, unknown>);

  const name = pick(card, [
    "name",
    "cardName",
    "card_name",
    "pokemonName",
    "pokemon_name",
    "pokemon",
    "title",
  ]);
  if (!name) {
    throw new Error("Could not find a card name in the photo. Center the card and try again.");
  }

  return {
    name,
    setName: pick(card, [
      "setName",
      "set_name",
      "set",
      "setTitle",
      "expansion",
      "series",
    ]),
    cardNumber: pick(
      card,
      [
        "cardNumber",
        "card_number",
        "number",
        "collectorNumber",
        "collector_number",
        "cardNo",
        "no",
      ],
      50
    ),
    variant: pick(card, ["variant", "rarity", "edition", "holo", "finish"], 100),
    condition: normalizeCondition(
      card.condition ?? card.cardCondition ?? card.card_condition
    ),
    grader: pick(
      card,
      ["grader", "gradingCompany", "grading_company", "gradeCompany"],
      20
    ),
    grade: pick(card, ["grade", "gradeValue", "grade_value"], 10),
    language: pick(card, ["language", "lang"], 50) ?? "English",
    confidence: pick(card, ["confidence", "certainty"], 20),
  };
}

type TcgCard = {
  name?: string;
  number?: string;
  set?: { name?: string };
  rarity?: string;
};

/** Best-effort match against the public Pokemon TCG API to normalize set/number. */
export async function enrichPokemonFromTcgApi(
  fields: ScannedCardFields
): Promise<{ fields: ScannedCardFields; matched: boolean }> {
  if (!fields.name.trim()) return { fields, matched: false };

  const parts = [`name:"${fields.name.replace(/"/g, "")}"`];
  if (fields.setName) {
    parts.push(`set.name:"${fields.setName.replace(/"/g, "")}"`);
  }
  if (fields.cardNumber) {
    const num = fields.cardNumber.split("/")[0]?.trim();
    if (num) parts.push(`number:${num}`);
  }

  const params = new URLSearchParams({
    q: parts.join(" "),
    pageSize: "5",
    select: "name,number,set,rarity",
  });

  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.POKEMON_TCG_API_KEY?.trim();
  if (apiKey) headers["X-Api-Key"] = apiKey;

  const res = await fetch(`https://api.pokemontcg.io/v2/cards?${params}`, {
    headers,
    cache: "no-store",
  });

  if (!res.ok) return { fields, matched: false };

  const data = (await res.json()) as { data?: TcgCard[] };
  const match = data.data?.[0];
  if (!match) return { fields, matched: false };

  return {
    matched: true,
    fields: {
      ...fields,
      name: match.name ?? fields.name,
      setName: match.set?.name ?? fields.setName,
      cardNumber: match.number ?? fields.cardNumber,
      variant: fields.variant ?? (match.rarity ? match.rarity : null),
    },
  };
}

export function absoluteImageUrl(request: Request, photoPath: string): string {
  if (/^https?:\/\//i.test(photoPath)) return photoPath;
  const origin = new URL(request.url).origin;
  const path = photoPath.startsWith("/") ? photoPath : `/${photoPath}`;
  return `${origin}${path}`;
}
