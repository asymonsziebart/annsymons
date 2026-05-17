"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Breed = "Mutt" | "Spaniel" | "Lab" | "Terrier" | "Corgi" | "Poodle";
type Color = "Brown" | "Cream" | "Black" | "Golden" | "Spotted" | "Silver";
type Coat = "Smooth" | "Fluffy" | "Curly" | "Silky" | "Scruffy";
type Ears = "Floppy" | "Pointy" | "Button" | "Big";
type Personality = "Sweet" | "Silly" | "Loyal" | "Brave" | "Gentle" | "Sparkly";
type Age = "adult" | "puppy";

type Dog = {
  id: string;
  name: string;
  breed: Breed;
  color: Color;
  coat: Coat;
  ears: Ears;
  personality: Personality;
  age: Age;
  cuteness: number;
  value: number;
};

type GameState = {
  coins: number;
  dogs: Dog[];
  day: number;
  births: number;
  sold: number;
};

const STORAGE_KEY = "annsymons.puppyRanch.v2";
const STARTING_COINS = 1000;
const BREED_COST = 40;
const KENNEL_LIMIT = 12;

const dogNames = [
  "Biscuit",
  "Mabel",
  "Pickle",
  "Waffles",
  "Juniper",
  "Mochi",
  "Pepper",
  "Sunny",
  "Noodle",
  "Maple",
  "Cricket",
  "Poppy",
];

const breeds: Breed[] = ["Mutt", "Spaniel", "Lab", "Terrier", "Corgi", "Poodle"];
const colors: Color[] = ["Brown", "Cream", "Black", "Golden", "Spotted", "Silver"];
const coats: Coat[] = ["Smooth", "Fluffy", "Curly", "Silky", "Scruffy"];
const earTypes: Ears[] = ["Floppy", "Pointy", "Button", "Big"];
const personalities: Personality[] = ["Sweet", "Silly", "Loyal", "Brave", "Gentle", "Sparkly"];

const traitScores = {
  breed: { Mutt: 3, Spaniel: 5, Lab: 4, Terrier: 4, Corgi: 7, Poodle: 8 },
  color: { Brown: 2, Cream: 4, Black: 3, Golden: 5, Spotted: 7, Silver: 8 },
  coat: { Smooth: 2, Fluffy: 7, Curly: 6, Silky: 5, Scruffy: 4 },
  ears: { Floppy: 6, Pointy: 4, Button: 7, Big: 5 },
  personality: { Sweet: 5, Silly: 6, Loyal: 4, Brave: 3, Gentle: 5, Sparkly: 9 },
} satisfies {
  breed: Record<Breed, number>;
  color: Record<Color, number>;
  coat: Record<Coat, number>;
  ears: Record<Ears, number>;
  personality: Record<Personality, number>;
};

const starterMarket: Dog[] = [
  makeDog("starter-1", "Biscuit", "Mutt", "Brown", "Scruffy", "Floppy", "Sweet", "adult"),
  makeDog("starter-2", "Mabel", "Spaniel", "Cream", "Silky", "Floppy", "Gentle", "adult"),
  makeDog("starter-3", "Pepper", "Lab", "Black", "Smooth", "Big", "Loyal", "adult"),
  makeDog("starter-4", "Pickle", "Terrier", "Spotted", "Scruffy", "Pointy", "Silly", "adult"),
];

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function dogValue(cuteness: number, age: Age): number {
  const ageBonus = age === "puppy" ? 50 : 15;
  return Math.round(60 + ageBonus + cuteness * 8);
}

function calculateCuteness(
  breed: Breed,
  color: Color,
  coat: Coat,
  ears: Ears,
  personality: Personality
): number {
  const comboBonus =
    (coat === "Fluffy" && ears === "Button" ? 8 : 0) +
    (personality === "Sparkly" ? 10 : 0) +
    (color === "Spotted" && breed === "Terrier" ? 5 : 0);
  const raw =
    traitScores.breed[breed] +
    traitScores.color[color] +
    traitScores.coat[coat] +
    traitScores.ears[ears] +
    traitScores.personality[personality] +
    comboBonus;
  return Math.min(100, raw * 2);
}

function makeDog(
  id: string,
  name: string,
  breed: Breed,
  color: Color,
  coat: Coat,
  ears: Ears,
  personality: Personality,
  age: Age
): Dog {
  const cuteness = calculateCuteness(breed, color, coat, ears, personality);
  return {
    id,
    name,
    breed,
    color,
    coat,
    ears,
    personality,
    age,
    cuteness,
    value: dogValue(cuteness, age),
  };
}

