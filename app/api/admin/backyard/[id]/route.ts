import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";
import {
  deleteBackyardPhoto,
  deletePlantPin,
  updatePlantPin,
} from "@/lib/data/backyard";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await canUseAdminApi("/admin/backyard");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idText } = await params;
  const id = Number(idText);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const pin = await updatePlantPin(id, {
      plant_name: typeof body.plant_name === "string" ? body.plant_name : undefined,
      common_name: typeof body.common_name === "string" ? body.common_name : body.common_name === null ? null : undefined,
      species: typeof body.species === "string" ? body.species : body.species === null ? null : undefined,
      planted_year:
        body.planted_year === null || body.planted_year === ""
          ? null
          : body.planted_year !== undefined
          ? Number(body.planted_year)
          : undefined,
      notes: typeof body.notes === "string" ? body.notes : body.notes === null ? null : undefined,
      x_pct: body.x_pct !== undefined ? Number(body.x_pct) : undefined,
      y_pct: body.y_pct !== undefined ? Number(body.y_pct) : undefined,
    });
    revalidatePath("/admin/backyard");
    return NextResponse.json({ ok: true, pin });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update plant pin" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await canUseAdminApi("/admin/backyard");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idText } = await params;
  const id = Number(idText);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "pin";

  try {
    if (kind === "photo") {
      await deleteBackyardPhoto(id);
    } else {
      await deletePlantPin(id);
    }
    revalidatePath("/admin/backyard");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
