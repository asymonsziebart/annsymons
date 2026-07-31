"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

import farmWorld from "../../game/callievallie-godot/assets/farm-world.png";

type Screen = "landing" | "play" | "guide";

export default function CallieVallieApp() {
  const [screen, setScreen] = useState<Screen>("landing");
  const frameRef = useRef<HTMLIFrameElement>(null);

  const openFullscreen = async () => {
    try {
      await frameRef.current?.requestFullscreen();
    } catch {
      // Fullscreen is optional; the embedded game remains playable.
    }
  };

  if (screen === "play") {
    return (
      <main className="cv-game-shell">
        <header className="cv-game-bar">
          <button type="button" onClick={() => setScreen("landing")}>
            ← Valley home
          </button>
          <p>
            <strong>Callie &amp; Vallie</strong>
            <span>WASD · 1–4 tools · Space act · E interact · ? help</span>
          </p>
          <button type="button" onClick={openFullscreen}>
            Fullscreen
          </button>
        </header>
        <iframe
          ref={frameRef}
          className="cv-game-frame"
          src="/callievallie-game/index.html"
          title="Play Callie and Vallie"
          allow="fullscreen; autoplay"
        />
      </main>
    );
  }

  if (screen === "guide") {
    return (
      <main className="cv-guide">
        <Image
          src={farmWorld}
          alt=""
          fill
          priority
          className="cv-guide-bg"
          sizes="100vw"
        />
        <div className="cv-guide-shade" />
        <section className="cv-guide-card">
          <p className="cv-eyebrow">First morning in the valley</p>
          <h1>How to play</h1>
          <div className="cv-guide-grid">
            <div>
              <kbd>WASD</kbd>
              <span>Walk the farm</span>
            </div>
            <div>
              <kbd>1–4</kbd>
              <span>Choose hoe, seeds, water, or harvest</span>
            </div>
            <div>
              <kbd>Space</kbd>
              <span>Use your tool near a field plot</span>
            </div>
            <div>
              <kbd>E</kbd>
              <span>Shop, talk, inspect, and sleep</span>
            </div>
            <div>
              <kbd>Q</kbd>
              <span>Switch between Callie and Vallie</span>
            </div>
            <div>
              <kbd>N</kbd>
              <span>Sleep; watered crops grow overnight</span>
            </div>
          </div>
          <p className="cv-guide-note">
            Your farm saves automatically in this browser. The first playable
            slice includes the farm, seed stall, day cycle, both characters,
            and three-stage crops.
          </p>
          <div className="cv-actions">
            <button className="cv-primary" type="button" onClick={() => setScreen("play")}>
              Enter the valley
            </button>
            <button type="button" onClick={() => setScreen("landing")}>
              Back
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="cv-landing">
      <Image
        src={farmWorld}
        alt="A lush pixel-art farm with a cottage, pond, bridge, market stall, and crop fields"
        fill
        priority
        className="cv-world-art"
        sizes="100vw"
      />
      <div className="cv-cinematic-shade" />
      <nav className="cv-top-nav">
        <Link href="/">← Ann Symons</Link>
        <span>Original Godot web game</span>
      </nav>
      <section className="cv-hero">
        <p className="cv-eyebrow">A cozy farming story</p>
        <h1>
          <span>Callie</span>
          <em>&amp;</em>
          <span>Vallie</span>
        </h1>
        <p className="cv-lede">
          Come home to a hand-painted valley of moonberries, old bridges,
          cedar smoke, and mornings that begin in gold.
        </p>
        <div className="cv-actions">
          <button className="cv-primary" type="button" onClick={() => setScreen("play")}>
            Enter the valley
          </button>
          <button type="button" onClick={() => setScreen("guide")}>
            How to play
          </button>
        </div>
        <p className="cv-fine-print">
          Original world and characters · Godot 4 · Saves in your browser
        </p>
      </section>
    </main>
  );
}
