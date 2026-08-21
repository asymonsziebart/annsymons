import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";
import {
  createCard,
  listCards,
  listSnapshots,
  normalizeCategory,
  recordSnapshot,
} from "@/lib/data/collectionCards";
import { portfolioTotals } from "@/lib/collectionValue";
import { sampleCardKey, sampleCardsFor } from "@/lib/collectionSampleCards";

export const runtime = "nodejs";

/** Fills an empty collection with real card names so eBay lookups can be tested. */
export async function POST(request: Request) {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const category = normalizeCategory(body.category ?? "pokemon");

    const existing = await listCards(category);
    const existingKeys = new Set(existing.map(sampleCardKey));

    let added = 0;
    for (const sample of sampleCardsFor(category)) {
      if (existingKeys.has(sampleCardKey(sample))) continue;
      await createCard({ ...sample, category });
      added += 1;
    }

    if (added > 0) await recordSnapshot(category);

    const cards = await listCards(category);
    const snapshots = await listSnapshots(category);

    return NextResponse.json({
      ok: true,
      category,
      added,
      cards,
      snapshots,
      totals: portfolioTotals(cards),
      message:
        added > 0
          ? `Added ${added} sample card${added === 1 ? "" : "s"}. Tap Revalue collection to price them from eBay.`
          : "Sample cards are already in this collection.",
    });
  } catch (error) {
    console.error("Failed to add sample cards", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to add sample cards",
      },
      { status: 500 }
    );
  }
}