function newGame(): GameState {
  return {
    coins: STARTING_COINS,
    dogs: [],
    day: 1,
    births: 0,
    sold: 0,
  };
}

function isGameState(value: unknown): value is GameState {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<GameState>;
  return (
    typeof v.coins === "number" &&
    typeof v.day === "number" &&
    typeof v.births === "number" &&
    typeof v.sold === "number" &&
    Array.isArray(v.dogs)
  );
}

function inheritTrait<T>(a: T, b: T, mutations: readonly T[]): T {
  if (Math.random() < 0.12) return randomItem(mutations);
  return Math.random() < 0.5 ? a : b;
}

function makePuppy(parentA: Dog, parentB: Dog): Dog {
  const breed = inheritTrait(parentA.breed, parentB.breed, breeds);
  const color = inheritTrait(parentA.color, parentB.color, colors);
  const coat = inheritTrait(parentA.coat, parentB.coat, coats);
  const inheritedEars = inheritTrait(parentA.ears, parentB.ears, earTypes);
  const personality = inheritTrait(parentA.personality, parentB.personality, personalities);
  return makeDog(
    crypto.randomUUID(),
    randomItem(dogNames),
    breed,
    color,
    coat,
    inheritedEars,
    personality,
    "puppy"
  );
}

function purchasePrice(dog: Dog): number {
  return Math.max(120, Math.round(85 + dog.cuteness * 2.4));
}

const dogPalettes = {
  Brown: { fur: "#9a5a2f", shade: "#6f3c1f", light: "#c78a55", muzzle: "#f3d6b8" },
  Cream: { fur: "#f2dfbd", shade: "#caa86e", light: "#fff4d8", muzzle: "#fff7e6" },
  Black: { fur: "#2b2a2a", shade: "#121212", light: "#5c5750", muzzle: "#d8c4a8" },
  Golden: { fur: "#e4aa3d", shade: "#aa6f1d", light: "#ffd77a", muzzle: "#ffe7b4" },
  Spotted: { fur: "#f1d0a3", shade: "#75401d", light: "#ffe2b9", muzzle: "#fff0da" },
  Silver: { fur: "#c8d0d8", shade: "#77818c", light: "#eef3f7", muzzle: "#f6f2ea" },
} satisfies Record<Color, { fur: string; shade: string; light: string; muzzle: string }>;

