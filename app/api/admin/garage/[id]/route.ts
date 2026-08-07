import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";
import { deleteGarageBin } from "@/lib/data/garage";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await canUseAdminApi("/admin/garage");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: idText } = await params;
  const id = Number(idText);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid garage bin id" }, { status: 400 });
  }
  try {
    await deleteGarageBin(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete garage bin" },
      { status: 500 }
    );
  }
}
