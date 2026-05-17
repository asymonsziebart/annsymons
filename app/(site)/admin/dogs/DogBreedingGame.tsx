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

const STORAGE_KEY = "annsymons.puppyRanch.v1";
const STARTING_COINS = 500;
const BREED_COST = 60;
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
  const ageBonus = age === "puppy" ? 35 : 10;
  return Math.round(40 + ageBonus + cuteness * 9);
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
  return Math.max(110, Math.round(dog.value * 0.82));
}

function DogPixel({ dog }: { dog: Dog }) {
  const base =
    dog.color === "Black"
      ? "bg-stone-800"
      : dog.color === "Cream"
        ? "bg-amber-100"
        : dog.color === "Golden"
          ? "bg-yellow-300"
          : dog.color === "Spotted"
            ? "bg-orange-200"
            : dog.color === "Silver"
              ? "bg-slate-300"
              : "bg-amber-700";
  return (
    <div className="mx-auto grid h-20 w-24 grid-cols-6 grid-rows-5 gap-0.5 rounded-xl bg-emerald-100/70 p-2 shadow-inner ring-1 ring-emerald-200">
      <span className={`col-start-2 row-start-2 h-4 w-4 rounded-sm ${base}`} />
      <span className={`col-start-5 row-start-2 h-4 w-4 rounded-sm ${base}`} />
      <span className={`col-span-4 col-start-2 row-span-2 row-start-2 rounded-md ${base}`} />
      <span className={`col-span-5 col-start-1 row-span-2 row-start-4 rounded-md ${base}`} />
      <span className="col-start-3 row-start-3 h-1.5 w-1.5 rounded-full bg-stone-950" />
      <span className="col-start-4 row-start-3 h-1.5 w-1.5 rounded-full bg-stone-950" />
      <span className="col-start-6 row-start-4 h-2 w-4 rounded-full bg-amber-200" />
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
      <DogPixel dog={dog} />
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
