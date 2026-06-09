import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import {
  createBackyardPhoto,
  createPlantPin,
  getBackyardData,
} from "@/lib/data/backyard";

export async function GET() {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = await getBackyardData();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load backyard data" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";

    if (action === "photo") {
      const photo = await createBackyardPhoto({
        title: typeof body.title === "string" ? body.title : null,
        photo_path: typeof body.photo_path === "string" ? body.photo_path : "",
      });
      return NextResponse.json({ ok: true, photo });
    }

    if (action === "pin") {
      const pin = await createPlantPin({
        photo_id: Number(body.photo_id),
        x_pct: Number(body.x_pct),
        y_pct: Number(body.y_pct),
        plant_name: typeof body.plant_name === "string" ? body.plant_name : "",
        common_name: typeof body.common_name === "string" ? body.common_name : null,
        species: typeof body.species === "string" ? body.species : null,
        planted_year:
          body.planted_year == null || body.planted_year === ""
            ? null
            : Number(body.planted_year),
        notes: typeof body.notes === "string" ? body.notes : null,
      });
      return NextResponse.json({ ok: true, pin });
    }

    return NextResponse.json({ error: "Invalid action. Use action: photo or pin." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save backyard data" },
      { status: 500 }
    );
  }
}
