/**
 * Email Ann when someone requests a site login.
 * Uses RESEND_API_KEY; delivers to OWNER_EMAIL (default a.krause10597@gmail.com).
 */

import { getOwnerEmail } from "@/lib/ownerAccount";

export type AccessRequestNotifyInput = {
  name: string;
  email: string;
};

export async function sendAccessRequestNotify(
  input: AccessRequestNotifyInput
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = getOwnerEmail();
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Ann Symons Site <onboarding@resend.dev>";

  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not set" };
  }
  if (!to) {
    return { ok: false, error: "Owner email is not set" };
  }

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://www.annsymons.com";
  const usersUrl = `${site}/admin/users`;

  const name = escapeHtml(input.name.trim() || "Someone");
  const email = escapeHtml(input.email.trim());

  const html = `
    <p><strong>${name}</strong> requested access to your site.</p>
    <p>Email: <a href="mailto:${email}">${email}</a></p>
    <p style="margin:24px 0">
      <a href="${escapeHtml(usersUrl)}"
         style="display:inline-block;padding:12px 18px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
        Review on Manage Users
      </a>
    </p>
    <p style="color:#666;font-size:14px">
      Or open <a href="${escapeHtml(usersUrl)}">${escapeHtml(usersUrl)}</a> to approve or deny.
    </p>
  `.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: `Access request: ${input.name.trim() || input.email}`,
      html,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) {
    return { ok: false, error: data.message || `Resend error ${res.status}` };
  }
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
