import type { CardScanResult, CollectionCategory } from "@/lib/collectionCardsShared";

export async function uploadCardPhoto(file: Blob): Promise<string> {
  const form = new FormData();
  form.set("file", file, file instanceof File && file.name ? file.name : `card-scan-${Date.now()}.jpg`);
  form.set("folder", "pokemon-cards");
  const res = await fetch("/api/admin/upload", { method: "POST", body: form });
  const data = (await res.json()) as { path?: string; error?: string };
  if (!res.ok || !data.path) throw new Error(data.error || "Upload failed");
  return data.path;
}

export async function scanCardPhoto(
  imagePath: string,
  category: CollectionCategory
): Promise<{ card: CardScanResult; imagePath: string }> {
  const res = await fetch("/api/admin/pokemon-cards/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imagePath, category }),
  });
  const data = (await res.json()) as {
    card?: CardScanResult;
    imagePath?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || "Scan failed");
  if (!data.card) throw new Error("Scan returned no card details.");
  return { card: data.card, imagePath: data.imagePath ?? imagePath };
}

/** Upload a saved photo, then read card details with AI vision. */
export async function uploadAndScanCardPhoto(
  file: Blob,
  category: CollectionCategory
): Promise<{ card: CardScanResult; imagePath: string }> {
  const imagePath = await uploadCardPhoto(file);
  return scanCardPhoto(imagePath, category);
}
