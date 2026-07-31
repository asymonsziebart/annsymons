"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import {
  CHARACTERS,
  GAME,
  MVP_LOOP,
  OUT_OF_SCOPE_V0,
  PILLARS,
  SYSTEMS_ROADMAP,
  TECH,
} from "@/lib/callievallie/design";
import { CROPS, cropFromSeed } from "@/lib/callievallie/crops";
import {
  MAP_H,
  MAP_W,
  MAX_ENERGY,
  TILE,
  canWalk,
  createNewGame,
  itemLabel,
  loadGame,
  saveGame,
} from "@/lib/callievallie/game";
import type { GameState, ToolId } from "@/lib/callievallie/types";

type Screen = "title" | "design" | "play";

type Action =
  | { type: "hydrate"; state: GameState }
  | { type: "reset" }
  | { type: "move"; dx: number; dy: number }
  | { type: "setTool"; tool: ToolId }
  | { type: "selectSlot"; index: number }
  | { type: "switchCharacter" }
  | { type: "act"; dx: number; dy: number }
  | { type: "sleep" }
  | { type: "sellAll" };

function spend(state: GameState, cost = 1): GameState | null {
  if (state.energy < cost) return null;
  return { ...state, energy: state.energy - cost };
}

function addItem(state: GameState, itemId: GameState["inventory"][number]["itemId"], qty = 1): GameState {
  const inventory = state.inventory.map((s) => ({ ...s }));
  const existing = inventory.find((s) => s.itemId === itemId);
  if (existing) existing.qty += qty;
  else inventory.push({ itemId, qty });
  return { ...state, inventory };
}

function takeSelectedSeed(state: GameState): { next: GameState; seedId: string } | null {
  const slot = state.inventory[state.selectedSlot];
  if (!slot || !slot.itemId.endsWith("_seed") || slot.qty < 1) return null;
  const inventory = state.inventory
    .map((s, i) =>
      i === state.selectedSlot ? { ...s, qty: s.qty - 1 } : s
    )
    .filter((s) => s.qty > 0);
  const selectedSlot = Math.min(state.selectedSlot, Math.max(0, inventory.length - 1));
  return {
    seedId: slot.itemId,
    next: { ...state, inventory, selectedSlot },
  };
}

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "reset":
      return createNewGame();
    case "move": {
      const x = state.playerX + action.dx;
      const y = state.playerY + action.dy;
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return state;
      if (!canWalk(state.map[y][x].kind)) return state;
      const spent = spend(state, 0);
      if (!spent) return state;
      return { ...spent, playerX: x, playerY: y };
    }
    case "setTool":
      return { ...state, tool: action.tool };
    case "selectSlot":
      return { ...state, selectedSlot: action.index };
    case "switchCharacter":
      return {
        ...state,
        activeCharacter: state.activeCharacter === "callie" ? "vallie" : "callie",
      };
    case "act": {
      const tx = state.playerX + action.dx;
      const ty = state.playerY + action.dy;
      if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return state;
      const map = state.map.map((row) => row.map((t) => ({ ...t, crop: t.crop ? { ...t.crop } : undefined })));
      const tile = map[ty][tx];

      if (state.tool === "hoe") {
        if (tile.kind !== "dirt" && tile.kind !== "tilled") return state;
        if (tile.crop) return state;
        const spent = spend(state);
        if (!spent) return state;
        tile.kind = "tilled";
        return { ...spent, map };
      }

      if (state.tool === "hand") {
        if (tile.kind === "tilled" && !tile.crop) {
          const seeded = takeSelectedSeed(state);
          if (!seeded) return state;
          const crop = cropFromSeed(seeded.seedId);
          if (!crop) return state;
          const spent = spend(seeded.next);
          if (!spent) return state;
          tile.crop = { cropId: crop.id, stage: 0, wateredToday: false };
          return { ...spent, map };
        }
        if (tile.crop) {
          const def = CROPS[tile.crop.cropId];
          if (tile.crop.stage < def.daysToMature) return state;
          const spent = spend(state);
          if (!spent) return state;
          tile.crop = undefined;
          tile.kind = "dirt";
          return addItem({ ...spent, map }, def.id, 1);
        }
        return state;
      }

      if (state.tool === "water") {
        if (!tile.crop || tile.crop.wateredToday) return state;
        const spent = spend(state);
        if (!spent) return state;
        tile.crop.wateredToday = true;
        return { ...spent, map };
      }

      return state;
    }
    case "sleep": {
      const map = state.map.map((row) =>
        row.map((t) => {
          if (!t.crop) return { ...t };
          const grown =
            t.crop.wateredToday && t.crop.stage < CROPS[t.crop.cropId].daysToMature
              ? t.crop.stage + 1
              : t.crop.stage;
          return {
            ...t,
            crop: {
              ...t.crop,
              stage: grown,
              wateredToday: false,
            },
          };
        })
      );
      return {
        ...state,
        day: state.day + 1,
        energy: MAX_ENERGY,
        map,
        playerX: 7,
        playerY: 7,
      };
    }
    case "sellAll": {
      let coins = state.coins;
      const inventory = state.inventory
        .map((slot) => {
          const crop = Object.values(CROPS).find((c) => c.id === slot.itemId);
          if (!crop) return slot;
          coins += crop.sellPrice * slot.qty;
          return { ...slot, qty: 0 };
        })
        .filter((s) => s.qty > 0);
      return { ...state, coins, inventory, selectedSlot: 0 };
    }
    default:
      return state;
  }
}

