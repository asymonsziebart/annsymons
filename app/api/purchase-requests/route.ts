import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createPurchaseRequest } from "@/lib/data/purchaseRequests";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const itemName = typeof body.itemName === "string" ? body.itemName : "";
    const details = typeof body.details === "string" ? body.details : "";
    const requestedBy = typeof body.requestedBy === "string" ? body.requestedBy : "";

    const row = await createPurchaseRequest({ itemName, details, requestedBy });
    revalidatePath("/admin/requests");
    revalidatePath("/admin");
    return NextResponse.json({ ok: true, request: row }, { status: 201 });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Failed to submit request";
    const hint = message.includes("purchase_requests")
      ? " Run db/create-purchase-requests.sql in the database."
      : "";
    return NextResponse.json({ error: message + hint }, { status: 400 });
  }
}
