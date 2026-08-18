import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";
import {
  createCard,
  listCards,
  listSnapshots,
  normalizeCategory,
  type CollectionCardInput,
} from "@/lib/data/collectionCards";
import { portfolioTotals } from "@/lib/collectionValue";
import { isEbayConfigured } from "@/lib/ebay";

export const runtime = "nodejs";

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

export async function GET(request: Request) {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const category = normalizeCategory(searchParams.get("category") ?? "pokemon");
    const cards = await listCards(category);
    const snapshots = await listSnapshots(category);
    const totals = portfolioTotals(cards);

    return NextResponse.json({
      category,
      cards,
      snapshots,
      totals,
      ebayConfigured: isEbayConfigured(),
    });
  } catch (error) {
    console.error("Failed to load collection cards", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load collection cards. Check DATABASE_URL.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const input = parseBody(body);
    if (!input.name.trim()) {
      return NextResponse.json({ error: "Card name is required." }, { status: 400 });
    }
    const card = await createCard(input);
    return NextResponse.json({ ok: true, card });
  } catch (error) {
    console.error("Failed to create collection card", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create card" },
      { status: 500 }
    );
  }
}
