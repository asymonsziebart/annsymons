"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CHARACTERS,
  GAME,
  MVP_LOOP,
  OUT_OF_SCOPE_V0,
  PILLARS,
  SYSTEMS_ROADMAP,
  TECH,
} from "@/lib/callievallie/design";
import { Game } from "@/lib/callievallie/sunsprout/engine/game";

type Screen = "title" | "design" | "play";

export default function CallieVallieApp() {
  const [screen, setScreen] = useState<Screen>("title");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    if (screen !== "play") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let game: Game;
    try {
      game = new Game(canvas);
      game.start();
      gameRef.current = game;
      (window as unknown as { __callievallie?: Game }).__callievallie = game;
      setBootError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setBootError(msg);
      return;
    }

    return () => {
      game.stop();
      gameRef.current = null;
      delete (window as unknown as { __callievallie?: Game }).__callievallie;
    };
  }, [screen]);

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
          <p className="cv-credit">
            Built on the open-source{" "}
            <a
              href="https://github.com/Sanjays2402/sunsprout"
              target="_blank"
              rel="noreferrer"
            >
              Sunsprout
            </a>{" "}
            engine (MIT) — cozy farm, village, seasons, and more.
          </p>
          <div className="cv-cta">
            <button
              type="button"
              className="cv-btn cv-btn-primary"
              onClick={() => setScreen("play")}
            >
              Play the valley
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
              <h3>Characters in the valley</h3>
              <div className="cv-chars">
                {CHARACTERS.map((c) => (
                  <div key={c.id} className="cv-char" style={{ ["--char" as string]: c.accent }}>
                    <h4>{c.name}</h4>
                    <p className="cv-specialty">{c.specialty}</p>
                    <p>{c.blurb}</p>
                  </div>
                ))}
              </div>
              <p className="cv-note">
                In-game: Callie keeps the hearth (inn / cooking). Vallie runs the shop. You play as
                the new farmer in their valley — Sunsprout&apos;s full systems underneath.
              </p>
            </article>

            <article className="cv-panel">
              <h3>What you can do now</h3>
              <ol className="cv-steps">
                {MVP_LOOP.map((step) => (
                  <li key={step}>{step}</li>
                ))}
                <li>Talk to villagers, fish, mine, cook, gift, and chase hearts.</li>
                <li>Press ? in-game for the full control sheet.</li>
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
              <h3>Tech</h3>
              <ul className="cv-list cv-list-tight">
                <li>
                  <strong>Host</strong>
                  <span>{TECH.host}</span>
                </li>
                <li>
                  <strong>Engine</strong>
                  <span>
                    Vendored Sunsprout (TypeScript Canvas 2D, zero runtime deps) under{" "}
                    <code>lib/callievallie/sunsprout</code>.
                  </span>
                </li>
                <li>
                  <strong>Persist</strong>
                  <span>localStorage key callievallie.save.v1</span>
                </li>
              </ul>
            </article>

            <article className="cv-panel">
              <h3>Still out of scope for custom work</h3>
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
          <header className="cv-play-bar">
            <button type="button" className="cv-btn cv-btn-ghost" onClick={() => setScreen("title")}>
              ← Menu
            </button>
            <p className="cv-play-hint">
              WASD move · E interact · T till · 1–4 plant · ? help
            </p>
            <a
              className="cv-btn cv-btn-ghost"
              href="https://github.com/Sanjays2402/sunsprout"
              target="_blank"
              rel="noreferrer"
            >
              Engine credit
            </a>
          </header>

          {bootError ? (
            <p className="cv-boot-error">Could not start the valley: {bootError}</p>
          ) : (
            <div className="cv-stage">
              <canvas
                ref={canvasRef}
                className="cv-game-canvas"
                width={960}
                height={540}
                tabIndex={0}
                aria-label="Callie and Vallie game"
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
