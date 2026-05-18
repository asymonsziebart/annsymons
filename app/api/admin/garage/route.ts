import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getGarageBins, upsertGarageBin } from "@/lib/data/garage";

export async function GET() {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const bins = await getGarageBins();
    return NextResponse.json({ bins });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load garage bins" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const bin = await upsertGarageBin({
      bin_code: typeof body.bin_code === "string" ? body.bin_code : "",
      label: typeof body.label === "string" ? body.label : null,
      photo_path: typeof body.photo_path === "string" ? body.photo_path : null,
      inventory_text: typeof body.inventory_text === "string" ? body.inventory_text : "",
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    return NextResponse.json({ ok: true, bin });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save garage bin" },
      { status: 500 }
    );
  }
}
