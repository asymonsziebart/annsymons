import { NextResponse } from "next/server";
import { canUseAdminApi } from "@/lib/auth";

type OpenAIContent = {
  type: "input_text" | "input_image";
  text?: string;
  image_url?: string;
};

function absoluteImageUrl(request: Request, photoPath: string): string {
  if (/^https?:\/\//i.test(photoPath)) return photoPath;
  const origin = new URL(request.url).origin;
  const path = photoPath.startsWith("/") ? photoPath : `/${photoPath}`;
  return `${origin}${path}`;
}

function fallbackInventory(binCode: string): string {
  return [
    `AI inventory is not configured for bin ${binCode || "this bin"} yet.`,
    "",
    "Add OPENAI_API_KEY to enable automatic photo inventory.",
    "For now, type or paste the contents here after reviewing the photo.",
  ].join("\n");
}

export async function POST(request: Request) {
  const ok = await canUseAdminApi("/admin/garage");
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as Record<string, unknown>;
  const photoPath = typeof body.photo_path === "string" ? body.photo_path.trim() : "";
  const binCode = typeof body.bin_code === "string" ? body.bin_code.trim() : "";

  if (!photoPath) {
    return NextResponse.json({ error: "Upload a photo before running AI inventory." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      inventory_text: fallbackInventory(binCode),
      configured: false,
    });
  }

  const imageUrl = absoluteImageUrl(request, photoPath);
  const content: OpenAIContent[] = [
    {
      type: "input_text",
      text:
        "Look at this garage storage bin photo. Create a concise searchable inventory list. " +
        "Use one item per line when possible. Include quantities, colors, labels, and categories you can see. " +
        "If uncertain, say 'possibly'.",
    },
    { type: "input_image", image_url: imageUrl },
  ];

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
      input: [{ role: "user", content }],
      max_output_tokens: 500,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: `AI inventory failed: ${detail.slice(0, 300)}` },
      { status: 502 }
    );
  }

  const data = (await response.json()) as { output_text?: string };
  const inventoryText = data.output_text?.trim();
  return NextResponse.json({
    inventory_text: inventoryText || fallbackInventory(binCode),
    configured: true,
  });
}
