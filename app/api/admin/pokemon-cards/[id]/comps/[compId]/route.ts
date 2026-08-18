import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";
import {
  deleteComp,
  getCard,
  listComps,
  recordSnapshot,
  saveCardValuation,
  setCompExcluded,
} from "@/lib/data/collectionCards";
import { estimateFromComps } from "@/lib/collectionValue";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string; compId: string }> };

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

export async function PATCH(request: Request, { params }: Params) {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: rawCard, compId: rawComp } = await params;
    const cardId = parseId(rawCard);
    const compId = parseId(rawComp);
    if (cardId == null || compId == null) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const isExcluded = Boolean(body.isExcluded);
    const ownerId = await setCompExcluded(compId, isExcluded);
    if (ownerId == null || ownerId !== cardId) {
      return NextResponse.json({ error: "Comp not found." }, { status: 404 });
    }

    const refreshed = await refreshValuation(cardId);
    return NextResponse.json({ ok: true, ...refreshed });
  } catch (error) {
    console.error("Failed to update comp", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update comp" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: rawCard, compId: rawComp } = await params;
    const cardId = parseId(rawCard);
    const compId = parseId(rawComp);
    if (cardId == null || compId == null) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }

    const ownerId = await deleteComp(compId);
    if (ownerId == null || ownerId !== cardId) {
      return NextResponse.json({ error: "Comp not found." }, { status: 404 });
    }

    // Keep getCard available for snapshot category even if deleted somehow.
    const existing = await getCard(cardId);
    const refreshed = await refreshValuation(cardId);
    if (!refreshed.card && existing) {
      await recordSnapshot(existing.category);
    }
    return NextResponse.json({ ok: true, ...refreshed });
  } catch (error) {
    console.error("Failed to delete comp", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete comp" },
      { status: 500 }
    );
  }
}
