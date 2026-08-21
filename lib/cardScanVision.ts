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

async function loadImageBase64(photoPath: string): Promise<string> {
  if (/^https?:\/\//i.test(photoPath)) {
    const res = await fetch(photoPath, { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load the uploaded card photo.");
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.toString("base64");
  }

  const relative = photoPath.replace(/^\/+/, "");
  if (!relative || relative.includes("..")) {
    throw new Error("Invalid photo path.");
  }
  const full = path.join(process.cwd(), "public", relative);
  const buf = await readFile(full);
  return buf.toString("base64");
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
