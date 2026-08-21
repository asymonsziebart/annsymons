import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";
import { absoluteImageUrl, enrichPokemonFromTcgApi } from "@/lib/cardScan";
import {
  ollamaVisionModel,
  preferredVisionProvider,
  scanCardWithOllama,
  scanCardWithOpenAI,
} from "@/lib/cardScanVision";
import { normalizeCategory, type CardScanResult } from "@/lib/collectionCardsShared";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const imagePath = typeof body.imagePath === "string" ? body.imagePath.trim() : "";
    const category = normalizeCategory(body.category);

    if (!imagePath) {
      return NextResponse.json({ error: "Upload or capture a card photo first." }, { status: 400 });
    }

    const provider = preferredVisionProvider();
    if (!provider) {
      const result: CardScanResult = {
        configured: false,
        matchedFromCatalog: false,
        confidence: null,
        name: "",
        setName: null,
        cardNumber: null,
        variant: null,
        condition: null,
        grader: null,
        grade: null,
        language: null,
        message:
          "Card scanning needs Ollama locally (qwen2.5vl:7b) or OPENAI_API_KEY. You can still upload a photo and type details by hand.",
      };
      return NextResponse.json({ ok: true, imagePath, card: result });
    }

    const parsed =
      provider === "ollama"
        ? await scanCardWithOllama(imagePath, category)
        : await scanCardWithOpenAI(absoluteImageUrl(request, imagePath), category);

    let fields: typeof parsed = parsed;
    let matchedFromCatalog = false;
    if (category === "pokemon") {
      const enriched = await enrichPokemonFromTcgApi(parsed);
      fields = { ...parsed, ...enriched.fields };
      matchedFromCatalog = enriched.matched;
    }

    const modelNote =
      provider === "ollama" ? ` via ${ollamaVisionModel()}` : " via OpenAI";
    const result: CardScanResult = {
      configured: true,
      matchedFromCatalog,
      ...fields,
      message: matchedFromCatalog
        ? `Matched against the Pokemon TCG catalog${modelNote} — review and save.`
        : `Read from photo${modelNote} — review the fields before saving.`,
    };

    return NextResponse.json({ ok: true, imagePath, card: result });
  } catch (error) {
    console.error("Card scan failed", error);
    const raw = error instanceof Error ? error.message : "Card scan failed";
    const message =
      /ECONNREFUSED|fetch failed/i.test(raw)
        ? "Could not reach Ollama at http://127.0.0.1:11434. Start Ollama, then run: ollama pull qwen2.5vl:7b"
        : raw;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
