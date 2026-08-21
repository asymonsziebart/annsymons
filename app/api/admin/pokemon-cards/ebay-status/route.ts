import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";
import { checkEbayConnection } from "@/lib/ebay";

export const runtime = "nodejs";

/** Diagnoses eBay credentials so key problems can be told apart from lookup misses. */
export async function GET() {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const check = await checkEbayConnection();
    return NextResponse.json(check);
  } catch (error) {
    console.error("Failed to check eBay connection", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to check eBay connection",
      },
      { status: 500 }
    );
  }
}
