import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";
import {
  addComp,
  getCard,
  listComps,
  recordSnapshot,
  replaceEbayComps,
  saveCardValuation,
  type CardCompInput,
} from "@/lib/data/collectionCards";
import { estimateFromComps } from "@/lib/collectionValue";
import { lookupEbayComps } from "@/lib/ebay";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function refreshValuation(cardId: number) {
  const comps = await listComps(cardId);
  const valuation = estimateFromComps(comps);
  const card = await saveCardValuation(cardId, valuation);
  if (card) await recordSnapshot(card.category);
  return { card, comps, valuation };
}

export async function GET(_request: Request, { params }: Params) {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: raw } = await params;
    const id = parseId(raw);
    if (id == null) {
      return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
    }
    const card = await getCard(id);
    if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });
    const comps = await listComps(id);
    return NextResponse.json({ card, comps });
  } catch (error) {
    console.error("Failed to load comps", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load comps" },
      { status: 500 }
    );
  }
}

/** Manual comp entry. */
export async function POST(request: Request, { params }: Params) {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: raw } = await params;
    const id = parseId(raw);
    if (id == null) {
      return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
    }
    const card = await getCard(id);
    if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });

    const body = (await request.json()) as Record<string, unknown>;
    const input: CardCompInput = {
      source: "manual",
      title: typeof body.title === "string" ? body.title : `${card.name} sold`,
      soldPrice: Number(body.soldPrice),
      currency: typeof body.currency === "string" ? body.currency : "USD",
      soldOn: typeof body.soldOn === "string" ? body.soldOn : null,
      conditionLabel:
        typeof body.conditionLabel === "string" ? body.conditionLabel : null,
      listingUrl: typeof body.listingUrl === "string" ? body.listingUrl : null,
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
    };

    const comp = await addComp(id, input);
    const refreshed = await refreshValuation(id);
    return NextResponse.json({ ok: true, comp, ...refreshed });
  } catch (error) {
    console.error("Failed to add manual comp", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add comp" },
      { status: 500 }
    );
  }
}

/** Pull fresh eBay comps and revalue the card. */
export async function PUT(_request: Request, { params }: Params) {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: raw } = await params;
    const id = parseId(raw);
    if (id == null) {
      return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
    }
    const card = await getCard(id);
    if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });

    const lookup = await lookupEbayComps(card);
    if (lookup.comps.length > 0) {
      await replaceEbayComps(id, lookup.comps);
    }

    const refreshed = await refreshValuation(id);
    return NextResponse.json({
      ok: true,
      mode: lookup.mode,
      query: lookup.query,
      message: lookup.message,
      ...refreshed,
    });
  } catch (error) {
    console.error("Failed to refresh eBay comps", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to refresh eBay comps",
      },
      { status: 500 }
    );
  }
}
