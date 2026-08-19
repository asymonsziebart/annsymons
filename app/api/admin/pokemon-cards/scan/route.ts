import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";
import {
  absoluteImageUrl,
  enrichPokemonFromTcgApi,
  parseVisionScanJson,
  scanPromptForCategory,
  type CardScanResult,
  type ScannedCardFields,
} from "@/lib/cardScan";
import { normalizeCategory } from "@/lib/collectionCardsShared";

export const runtime = "nodejs";

type OpenAIContent = {
  type: "input_text" | "input_image";
  text?: string;
  image_url?: string;
};

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

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
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
          "Card scanning needs OPENAI_API_KEY on the server. You can still upload a photo and type details by hand.",
      };
      return NextResponse.json({ ok: true, imagePath, card: result });
    }

    const imageUrl = absoluteImageUrl(request, imagePath);
    const content: OpenAIContent[] = [
      { type: "input_text", text: scanPromptForCategory(category) },
      { type: "input_image", image_url: imageUrl },
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
        input: [{ role: "user", content }],
        max_output_tokens: 400,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        { error: `Card scan failed: ${detail.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const data = (await response.json()) as { output_text?: string };
    const parsed = parseVisionScanJson(data.output_text ?? "");

    let fields: ScannedCardFields = parsed;
    let matchedFromCatalog = false;
    if (category === "pokemon") {
      const enriched = await enrichPokemonFromTcgApi(parsed);
      fields = enriched.fields;
      matchedFromCatalog = enriched.matched;
    }

    const result: CardScanResult = {
      configured: true,
      matchedFromCatalog,
      confidence: parsed.confidence,
      ...fields,
      message: matchedFromCatalog
        ? "Matched against the Pokemon TCG catalog — review and save."
        : "Read from photo — review the fields before saving.",
    };

    return NextResponse.json({ ok: true, imagePath, card: result });
  } catch (error) {
    console.error("Card scan failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Card scan failed" },
      { status: 500 }
    );
  }
}
