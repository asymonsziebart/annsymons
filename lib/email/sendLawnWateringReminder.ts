import type { LawnWateringAssessment } from "@/lib/lawnWatering";

export async function sendLawnWateringReminder(
  assessment: LawnWateringAssessment
): Promise<{ ok: boolean; error?: string; recipientCount?: number }> {
  const apiKey = process.env.RESEND_API_KEY;
  const recipients = Array.from(
    new Set(
      (process.env.LAWN_WATERING_EMAILS || "")
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean)
    )
  );
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Ann Symons Lawn Reminder <onboarding@resend.dev>";

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not set" };
  }
  if (recipients.length === 0) {
    return { ok: false, error: "LAWN_WATERING_EMAILS is not set" };
  }

  const lastRain =
    assessment.daysSinceMeaningfulRain == null
      ? "No meaningful rain was found in the 7-day weather history."
      : `The last meaningful rain was ${assessment.daysSinceMeaningfulRain} day${
          assessment.daysSinceMeaningfulRain === 1 ? "" : "s"
        } ago.`;

  const html = `
    <h2 style="margin-bottom:8px">The lawn could use water</h2>
    <p>${escapeHtml(assessment.reason)}</p>
    <ul>
      <li>Recent rain: ${assessment.recentRainIn.toFixed(2)} in</li>
      <li>Forecast rain through tomorrow: ${assessment.forecastRainIn.toFixed(2)} in</li>
      <li>Today's high: ${Math.round(assessment.todayHighF)}°F</li>
    </ul>
    <p>${escapeHtml(lastRain)}</p>
    <p><strong>Reminder:</strong> turn on or schedule the sprinkler for the lawn.</p>
    <p style="color:#666;font-size:14px">
      Early morning watering reduces evaporation. Skip watering if the lawn is already damp
      or local watering restrictions apply. Weather source: Open-Meteo for
      ${escapeHtml(assessment.location)}.
    </p>
  `.trim();

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Prevent a cron retry from sending the household the same reminder twice.
      "Idempotency-Key": `lawn-watering-${new Date().toISOString().slice(0, 10)}`,
    },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: "Lawn reminder: time to run the sprinkler",
      html,
    }),
  });

  const data = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) {
    return { ok: false, error: data.message || `Resend error ${response.status}` };
  }

  return { ok: true, recipientCount: recipients.length };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
