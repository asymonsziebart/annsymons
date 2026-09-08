import { NextResponse } from "next/server";
import { sendLawnWateringReminder } from "@/lib/email/sendLawnWateringReminder";
import { getLawnWateringAssessment } from "@/lib/lawnWatering";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Daily Vercel Cron check for Sterling Heights lawn-watering conditions.
 * Vercel supplies `Authorization: Bearer CRON_SECRET` for cron requests.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const assessment = await getLawnWateringAssessment();
    if (!assessment.shouldRemind) {
      return NextResponse.json({
        ok: true,
        sent: false,
        reason: assessment.reason,
        assessment,
      });
    }

    const email = await sendLawnWateringReminder(assessment);
    if (!email.ok) {
      return NextResponse.json(
        { ok: false, sent: false, error: email.error, assessment },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      sent: true,
      recipientCount: email.recipientCount,
      assessment,
    });
  } catch (error) {
    console.error("Lawn watering cron failed", error);
    return NextResponse.json(
      {
        ok: false,
        sent: false,
        error: error instanceof Error ? error.message : "Weather check failed",
      },
      { status: 503 }
    );
  }
}
