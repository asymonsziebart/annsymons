import { getCollectionPageData, normalizeCategory } from "@/lib/data/collectionCards";
import { portfolioTotals } from "@/lib/collectionValue";
import { isEbayConfigured } from "@/lib/ebay";
import PokemonCardsApp from "./PokemonCardsApp";

export const dynamic = "force-dynamic";

export default async function PokemonCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const sp = await searchParams;
  const category = normalizeCategory(sp.category ?? "pokemon");

  let cards: Awaited<ReturnType<typeof getCollectionPageData>>["cards"] = [];
  let snapshots: Awaited<ReturnType<typeof getCollectionPageData>>["snapshots"] = [];
  let loadError: string | null = null;

  try {
    const data = await getCollectionPageData(category);
    cards = data.cards;
    snapshots = data.snapshots;
  } catch (error) {
    console.error("Failed to load Pokemon Cards admin page", error);
    loadError =
      error instanceof Error
        ? error.message
        : "Could not load cards. Check DATABASE_URL.";
  }

  const totals = portfolioTotals(cards);

  return (
    <PokemonCardsApp
      initialCategory={category}
      initialCards={cards}
      initialSnapshots={snapshots}
      initialTotals={totals}
      ebayConfigured={isEbayConfigured()}
      loadError={loadError}
    />
  );
}
