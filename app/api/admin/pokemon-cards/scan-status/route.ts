import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";
import {
  ollamaBaseUrl,
  ollamaVisionModel,
  preferredVisionProvider,
} from "@/lib/cardScanVision";

export const runtime = "nodejs";

/** Tells the batch scanner whether the local vision model is ready to use. */
export async function GET() {
  const ok = await canUseAdminApi("/admin/pokemon-cards");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = preferredVisionProvider();
  if (provider !== "ollama") {
    return NextResponse.json({
      provider,
      model: provider === "openai" ? "OpenAI gpt-4o-mini" : null,
      reachable: provider === "openai",
      installed: provider === "openai",
    });
  }

  const model = ollamaVisionModel();
  try {
    const response = await fetch(`${ollamaBaseUrl()}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);

    const data = (await response.json()) as {
      models?: Array<{ name?: string; model?: string }>;
    };
    const names = (data.models ?? [])
      .map((item) => item.name ?? item.model ?? "")
      .filter(Boolean);
    const requestedBase = model.split(":")[0];
    const installed = names.some(
      (name) => name === model || name.split(":")[0] === requestedBase
    );

    return NextResponse.json({
      provider,
      model,
      reachable: true,
      installed,
      models: names,
    });
  } catch (error) {
    return NextResponse.json({
      provider,
      model,
      reachable: false,
      installed: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not reach Ollama on this machine.",
    });
  }
}
