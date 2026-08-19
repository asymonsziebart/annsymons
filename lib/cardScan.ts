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
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed ? trimmed : null;
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
  const jsonText = fenced ? fenced[1]!.trim() : trimmed;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    throw new Error("Could not read card details from the photo. Try a clearer, well-lit shot.");
  }

  const name = text(parsed.name, 200);
  if (!name) {
    throw new Error("Could not find a card name in the photo. Center the card and try again.");
  }

  return {
    name,
    setName: text(parsed.setName, 200),
    cardNumber: text(parsed.cardNumber, 50),
    variant: text(parsed.variant, 100),
    condition: normalizeCondition(parsed.condition),
    grader: text(parsed.grader, 20),
    grade: text(parsed.grade, 10),
    language: text(parsed.language, 50) ?? "English",
    confidence: text(parsed.confidence, 20),
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
