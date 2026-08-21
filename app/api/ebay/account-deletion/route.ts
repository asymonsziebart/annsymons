import { createHash } from "crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * eBay requires this public endpoint before a production keyset can be enabled.
 * GET  – challenge verification (SHA-256 of challenge + token + endpoint URL)
 * POST – account-deletion notification (we don't store eBay user data, so we ack)
 *
 * Paste these in developer.ebay.com → Alerts & Notifications → Marketplace Account Deletion:
 *   Endpoint: https://www.annsymons.com/api/ebay/account-deletion
 *   Token:    the same string as verificationToken()
 */
const DEFAULT_TOKEN = "annsymons-ebay-mad-verify-token-2026-cardfinder";

function verificationToken(): string {
  const fromEnv = process.env.EBAY_VERIFICATION_TOKEN?.trim();
  return fromEnv || DEFAULT_TOKEN;
}

function endpointUrl(): string {
  const fromEnv = process.env.EBAY_DELETION_ENDPOINT_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://www.annsymons.com";
  return `${site}/api/ebay/account-deletion`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const challengeCode = searchParams.get("challenge_code")?.trim();
  if (!challengeCode) {
    return NextResponse.json(
      { error: "Missing challenge_code. This URL is for eBay's Marketplace Account Deletion check." },
      { status: 400 }
    );
  }

  const hash = createHash("sha256")
    .update(challengeCode)
    .update(verificationToken())
    .update(endpointUrl())
    .digest("hex");

  return NextResponse.json(
    { challengeResponse: hash },
    { headers: { "Content-Type": "application/json" } }
  );
}

export async function POST() {
  // This app never stores eBay user accounts, so there is nothing to delete.
  // Acknowledge immediately so eBay keeps the keyset enabled.
  return new NextResponse(null, { status: 200 });
}