const TILE_COLORS: Record<string, string> = {
  grass: "#6f9b63",
  dirt: "#a67c52",
  tilled: "#8b5e3c",
  water: "#4a90a4",
  path: "#c4a574",
  fence: "#5c4033",
  stand: "#d4a017",
};

function drawGame(ctx: CanvasRenderingContext2D, state: GameState) {
  ctx.clearRect(0, 0, MAP_W * TILE, MAP_H * TILE);

  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const tile = state.map[y][x];
      ctx.fillStyle = TILE_COLORS[tile.kind] ?? "#888";
      ctx.fillRect(x * TILE, y * TILE, TILE, TILE);

      if (tile.kind === "grass") {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        if ((x + y) % 2 === 0) ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
      }

      if (tile.crop) {
        const def = CROPS[tile.crop.cropId];
        const ready = tile.crop.stage >= def.daysToMature;
        const r = 6 + tile.crop.stage * 2;
        ctx.beginPath();
        ctx.fillStyle = ready ? def.color : def.sproutColor;
        ctx.arc(
          x * TILE + TILE / 2,
          y * TILE + TILE / 2 + (ready ? 0 : 4),
          r,
          0,
          Math.PI * 2
        );
        ctx.fill();
        if (tile.crop.wateredToday) {
          ctx.fillStyle = "rgba(80,160,220,0.55)";
          ctx.fillRect(x * TILE + 8, y * TILE + TILE - 8, TILE - 16, 4);
        }
      }

      ctx.strokeStyle = "rgba(0,0,0,0.08)";
      ctx.strokeRect(x * TILE + 0.5, y * TILE + 0.5, TILE - 1, TILE - 1);
    }
  }

  const char = CHARACTERS.find((c) => c.id === state.activeCharacter)!;
  const px = state.playerX * TILE;
  const py = state.playerY * TILE;
  ctx.fillStyle = char.accent;
  ctx.beginPath();
  ctx.roundRect(px + 8, py + 6, TILE - 16, TILE - 12, 10);
  ctx.fill();
  ctx.fillStyle = "#fff8ef";
  ctx.beginPath();
  ctx.arc(px + TILE / 2, py + 16, 7, 0, Math.PI * 2);
  ctx.fill();
}

function FarmCanvas({ state }: { state: GameState }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawGame(ctx, state);
  }, [state]);

  return (
    <canvas
      ref={ref}
      className="cv-canvas"
      width={MAP_W * TILE}
      height={MAP_H * TILE}
      aria-label="Callie and Vallie farm map"
    />
  );
}

