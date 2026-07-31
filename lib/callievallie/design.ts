/**
 * Callie & Vallie — living game design bible.
 * Keep this the source of truth while systems are built.
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
    body: "Callie and Vallie are equal protagonists. You switch between them — each has a tiny specialty, but neither is locked out of the core loop.",
  },
  {
    id: "small-valley",
    title: "A small valley that feels deep",
    body: "One compact map first: farm, creek edge, and a path to town. Density over sprawl. Every tile should earn its place.",
  },
  {
    id: "gentle-days",
    title: "Gentle days, clear rhythms",
    body: "Plant → water → sleep → harvest. Time always moves forward, never punishes. Missing a watering day slows growth; it never kills the crop.",
  },
  {
    id: "hand-made cozy",
    title: "Hand-made cozy, not AAA polish",
    body: "Chunky tiles, soft palette, readable silhouettes. Art should feel drawn for this valley — not asset-pack generic.",
  },
] as const;

export const CHARACTERS = [
  {
    id: "callie",
    name: "Callie",
    accent: "#d45d6a",
    specialty: "Crops & kitchen",
    blurb:
      "Morning person. Notices when soil is thirsty. Dreams of a market stall that always smells like jam.",
  },
  {
    id: "vallie",
    name: "Vallie",
    accent: "#3d7ea6",
    specialty: "Foraging & creatures",
    blurb:
      "Night owl. Finds berries off the path. Talks to the creek like it might answer back.",
  },
] as const;

export const MVP_LOOP = [
  "Wake up on the farm (Callie or Vallie).",
  "Walk the field, hoe empty dirt, plant seeds from the hotbar.",
  "Water anything growing. Time ticks with each action and as you walk.",
  "Forage the creek edge for a few wild items.",
  "Sleep to advance the day. Crops grow overnight when watered.",
  "Harvest, sell at the honor-box stand, buy more seeds.",
] as const;

export const SYSTEMS_ROADMAP = [
  {
    phase: "v0 — Shell",
    status: "now",
    items: [
      "Title screen + design bible on /callievallie",
      "Playable tile farm prototype (walk, hoe, plant, water, harvest)",
      "Day counter + localStorage save",
      "Switch Callie ↔ Vallie",
    ],
  },
  {
    phase: "v1 — Farm feels alive",
    status: "next",
    items: [
      "Season tint + simple weather (sunny / rain)",
      "5 crops with distinct grow times & sell prices",
      "Hotbar + backpack UI",
      "Sleep cutscene / dawn wipe",
      "Honor-box shop for seeds",
    ],
  },
  {
    phase: "v2 — Valley opens",
    status: "later",
    items: [
      "Creek forage spots & regenerating wild plants",
      "One town path + 2 NPCs with short daily dialogue",
      "Tiny kitchen craft (jam / tea)",
      "Shared farm progress if both characters are used",
    ],
  },
  {
    phase: "v3 — Cozy depth",
    status: "later",
    items: [
      "Animals (1 coop or pen)",
      "Festivals / calendar events",
      "Music + soft SFX",
      "Optional cloud save via Neon for logged-in admin",
    ],
  },
] as const;

export const TECH = {
  host: "Native Next.js route at /callievallie (full-screen, no site chrome) — same pattern as /holo-ttt.",
  render: "Canvas 2D tile map + React HUD. No Phaser until we need scenes, cameras, or physics beyond tiles.",
  data: "TypeScript modules for crops, tiles, dialogue. Easy for Cursor to extend.",
  persist: "localStorage for v0/v1. Neon later if you want cross-device saves.",
  art: "32×32 (or 16×16 upscaled) tiles. SVG or PNG spritesheet. Palette locked in CSS variables.",
  input: "Keyboard + on-screen D-pad/buttons for mobile.",
} as const;

export const OUT_OF_SCOPE_V0 = [
  "Multiplayer / real-time co-op",
  "Combat or mines",
  "Modding / workshop",
  "Pixel-perfect Stardew clone mechanics",
  "Heavy 3D or WebGL world",
] as const;
