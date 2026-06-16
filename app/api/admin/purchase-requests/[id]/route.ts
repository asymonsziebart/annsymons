import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import {
  decidePurchaseRequest,
  normalizePurchaseRequestStatus,
} from "@/lib/data/purchaseRequests";

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id: rawId } = await params;
    const id = Number(rawId);
    const body = (await request.json()) as Record<string, unknown>;
    const status = normalizePurchaseRequestStatus(body.status);
    const decisionReason =
      typeof body.decisionReason === "string" ? body.decisionReason : "";

    const row = await decidePurchaseRequest(id, { status, decisionReason });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    revalidatePath("/admin/requests");
    revalidatePath("/admin");
    return NextResponse.json({ ok: true, request: row });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Failed to update request";
    const hint = message.includes("purchase_requests")
      ? " Run db/create-purchase-requests.sql in the database."
      : "";
    return NextResponse.json({ error: message + hint }, { status: 500 });
  }
}
