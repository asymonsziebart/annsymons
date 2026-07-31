/**
 * Callie & Vallie — living game design bible.
 * Keep this the source of truth while systems are customized on top of Sunsprout.
 */

export const GAME = {
  title: "Callie & Vallie",
  slug: "callievallie",
  tagline: "Two friends. One valley. A farm that wakes up with you.",
  url: "/callievallie",
} as const;

export const PILLARS = [
  {
    id: "two-hearts",
    title: "Two hearts, one farm",
    body: "Callie and Vallie anchor the valley — hearth and shop. You arrive as the new farmer who ties their world together.",
  },
  {
    id: "small-valley",
    title: "A small valley that feels deep",
    body: "One compact map: farm, plaza, pond, and cave. Density over sprawl. Every tile should earn its place.",
  },
  {
    id: "gentle-days",
    title: "Gentle days, clear rhythms",
    body: "Plant → water → sleep → harvest. Time moves forward. Seasons, weather, festivals, and friendships layer on top.",
  },
  {
    id: "hand-made cozy",
    title: "Hand-made cozy, not AAA polish",
    body: "Procedural pixel art, soft palette, readable silhouettes. Built for the browser on Ann's site.",
  },
] as const;

export const CHARACTERS = [
  {
    id: "callie",
    name: "Callie",
    accent: "#d45d6a",
    specialty: "Inn & kitchen",
    blurb:
      "Keeps Callie's Hearth warm. Recipes, soup, and a stool by the fire when the day runs long.",
  },
  {
    id: "vallie",
    name: "Vallie",
    accent: "#3d7ea6",
    specialty: "Shop & seeds",
    blurb:
      "Runs Vallie's General Goods. Seeds, tools, and the occasional packet slipped into your pocket.",
  },
] as const;

export const MVP_LOOP = [
  "Wake up on the farm and walk the village (WASD).",
  "Till with T, plant with 1–4, water crops, harvest with E.",
  "Sell at the village well · buy seeds from Vallie · cook with Callie.",
  "Sleep at the farmhouse to advance the day — crops grow overnight.",
  "Fish, mine, gift villagers, and open ? for the full control sheet.",
] as const;

export const SYSTEMS_ROADMAP = [
  {
    phase: "v0 — Sunsprout foundation",
    status: "now",
    items: [
      "Vendored MIT Sunsprout engine at /callievallie",
      "Callie & Vallie re-skin (names, inn, shop, save keys)",
      "Title screen + design bible wrapper",
      "Full farm / village / seasons / cooking / fishing / mining loop",
    ],
  },
  {
    phase: "v1 — Make it theirs",
    status: "next",
    items: [
      "Deeper Callie & Vallie dialogue + farm lore",
      "Custom crops / palette tuned to the brand",
      "Optional character framing (play as Callie or Vallie)",
      "Nav link from the main site when ready for visitors",
    ],
  },
  {
    phase: "v2 — Valley polish",
    status: "later",
    items: [
      "Audio + soft SFX",
      "Mobile touch controls",
      "Cloud save via Neon for admin",
      "Festivals themed to Ann's life / pets / recipes",
    ],
  },
] as const;

export const TECH = {
  host: "Native Next.js route at /callievallie (full-screen, no site chrome) — same pattern as /holo-ttt.",
  render: "Sunsprout Canvas 2D engine (procedural pixels) + React title/design shell.",
  data: "TypeScript modules under lib/callievallie/sunsprout — crops, NPCs, quests, save.",
  persist: "localStorage callievallie.save.v1 (MIT Sunsprout persistence, rekeyed).",
  art: "Procedural pixel art — no external spritesheets required.",
  input: "Keyboard (full sheet via ?). Touch controls later.",
} as const;

export const OUT_OF_SCOPE_V0 = [
  "Shipping ConcernedApe / Stardew Valley code or assets",
  "Real-time online co-op server (local ?multiplayer=1 tabs only)",
  "Native Godot/Unity build — this stays browser-native on Vercel",
] as const;
