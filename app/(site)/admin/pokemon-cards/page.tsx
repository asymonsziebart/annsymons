import { listCards, listSnapshots, normalizeCategory } from "@/lib/data/collectionCards";
import { portfolioTotals } from "@/lib/collectionValue";
import { isEbayConfigured } from "@/lib/ebay";
import PokemonCardsApp from "./PokemonCardsApp";
import "./pokemon-cards.css";

export const metadata = {
  title: "Pokémon Cards | Admin",
  robots: "noindex, nofollow",
};

export default async function PokemonCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const sp = await searchParams;
  const category = normalizeCategory(sp.category ?? "pokemon");

  let cards: Awaited<ReturnType<typeof listCards>> = [];
  let snapshots: Awaited<ReturnType<typeof listSnapshots>> = [];
  let loadError: string | null = null;

  try {
    cards = await listCards(category);
    snapshots = await listSnapshots(category);
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : "Could not load cards. Check DATABASE_URL.";
  }

  const totals = portfolioTotals(cards);

  return (
    <div className="pokemon-cards-page">
      <PokemonCardsApp
        initialCategory={category}
        initialCards={cards}
        initialSnapshots={snapshots}
        initialTotals={totals}
        ebayConfigured={isEbayConfigured()}
        loadError={loadError}
      />
    </div>
  );
}
