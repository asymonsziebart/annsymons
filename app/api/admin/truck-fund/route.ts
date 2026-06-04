import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getTruckFundSettings, upsertTruckFundSettings } from "@/lib/data/truckFund";

export async function GET() {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const settings = await getTruckFundSettings();
    return NextResponse.json(settings);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const downPaymentSaved = Number(body.downPaymentSaved);
    const interestRatePercent = Number(body.interestRatePercent);
    const vehiclePrice = Number(body.vehiclePrice);
    const loanTermMonths = Number(body.loanTermMonths ?? 60);
    const imagePath = typeof body.imagePath === "string" ? body.imagePath : "";

    if (
      !Number.isFinite(downPaymentSaved) ||
      downPaymentSaved < 0 ||
      !Number.isFinite(interestRatePercent) ||
      interestRatePercent < 0 ||
      !Number.isFinite(vehiclePrice) ||
      vehiclePrice <= 0 ||
      !Number.isFinite(loanTermMonths) ||
      loanTermMonths < 1
    ) {
      return NextResponse.json({ error: "Invalid values" }, { status: 400 });
    }

    await upsertTruckFundSettings({
      downPaymentSaved,
      interestRatePercent,
      vehiclePrice,
      loanTermMonths,
      imagePath,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Failed to save";
    const hint = message.includes("truck_fund")
      ? " Run db/migrate-truck-fund.sql in Neon."
      : "";
    return NextResponse.json({ error: message + hint }, { status: 500 });
  }
}
