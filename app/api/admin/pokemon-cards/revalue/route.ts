import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";
import {
  getCard,
  listCards,
  listComps,
  normalizeCategory,
  recordSnapshot,
  replaceEbayComps,
  saveCardValuation,
} from "@/lib/data/collectionCards";
import { estimateFromComps, portfolioTotals } from "@/lib/collectionValue";
import { lookupEbayComps } from "@/lib/ebay";

export const runtime = "nodejs";

/**
 * Revalue every card in a category from eBay (or from stored comps if eBay
 * isn't configured). Caps at 40 cards per request to stay within serverless
 * time limits — re-run for larger collections.
 */
export async function POST(request: Request) {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const category = normalizeCategory(body.category ?? "pokemon");
    const cards = await listCards(category);
    const limit = Math.min(cards.length, 40);
    let updated = 0;
    const messages: string[] = [];

    for (let i = 0; i < limit; i++) {
      const card = cards[i]!;
      const lookup = await lookupEbayComps(card);
      if (lookup.message && messages.length < 3) messages.push(lookup.message);
      if (lookup.comps.length > 0) {
        await replaceEbayComps(card.id, lookup.comps);
      }
      const comps = await listComps(card.id);
      const valuation = estimateFromComps(comps);
      await saveCardValuation(card.id, valuation);
      updated += 1;
    }

    await recordSnapshot(category);
    const refreshed = await listCards(category);
    const totals = portfolioTotals(refreshed);

    return NextResponse.json({
      ok: true,
      category,
      updated,
      total: cards.length,
      truncated: cards.length > limit,
      messages,
      cards: refreshed,
      totals,
    });
  } catch (error) {
    console.error("Failed to revalue collection", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to revalue collection",
      },
      { status: 500 }
    );
  }
}

/** Revalue a single card without hitting eBay — uses stored comps only. */
export async function PUT(request: Request) {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = Number(body.cardId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "cardId is required." }, { status: 400 });
    }
    const card = await getCard(id);
    if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });

    const comps = await listComps(id);
    const valuation = estimateFromComps(comps);
    const updated = await saveCardValuation(id, valuation);
    if (updated) await recordSnapshot(updated.category);
    return NextResponse.json({ ok: true, card: updated, comps, valuation });
  } catch (error) {
    console.error("Failed to revalue card", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revalue card" },
      { status: 500 }
    );
  }
}