function DogPortrait({ dog }: { dog: Dog }) {
  const palette = dogPalettes[dog.color];
  const id = dog.id.replace(/[^a-zA-Z0-9_-]/g, "");
  const hasSpots = dog.color === "Spotted";
  const hasCurls = dog.coat === "Curly" || dog.breed === "Poodle";
  const hasFluff = dog.coat === "Fluffy" || dog.coat === "Scruffy";
  const sparkle = dog.personality === "Sparkly";
  const bgA = dog.age === "puppy" ? "#fff7ed" : "#ecfdf5";
  const bgB = dog.age === "puppy" ? "#ffe4e6" : "#d1fae5";
  const scale = dog.age === "puppy" ? 0.92 : 1;

  return (
    <div className="mx-auto overflow-hidden rounded-2xl bg-white p-2 shadow-inner ring-1 ring-amber-100">
      <svg
        className="h-40 w-full rounded-xl"
        viewBox="0 0 260 190"
        role="img"
        aria-label={`${dog.name}, a cartoon ${dog.color.toLowerCase()} ${dog.breed.toLowerCase()}`}
      >
        <defs>
          <linearGradient id={`dog-bg-${id}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={bgA} />
            <stop offset="100%" stopColor={bgB} />
          </linearGradient>
          <radialGradient id={`dog-fur-${id}`} cx="42%" cy="28%" r="72%">
            <stop offset="0%" stopColor={palette.light} />
            <stop offset="58%" stopColor={palette.fur} />
            <stop offset="100%" stopColor={palette.shade} />
          </radialGradient>
        </defs>

        <rect width="260" height="190" rx="22" fill={`url(#dog-bg-${id})`} />
        <circle cx="40" cy="34" r="10" fill="#fff" opacity="0.6" />
        <circle cx="225" cy="42" r="16" fill="#fff" opacity="0.45" />
        <path d="M0 157 C44 139 78 148 118 134 C163 118 204 130 260 111 V190 H0 Z" fill="#bbf7d0" />
        <path d="M24 168 C68 155 116 158 158 145 C198 133 226 140 252 131" fill="none" stroke="#86efac" strokeWidth="5" strokeLinecap="round" opacity="0.7" />

        <g transform={`translate(130 99) scale(${scale}) translate(-130 -99)`}>
          <path d="M197 131 C222 116 238 126 236 145 C218 149 202 143 190 133" fill={palette.shade} />
          <ellipse cx="130" cy="132" rx="54" ry="43" fill={`url(#dog-fur-${id})`} />
          <ellipse cx="88" cy="143" rx="19" ry="31" fill={palette.shade} />
          <ellipse cx="172" cy="143" rx="19" ry="31" fill={palette.shade} />
          <ellipse cx="104" cy="166" rx="24" ry="12" fill={palette.muzzle} />
          <ellipse cx="156" cy="166" rx="24" ry="12" fill={palette.muzzle} />

          {dog.ears === "Floppy" ? (
            <>
              <path d="M76 62 C38 66 31 123 61 142 C84 132 91 94 88 67 Z" fill={palette.shade} />
              <path d="M184 62 C222 66 229 123 199 142 C176 132 169 94 172 67 Z" fill={palette.shade} />
            </>
          ) : dog.ears === "Pointy" ? (
            <>
              <path d="M82 70 L101 20 L116 83 Z" fill={palette.shade} />
              <path d="M178 70 L159 20 L144 83 Z" fill={palette.shade} />
              <path d="M96 61 L103 39 L110 70 Z" fill="#f7b6a6" opacity="0.72" />
              <path d="M164 61 L157 39 L150 70 Z" fill="#f7b6a6" opacity="0.72" />
            </>
          ) : dog.ears === "Button" ? (
            <>
              <ellipse cx="80" cy="77" rx="28" ry="24" fill={palette.shade} />
              <ellipse cx="180" cy="77" rx="28" ry="24" fill={palette.shade} />
            </>
          ) : (
            <>
              <ellipse cx="70" cy="83" rx="26" ry="45" fill={palette.shade} transform="rotate(-18 70 83)" />
              <ellipse cx="190" cy="83" rx="26" ry="45" fill={palette.shade} transform="rotate(18 190 83)" />
            </>
          )}

          <ellipse cx="130" cy="88" rx="62" ry="56" fill={`url(#dog-fur-${id})`} />
          {hasFluff ? (
            <>
              <circle cx="87" cy="78" r="15" fill={palette.fur} />
              <circle cx="103" cy="48" r="16" fill={palette.light} opacity="0.9" />
              <circle cx="130" cy="39" r="18" fill={palette.light} opacity="0.92" />
              <circle cx="157" cy="48" r="16" fill={palette.light} opacity="0.9" />
              <circle cx="173" cy="78" r="15" fill={palette.fur} />
            </>
          ) : null}
          {hasSpots ? (
            <>
              <ellipse cx="101" cy="72" rx="20" ry="16" fill={palette.shade} opacity="0.88" transform="rotate(-18 101 72)" />
              <circle cx="162" cy="101" r="13" fill={palette.shade} opacity="0.88" />
              <ellipse cx="121" cy="135" rx="20" ry="10" fill={palette.shade} opacity="0.72" />
            </>
          ) : null}
          {hasCurls ? (
            <>
              <path d="M98 52 q11 -16 22 0 q11 -16 22 0 q11 -16 22 0" fill="none" stroke={palette.light} strokeWidth="8" strokeLinecap="round" opacity="0.85" />
              <path d="M95 126 q10 12 20 0 q10 12 20 0 q10 12 20 0 q10 12 20 0" fill="none" stroke={palette.light} strokeWidth="7" strokeLinecap="round" opacity="0.62" />
            </>
          ) : null}

          <ellipse cx="130" cy="111" rx="34" ry="27" fill={palette.muzzle} />
          <circle cx="107" cy="89" r="7" fill="#171717" />
          <circle cx="153" cy="89" r="7" fill="#171717" />
          <circle cx="109" cy="86" r="2.5" fill="#fff" />
          <circle cx="155" cy="86" r="2.5" fill="#fff" />
          <path d="M119 106 C124 100 136 100 141 106 C137 114 123 114 119 106 Z" fill="#1f1713" />
          <path d="M130 113 V122" stroke="#1f1713" strokeWidth="3" strokeLinecap="round" />
          <path d="M114 126 C124 136 136 136 146 126" fill="none" stroke="#1f1713" strokeWidth="3" strokeLinecap="round" />
          <path d="M130 129 C135 129 139 132 139 137 C139 144 130 146 130 146 C130 146 121 144 121 137 C121 132 125 129 130 129 Z" fill="#fb7185" opacity="0.88" />
          <circle cx="75" cy="111" r="8" fill="#fb7185" opacity="0.24" />
          <circle cx="185" cy="111" r="8" fill="#fb7185" opacity="0.24" />

          <rect x="108" y="132" width="44" height="10" rx="5" fill="#ef4444" />
          <circle cx="130" cy="143" r="7" fill="#fbbf24" stroke="#b45309" strokeWidth="1.5" />
          <path d="M83 166 C111 181 149 181 177 166" fill="none" stroke={palette.shade} strokeWidth="9" strokeLinecap="round" opacity="0.45" />
        </g>

        {sparkle ? (
          <>
            <path d="M203 65 l4 9 9 4 -9 4 -4 9 -4 -9 -9 -4 9 -4Z" fill="#fbbf24" />
            <path d="M57 52 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3Z" fill="#fde68a" />
          </>
        ) : null}

        <rect x="76" y="153" width="108" height="23" rx="11.5" fill="#ffffff" opacity="0.9" />
        <text
          x="130"
          y="169"
          textAnchor="middle"
          fontFamily="ui-rounded, system-ui, sans-serif"
          fontSize="12"
          fontWeight="800"
          fill="#3f2c1d"
        >
          {dog.personality} {dog.breed}
        </text>
      </svg>
    </div>
  );
}

function DogCard({
  dog,
  selected,
  onSelect,
  action,
}: {
  dog: Dog;
  selected?: boolean;
  onSelect?: () => void;
  action?: ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 shadow-sm ${
        selected ? "border-emerald-500 ring-2 ring-emerald-100" : "border-amber-200"
      }`}
    >
      <DogPortrait dog={dog} />
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold text-stone-950">{dog.name}</h3>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
            {dog.age} {dog.breed}
          </p>
        </div>
        <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-rose-100">
          Cute {dog.cuteness}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-600">
        <div className="rounded-lg bg-amber-50 px-2 py-1">
          <dt className="font-semibold text-stone-800">Color</dt>
          <dd>{dog.color}</dd>
        </div>
        <div className="rounded-lg bg-amber-50 px-2 py-1">
          <dt className="font-semibold text-stone-800">Coat</dt>
          <dd>{dog.coat}</dd>
        </div>
        <div className="rounded-lg bg-amber-50 px-2 py-1">
          <dt className="font-semibold text-stone-800">Ears</dt>
          <dd>{dog.ears}</dd>
        </div>
        <div className="rounded-lg bg-amber-50 px-2 py-1">
          <dt className="font-semibold text-stone-800">Vibe</dt>
          <dd>{dog.personality}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            className={`min-h-10 flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
              selected
                ? "bg-emerald-700 text-white hover:bg-emerald-800"
                : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-100"
            }`}
          >
            {selected ? "Selected" : "Pick parent"}
          </button>
        ) : null}
        {action}
      </div>
    </div>
  );
}

export default function DogBreedingGame() {
  const [game, setGame] = useState<GameState>(() => newGame());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [message, setMessage] = useState("Welcome to Puppy Ranch. Buy two starter dogs to begin.");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (isGameState(parsed)) {
          setGame(parsed);
          setMessage("Loaded your saved ranch.");
        }
      }
    } catch {
      /* ignore corrupt local save */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(game));
    } catch {
      /* ignore storage limits */
    }
  }, [game, hydrated]);

  const adults = useMemo(() => game.dogs.filter((dog) => dog.age === "adult"), [game.dogs]);
  const puppies = useMemo(() => game.dogs.filter((dog) => dog.age === "puppy"), [game.dogs]);
  const selectedParents = selectedIds
    .map((id) => adults.find((dog) => dog.id === id))
    .filter((dog): dog is Dog => Boolean(dog));
  const kennelFull = game.dogs.length >= KENNEL_LIMIT;

  function buyDog(dog: Dog) {
    const price = purchasePrice(dog);
    if (game.coins < price) {
      setMessage("Not enough coins for that starter dog.");
      return;
    }
    if (kennelFull) {
      setMessage("The kennel is full. Sell a puppy before buying more dogs.");
      return;
    }
    const purchased = { ...dog, id: crypto.randomUUID() };
    setGame((current) => ({
      ...current,
      coins: current.coins - price,
      dogs: [...current.dogs, purchased],
    }));
    setMessage(`${purchased.name} joined the ranch.`);
  }

  function toggleParent(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      return [...current.slice(-1), id];
    });
  }

  function breedSelected() {
    if (selectedParents.length !== 2) {
      setMessage("Pick two adult dogs first.");
      return;
    }
    if (game.coins < BREED_COST) {
      setMessage("Not enough coins for treats and nesting straw.");
      return;
    }
    if (kennelFull) {
      setMessage("The kennel is full. Sell a puppy before breeding again.");
      return;
    }
    const puppy = makePuppy(selectedParents[0]!, selectedParents[1]!);
    setGame((current) => ({
      ...current,
      coins: current.coins - BREED_COST,
      dogs: [...current.dogs, puppy],
      births: current.births + 1,
      day: current.day + 1,
    }));
    setSelectedIds([]);
    setMessage(`${puppy.name} was born with ${puppy.cuteness} cuteness and is worth ${puppy.value} coins.`);
  }

  function sellPuppy(id: string) {
    const dog = game.dogs.find((item) => item.id === id);
    if (!dog || dog.age !== "puppy") return;
    setGame((current) => ({
      ...current,
      coins: current.coins + dog.value,
      dogs: current.dogs.filter((item) => item.id !== id),
      sold: current.sold + 1,
    }));
    setMessage(`${dog.name} sold for ${dog.value} coins.`);
  }

  function resetGame() {
    setGame(newGame());
    setSelectedIds([]);
    setMessage("Started a new ranch.");
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Coins</p>
          <p className="font-heading text-3xl font-semibold text-stone-950">{game.coins}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Dogs</p>
          <p className="font-heading text-3xl font-semibold text-stone-950">
            {game.dogs.length}/{KENNEL_LIMIT}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Puppies born</p>
          <p className="font-heading text-3xl font-semibold text-stone-950">{game.births}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Sold</p>
          <p className="font-heading text-3xl font-semibold text-stone-950">{game.sold}</p>
        </div>
      </section>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950">
        {message}
      </div>

      <section className="rounded-3xl bg-white p-4 shadow-[0_18px_50px_-36px_rgba(120,53,15,0.55)] ring-1 ring-amber-200 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-semibold text-stone-950">Starter market</h2>
            <p className="mt-1 text-sm text-stone-600">Buy adults to start your breeding lines.</p>
          </div>
          <button
            type="button"
            onClick={resetGame}
            className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            Reset ranch
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {starterMarket.map((dog) => (
            <DogCard
              key={dog.id}
              dog={dog}
              action={
                <button
                  type="button"
                  onClick={() => buyDog(dog)}
                  className="min-h-10 flex-1 rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Buy for {purchasePrice(dog)}
                </button>
              }
            />
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-[0_18px_50px_-36px_rgba(120,53,15,0.55)] ring-1 ring-amber-200 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-semibold text-stone-950">Kennel</h2>
            <p className="mt-1 text-sm text-stone-600">
              Pick two adult dogs, then breed them for {BREED_COST} coins.
            </p>
          </div>
          <button
            type="button"
            onClick={breedSelected}
            className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedParents.length !== 2 || game.coins < BREED_COST || kennelFull}
          >
            Breed selected
          </button>
        </div>

        {game.dogs.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-8 text-center text-sm text-stone-600">
            No dogs yet. Buy starter dogs from the market.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {game.dogs.map((dog) => (
              <DogCard
                key={dog.id}
                dog={dog}
                selected={selectedIds.includes(dog.id)}
                onSelect={dog.age === "adult" ? () => toggleParent(dog.id) : undefined}
                action={
                  dog.age === "puppy" ? (
                    <button
                      type="button"
                      onClick={() => sellPuppy(dog.id)}
                      className="min-h-10 flex-1 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                    >
                      Sell for {dog.value}
                    </button>
                  ) : null
                }
              />
            ))}
          </div>
        )}
      </section>

      {puppies.length > 0 ? (
        <section className="rounded-3xl border border-rose-200 bg-rose-50 p-4 sm:p-6">
          <h2 className="font-heading text-xl font-semibold text-stone-950">Puppy sales board</h2>
          <p className="mt-1 text-sm text-stone-600">
            Cuteness sets sale price. Rare traits and cute combos sell higher.
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {puppies
              .slice()
              .sort((a, b) => b.value - a.value)
              .map((dog) => (
                <li key={dog.id} className="rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-rose-100">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-stone-950">{dog.name}</p>
                      <p className="text-xs text-stone-600">
                        {dog.color} {dog.coat} {dog.breed}
                      </p>
                    </div>
                    <span className="rounded-full bg-rose-600 px-3 py-1 text-sm font-bold text-white">
                      {dog.value}
                    </span>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
