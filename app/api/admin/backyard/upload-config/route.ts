import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";

export async function GET() {
  const ok = await canUseAdminApi("/admin/backyard");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    useClientBlobUpload: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
  });
}
