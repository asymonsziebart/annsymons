import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getManuals, upsertManual, type ManualDocument } from "@/lib/data/manuals";

function parseDocuments(value: unknown): ManualDocument[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const label = typeof row.label === "string" ? row.label.trim() : "";
      const url = typeof row.url === "string" ? row.url.trim() : "";
      if (!label || !url) return null;
      return { label, url };
    })
    .filter((doc): doc is ManualDocument => Boolean(doc));
}

export async function GET() {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const manuals = await getManuals();
    return NextResponse.json({ manuals });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load manuals" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const manual = await upsertManual({
      slug: typeof body.slug === "string" ? body.slug : null,
      name: typeof body.name === "string" ? body.name : "",
      brand: typeof body.brand === "string" ? body.brand : null,
      model: typeof body.model === "string" ? body.model : null,
      category: typeof body.category === "string" ? body.category : null,
      location: typeof body.location === "string" ? body.location : null,
      support_url: typeof body.support_url === "string" ? body.support_url : null,
      documents: parseDocuments(body.documents),
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    return NextResponse.json({ ok: true, manual });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save manual" },
      { status: 500 }
    );
  }
}
