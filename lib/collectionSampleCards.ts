import type { CollectionCardInput, CollectionCategory } from "@/lib/collectionCardsShared";

export type SampleCard = Omit<CollectionCardInput, "category">;

/**
 * Well-known cards used to populate an empty collection for testing. Names, sets,
 * and numbers are real so the eBay lookup returns actual listings.
 */
const SAMPLES: Record<CollectionCategory, SampleCard[]> = {
  pokemon: [
    {
      name: "Charizard",
      setName: "Base Set",
      cardNumber: "4/102",
      variant: "Holo",
      condition: "Lightly Played",
      language: "English",
      quantity: 1,
      purchasePrice: 180,
      acquiredOn: "2024-03-12",
      notes: "Sample card — safe to delete.",
    },
    {
      name: "Blastoise",
      setName: "Base Set",
      cardNumber: "2/102",
      variant: "Holo",
      condition: "Near Mint",
      language: "English",
      quantity: 1,
      purchasePrice: 95,
      acquiredOn: "2024-05-02",
      notes: "Sample card — safe to delete.",
    },
    {
      name: "Venusaur",
      setName: "Base Set",
      cardNumber: "15/102",
      variant: "Holo",
      condition: "Moderately Played",
      language: "English",
      quantity: 1,
      purchasePrice: 60,
      acquiredOn: "2024-05-02",
      notes: "Sample card — safe to delete.",
    },
    {
      name: "Pikachu",
      setName: "Base Set",
      cardNumber: "58/102",
      condition: "Near Mint",
      language: "English",
      quantity: 3,
      purchasePrice: 7,
      acquiredOn: "2024-06-18",
      notes: "Sample card — safe to delete.",
    },
    {
      name: "Mewtwo",
      setName: "Base Set",
      cardNumber: "10/102",
      variant: "Holo",
      condition: "Near Mint",
      language: "English",
      quantity: 1,
      purchasePrice: 42,
      acquiredOn: "2024-08-09",
      notes: "Sample card — safe to delete.",
    },
    {
      name: "Umbreon VMAX",
      setName: "Evolving Skies",
      cardNumber: "215/203",
      variant: "Alternate Art",
      condition: "Near Mint",
      language: "English",
      quantity: 1,
      purchasePrice: 340,
      acquiredOn: "2025-01-22",
      notes: "Sample card — safe to delete.",
    },
    {
      name: "Charizard ex",
      setName: "Obsidian Flames",
      cardNumber: "223/197",
      variant: "Special Illustration Rare",
      condition: "Near Mint",
      language: "English",
      quantity: 1,
      purchasePrice: 55,
      acquiredOn: "2025-04-14",
      notes: "Sample card — safe to delete.",
    },
    {
      name: "Lugia",
      setName: "Neo Genesis",
      cardNumber: "9/111",
      variant: "Holo",
      grader: "PSA",
      grade: "8",
      language: "English",
      quantity: 1,
      purchasePrice: 210,
      acquiredOn: "2025-06-30",
      notes: "Sample graded slab — safe to delete.",
    },
  ],
  magic: [
    {
      name: "Black Lotus",
      setName: "Unlimited Edition",
      condition: "Moderately Played",
      language: "English",
      quantity: 1,
      purchasePrice: 6000,
      acquiredOn: "2024-02-10",
      notes: "Sample card — safe to delete.",
    },
    {
      name: "Ragavan, Nimble Pilferer",
      setName: "Modern Horizons 2",
      cardNumber: "138",
      condition: "Near Mint",
      language: "English",
      quantity: 2,
      purchasePrice: 45,
      acquiredOn: "2024-09-01",
      notes: "Sample card — safe to delete.",
    },
    {
      name: "Sheoldred, the Apocalypse",
      setName: "Dominaria United",
      cardNumber: "107",
      condition: "Near Mint",
      language: "English",
      quantity: 1,
      purchasePrice: 70,
      acquiredOn: "2025-03-05",
      notes: "Sample card — safe to delete.",
    },
  ],
  lego: [
    {
      name: "Millennium Falcon",
      setName: "LEGO Star Wars 75192",
      condition: "Sealed",
      quantity: 1,
      purchasePrice: 720,
      acquiredOn: "2024-11-20",
      notes: "Sample set — safe to delete.",
    },
    {
      name: "Hogwarts Castle",
      setName: "LEGO Harry Potter 71043",
      condition: "Sealed",
      quantity: 1,
      purchasePrice: 380,
      acquiredOn: "2025-02-08",
      notes: "Sample set — safe to delete.",
    },
    {
      name: "Titanic",
      setName: "LEGO Creator Expert 10294",
      condition: "Sealed",
      quantity: 1,
      purchasePrice: 590,
      acquiredOn: "2025-05-19",
      notes: "Sample set — safe to delete.",
    },
  ],
};

export function sampleCardsFor(category: CollectionCategory): SampleCard[] {
  return SAMPLES[category];
}

/** Identity used to avoid inserting the same sample twice. */
export function sampleCardKey(card: {
  name: string;
  setName?: string | null;
  cardNumber?: string | null;
}): string {
  return [card.name, card.setName ?? "", card.cardNumber ?? ""]
    .map((part) => part.trim().toLowerCase())
    .join("|");
}
