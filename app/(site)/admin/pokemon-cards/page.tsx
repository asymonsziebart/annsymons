import { normalizeCategory } from "@/lib/collectionCardsShared";
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

  return (
    <PokemonCardsApp
      initialCategory={category}
      ebayConfigured={isEbayConfigured()}
    />
  );
}
