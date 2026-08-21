import { readFile } from "fs/promises";
import path from "path";
import {
  parseVisionScanJson,
  scanPromptForCategory,
  type ScannedCardFields,
} from "@/lib/cardScan";
import type { CollectionCategory } from "@/lib/collectionCardsShared";

export type VisionProvider = "openai" | "ollama";

const DEFAULT_OLLAMA = "http://127.0.0.1:11434";
/** Reads small printed text (set names, collector numbers) better than llama3.2-vision. */
export const DEFAULT_OLLAMA_VISION_MODEL = "qwen2.5vl:7b";

export function ollamaBaseUrl(): string {
  return (
    process.env.OLLAMA_HOST?.trim() ||
    process.env.OLLAMA_BASE_URL?.trim() ||
    DEFAULT_OLLAMA
  ).replace(/\/$/, "");
}

export function ollamaVisionModel(): string {
  return (
    process.env.OLLAMA_VISION_MODEL?.trim() ||
    process.env.OLLAMA_MODEL?.trim() ||
    DEFAULT_OLLAMA_VISION_MODEL
  );
}

export function preferredVisionProvider(): VisionProvider | null {
  const forced = process.env.CARD_SCAN_PROVIDER?.trim().toLowerCase();
  if (forced === "openai") return process.env.OPENAI_API_KEY?.trim() ? "openai" : null;
  if (forced === "ollama") return "ollama";
  // Local `next dev` uses Ollama even if an OpenAI key is also present.
  if (process.env.NODE_ENV !== "production") return "ollama";
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  return null;
}

async function loadImageBytes(photoPath: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(photoPath)) {
    const res = await fetch(photoPath, { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load the uploaded card photo.");
    return Buffer.from(await res.arrayBuffer());
  }

  const relative = photoPath.replace(/^\/+/, "");
  if (!relative || relative.includes("..")) {
    throw new Error("Invalid photo path.");
  }
  const full = path.join(process.cwd(), "public", relative);
  return readFile(full);
}

/**
 * Phone photos are far larger than a vision model needs, and every pixel costs
 * context tokens — full-size images overflow Ollama's window and get rejected.
 * A card's text stays legible well below that limit.
 */
async function loadImageBase64(photoPath: string): Promise<string> {
  const original = await loadImageBytes(photoPath);
  const maxEdge = Number(process.env.OLLAMA_IMAGE_MAX_EDGE?.trim()) || 1024;

  try {
    const { default: sharp } = await import("sharp");
    const resized = await sharp(original)
      .rotate()
      .resize(maxEdge, maxEdge, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return resized.toString("base64");
  } catch {
    // Better to try the original than to fail outright if resizing is unavailable.
    return original.toString("base64");
  }
}

export async function scanCardWithOllama(
  imagePath: string,
  category: CollectionCategory
): Promise<ScannedCardFields & { confidence: string | null }> {
  const base = ollamaBaseUrl();
  const model = ollamaVisionModel();
  const image = await loadImageBase64(imagePath);

  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      // Ollama defaults to a small window that one card photo can exceed.
      options: {
        num_ctx: Number(process.env.OLLAMA_NUM_CTX?.trim()) || 8192,
        temperature: 0.1,
      },
      messages: [
        {
          role: "user",
          content: scanPromptForCategory(category),
          images: [image],
        },
      ],
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    if (/context|too large|exceed/i.test(detail)) {
      throw new Error(
        `The photo is too large for ${model}'s context window. Set OLLAMA_NUM_CTX=16384 in .env.local, or lower OLLAMA_IMAGE_MAX_EDGE (currently ${process.env.OLLAMA_IMAGE_MAX_EDGE?.trim() || 1024}). Ollama said: ${detail.slice(0, 160)}`
      );
    }
    throw new Error(
      `Ollama scan failed (${res.status}). Is \`${model}\` pulled? ${detail.slice(0, 200)}`
    );
  }

  const data = (await res.json()) as { message?: { content?: string } };
  return parseVisionScanJson(data.message?.content ?? "");
}

export async function scanCardWithOpenAI(
  imageUrl: string,
  category: CollectionCategory
): Promise<ScannedCardFields & { confidence: string | null }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: scanPromptForCategory(category) },
            { type: "input_image", image_url: imageUrl },
          ],
        },
      ],
      max_output_tokens: 400,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Card scan failed: ${detail.slice(0, 300)}`);
  }

  const data = (await response.json()) as { output_text?: string };
  return parseVisionScanJson(data.output_text ?? "");
}
