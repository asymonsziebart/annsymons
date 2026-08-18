import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";
import {
  deleteCard,
  getCard,
  normalizeCategory,
  updateCard,
  type CollectionCardInput,
} from "@/lib/data/collectionCards";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseBody(body: Record<string, unknown>): CollectionCardInput {
  return {
    category: normalizeCategory(body.category),
    name: typeof body.name === "string" ? body.name : "",
    setName: typeof body.setName === "string" ? body.setName : null,
    cardNumber: typeof body.cardNumber === "string" ? body.cardNumber : null,
    variant: typeof body.variant === "string" ? body.variant : null,
    condition: typeof body.condition === "string" ? body.condition : null,
    grader: typeof body.grader === "string" ? body.grader : null,
    grade: typeof body.grade === "string" ? body.grade : null,
    language: typeof body.language === "string" ? body.language : null,
    quantity: body.quantity == null ? 1 : Number(body.quantity),
    purchasePrice: body.purchasePrice == null ? null : Number(body.purchasePrice),
    acquiredOn: typeof body.acquiredOn === "string" ? body.acquiredOn : null,
    imagePath: typeof body.imagePath === "string" ? body.imagePath : null,
    notes: typeof body.notes === "string" ? body.notes : null,
  };
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
    return NextResponse.json({ card });
  } catch (error) {
    console.error("Failed to load collection card", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load card" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: Params) {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: raw } = await params;
    const id = parseId(raw);
    if (id == null) {
      return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
    }
    const body = (await request.json()) as Record<string, unknown>;
    const input = parseBody(body);
    if (!input.name.trim()) {
      return NextResponse.json({ error: "Card name is required." }, { status: 400 });
    }
    const card = await updateCard(id, input);
    if (!card) return NextResponse.json({ error: "Card not found." }, { status: 404 });
    return NextResponse.json({ ok: true, card });
  } catch (error) {
    console.error("Failed to update collection card", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update card" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: raw } = await params;
    const id = parseId(raw);
    if (id == null) {
      return NextResponse.json({ error: "Invalid card id." }, { status: 400 });
    }
    await deleteCard(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete collection card", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete card" },
      { status: 500 }
    );
  }
}