export default function CallieVallieApp() {
  const [screen, setScreen] = useState<Screen>("title");
  const [state, dispatch] = useReducer(reducer, null, createNewGame);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState("Arrow keys / WASD move · Space acts forward · Z sleep");
  const facing = useRef({ dx: 0, dy: 1 });

  useEffect(() => {
    dispatch({ type: "hydrate", state: loadGame() });
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || screen !== "play") return;
    saveGame(state);
  }, [state, ready, screen]);

  useEffect(() => {
    if (screen !== "play") return;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["arrowup", "w"].includes(key)) {
        e.preventDefault();
        facing.current = { dx: 0, dy: -1 };
        dispatch({ type: "move", dx: 0, dy: -1 });
      } else if (["arrowdown", "s"].includes(key)) {
        e.preventDefault();
        facing.current = { dx: 0, dy: 1 };
        dispatch({ type: "move", dx: 0, dy: 1 });
      } else if (["arrowleft", "a"].includes(key)) {
        e.preventDefault();
        facing.current = { dx: -1, dy: 0 };
        dispatch({ type: "move", dx: -1, dy: 0 });
      } else if (["arrowright", "d"].includes(key)) {
        e.preventDefault();
        facing.current = { dx: 1, dy: 0 };
        dispatch({ type: "move", dx: 1, dy: 0 });
      } else if (key === " " || key === "enter") {
        e.preventDefault();
        dispatch({ type: "act", ...facing.current });
        setToast(
          state.tool === "hoe"
            ? "Hoe tilled soil in front of you"
            : state.tool === "water"
              ? "Watered the crop ahead"
              : "Used hands on the tile ahead"
        );
      } else if (key === "z") {
        dispatch({ type: "sleep" });
        setToast(`Good morning — Day ${state.day + 1}`);
      } else if (key === "1") dispatch({ type: "setTool", tool: "hoe" });
      else if (key === "2") dispatch({ type: "setTool", tool: "water" });
      else if (key === "3") dispatch({ type: "setTool", tool: "hand" });
      else if (key === "q") dispatch({ type: "switchCharacter" });
      else if (key === "e") {
        dispatch({ type: "sellAll" });
        setToast("Sold harvest at the honor box");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, state.tool, state.day]);

  const active = CHARACTERS.find((c) => c.id === state.activeCharacter)!;

  return (
    <div className="cv-root" data-screen={screen}>
      <div className="cv-sky" aria-hidden />
      <div className="cv-meadow" aria-hidden />

      {screen === "title" && (
        <section className="cv-title">
          <p className="cv-kicker">annsymons.com/callievallie</p>
          <h1 className="cv-brand">
            <span className="cv-brand-callie">Callie</span>
            <span className="cv-brand-amp">&</span>
            <span className="cv-brand-vallie">Vallie</span>
          </h1>
          <p className="cv-tagline">{GAME.tagline}</p>
          <div className="cv-cta">
            <button type="button" className="cv-btn cv-btn-primary" onClick={() => setScreen("play")}>
              Play prototype
            </button>
            <button type="button" className="cv-btn" onClick={() => setScreen("design")}>
              Design bible
            </button>
          </div>
          <Link href="/" className="cv-home">
            ← Ann Symons
          </Link>
        </section>
      )}

      {screen === "design" && (
        <section className="cv-design">
          <header className="cv-design-head">
            <button type="button" className="cv-btn cv-btn-ghost" onClick={() => setScreen("title")}>
              ← Title
            </button>
            <h2>Design bible</h2>
            <button type="button" className="cv-btn cv-btn-primary" onClick={() => setScreen("play")}>
              Play
            </button>
          </header>

          <div className="cv-design-grid">
            <article className="cv-panel">
              <h3>Pillars</h3>
              <ul className="cv-list">
                {PILLARS.map((p) => (
                  <li key={p.id}>
                    <strong>{p.title}</strong>
                    <span>{p.body}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="cv-panel">
              <h3>Characters</h3>
              <div className="cv-chars">
                {CHARACTERS.map((c) => (
                  <div key={c.id} className="cv-char" style={{ ["--char" as string]: c.accent }}>
                    <h4>{c.name}</h4>
                    <p className="cv-specialty">{c.specialty}</p>
                    <p>{c.blurb}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="cv-panel">
              <h3>MVP day loop</h3>
              <ol className="cv-steps">
                {MVP_LOOP.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>

            <article className="cv-panel">
              <h3>Roadmap</h3>
              <div className="cv-roadmap">
                {SYSTEMS_ROADMAP.map((phase) => (
                  <div key={phase.phase} data-status={phase.status}>
                    <h4>
                      {phase.phase}
                      <em>{phase.status}</em>
                    </h4>
                    <ul>
                      {phase.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>

            <article className="cv-panel">
              <h3>Tech fit for this site</h3>
              <ul className="cv-list cv-list-tight">
                <li><strong>Host</strong><span>{TECH.host}</span></li>
                <li><strong>Render</strong><span>{TECH.render}</span></li>
                <li><strong>Data</strong><span>{TECH.data}</span></li>
                <li><strong>Persist</strong><span>{TECH.persist}</span></li>
                <li><strong>Art</strong><span>{TECH.art}</span></li>
                <li><strong>Input</strong><span>{TECH.input}</span></li>
              </ul>
            </article>

            <article className="cv-panel">
              <h3>Not in v0</h3>
              <ul className="cv-steps">
                {OUT_OF_SCOPE_V0.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>
      )}

      {screen === "play" && (
        <section className="cv-play">
          <header className="cv-hud">
            <button type="button" className="cv-btn cv-btn-ghost" onClick={() => setScreen("title")}>
              ← Menu
            </button>
            <div className="cv-stats">
              <span>Day {state.day}</span>
              <span>{state.energy}/{MAX_ENERGY} energy</span>
              <span>{state.coins}¢</span>
              <button
                type="button"
                className="cv-char-chip"
                style={{ ["--char" as string]: active.accent }}
                onClick={() => dispatch({ type: "switchCharacter" })}
              >
                {active.name} · Q
              </button>
            </div>
            <button
              type="button"
              className="cv-btn cv-btn-ghost"
              onClick={() => {
                dispatch({ type: "reset" });
                setToast("New farm started");
              }}
            >
              Reset
            </button>
          </header>

          <div className="cv-stage">
            <FarmCanvas state={state} />
          </div>

          <p className="cv-toast">{toast}</p>

          <div className="cv-controls">
            <div className="cv-tools" role="group" aria-label="Tools">
              {(
                [
                  ["hoe", "1 Hoe"],
                  ["water", "2 Water"],
                  ["hand", "3 Hand"],
                ] as const
              ).map(([tool, label]) => (
                <button
                  key={tool}
                  type="button"
                  className={`cv-tool ${state.tool === tool ? "is-active" : ""}`}
                  onClick={() => dispatch({ type: "setTool", tool })}
                >
                  {label}
                </button>
              ))}
              <button type="button" className="cv-tool" onClick={() => dispatch({ type: "sleep" })}>
                Z Sleep
              </button>
              <button type="button" className="cv-tool" onClick={() => dispatch({ type: "sellAll" })}>
                E Sell
              </button>
            </div>

            <div className="cv-hotbar" role="listbox" aria-label="Inventory">
              {state.inventory.length === 0 && (
                <span className="cv-empty">Bag empty — plant, harvest, sell</span>
              )}
              {state.inventory.map((slot, i) => (
                <button
                  key={`${slot.itemId}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={state.selectedSlot === i}
                  className={`cv-slot ${state.selectedSlot === i ? "is-active" : ""}`}
                  onClick={() => dispatch({ type: "selectSlot", index: i })}
                >
                  <span>{itemLabel(slot.itemId)}</span>
                  <em>×{slot.qty}</em>
                </button>
              ))}
            </div>

            <div className="cv-dpad" aria-label="Movement">
              <button type="button" onClick={() => { facing.current = { dx: 0, dy: -1 }; dispatch({ type: "move", dx: 0, dy: -1 }); }}>↑</button>
              <div>
                <button type="button" onClick={() => { facing.current = { dx: -1, dy: 0 }; dispatch({ type: "move", dx: -1, dy: 0 }); }}>←</button>
                <button type="button" className="cv-act" onClick={() => dispatch({ type: "act", ...facing.current })}>Act</button>
                <button type="button" onClick={() => { facing.current = { dx: 1, dy: 0 }; dispatch({ type: "move", dx: 1, dy: 0 }); }}>→</button>
              </div>
              <button type="button" onClick={() => { facing.current = { dx: 0, dy: 1 }; dispatch({ type: "move", dx: 0, dy: 1 }); }}>↓</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
