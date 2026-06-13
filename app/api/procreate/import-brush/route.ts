import { NextResponse } from "next/server";
import { importProcreateBrushBuffer } from "@/lib/procreate/brushImport";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    if (!name.endsWith(".brushset") && !name.endsWith(".brush")) {
      return NextResponse.json(
        { error: "File must be a .brushset or .brush from Procreate" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const set = await importProcreateBrushBuffer(buffer, file.name);
    return NextResponse.json(set);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
