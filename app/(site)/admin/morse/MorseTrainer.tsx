"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MORSE_EDGES,
  MORSE_NODE_MAP,
  MORSE_NODES,
  MORSE_VIEWBOX,
  childForSymbol,
  pathIds,
  type MorseSymbol,
} from "@/lib/morse/tree";

const IDLE_RESET_MS = 2500;

function formatSequence(sequence: string): string {
  if (!sequence) return "—";
  return sequence.replaceAll(".", "·").replaceAll("-", "−");
}

function useMorseAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new Ctx();
    }
    if (ctxRef.current.state === "suspended") {
      void ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const playTone = useCallback(
    (symbol: MorseSymbol) => {
      const ctx = ensureCtx();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Short high "beep" for dots, longer low "boop" for dashes
      const isDot = symbol === ".";
      osc.type = "sine";
      osc.frequency.setValueAtTime(isDot ? 880 : 420, now);

      const duration = isDot ? 0.09 : 0.22;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.28, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration + 0.02);
    },
    [ensureCtx],
  );

  useEffect(() => {
    return () => {
      void ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return playTone;
}

export default function MorseTrainer() {
  const [sequence, setSequence] = useState("");
  const [pulseToken, setPulseToken] = useState(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playTone = useMorseAudio();

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const resetPath = useCallback(() => {
    clearIdleTimer();
    setSequence("");
  }, [clearIdleTimer]);

  const armIdleReset = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      setSequence("");
      idleTimerRef.current = null;
    }, IDLE_RESET_MS);
  }, [clearIdleTimer]);

  const press = useCallback(
    (symbol: MorseSymbol) => {
      playTone(symbol);
      setSequence((prev) => {
        const nextId = childForSymbol(prev, symbol);
        if (!nextId) {
          // Dead end — restart from this symbol if it's a valid root child
          const fromRoot = childForSymbol("", symbol);
          return fromRoot ?? "";
        }
        return nextId;
      });
      setPulseToken((n) => n + 1);
      armIdleReset();
    },
    [armIdleReset, playTone],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (event.key === "." || event.key === "e" || event.key === "E" || event.key === "j" || event.key === "J") {
        event.preventDefault();
        press(".");
      } else if (event.key === "-" || event.key === "t" || event.key === "T" || event.key === "k" || event.key === "K") {
        event.preventDefault();
        press("-");
      } else if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        resetPath();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [press, resetPath]);

  useEffect(() => () => clearIdleTimer(), [clearIdleTimer]);

  // Only light nodes while a path is in progress (idle board stays dark)
  const activeIds = new Set(sequence ? pathIds(sequence) : []);
  const current = MORSE_NODE_MAP[sequence];
  const letter = current?.letter ?? null;

  return (
    <div className="mt-8 space-y-6">
      <div className="morse-device mx-auto w-full max-w-xl overflow-hidden rounded-[1.75rem] border border-[#3a4554] bg-[#1a1f28] shadow-[0_24px_48px_rgba(15,23,42,0.35),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="relative px-3 pb-4 pt-5 sm:px-5 sm:pt-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 10%, #94a3b8 0.6px, transparent 0.7px), radial-gradient(circle at 80% 30%, #94a3b8 0.5px, transparent 0.6px)",
              backgroundSize: "18px 18px, 22px 22px",
            }}
          />

          <div className="relative flex items-center justify-center gap-3 px-2">
            <span className="font-heading text-[0.7rem] font-semibold tracking-[0.35em] text-[#c5cedb] sm:text-xs">
              MORSE
            </span>
            <AntennaIcon lit={sequence.length > 0} />
            <span className="font-heading text-[0.7rem] font-semibold tracking-[0.35em] text-[#c5cedb] sm:text-xs">
              CODE
            </span>
          </div>

          <svg
            viewBox={`0 0 ${MORSE_VIEWBOX.width} ${MORSE_VIEWBOX.height}`}
            className="relative mt-2 h-auto w-full select-none"
            role="img"
            aria-label="Morse code binary tree trainer"
          >
            <defs>
              <filter id="morse-led-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="morse-metal" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e8edf4" />
                <stop offset="55%" stopColor="#a8b4c4" />
                <stop offset="100%" stopColor="#7b8798" />
              </linearGradient>
            </defs>

            {MORSE_EDGES.map((edge) => {
              const from = MORSE_NODE_MAP[edge.from];
              const to = MORSE_NODE_MAP[edge.to];
              if (!from || !to) return null;
              const lit = activeIds.has(edge.from) && activeIds.has(edge.to);
              return (
                <line
                  key={`${edge.from}->${edge.to}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={lit ? "#4ade80" : "url(#morse-metal)"}
                  strokeWidth={lit ? 3.2 : 2}
                  strokeLinecap="round"
                  opacity={lit ? 1 : 0.72}
                  style={lit ? { filter: "url(#morse-led-glow)" } : undefined}
                />
              );
            })}

            {MORSE_NODES.map((node) => {
              const lit = activeIds.has(node.id);
              const isTip = node.id === sequence && sequence.length > 0;
              return (
                <g key={node.id || "root"} transform={`translate(${node.x} ${node.y})`}>
                  {node.kind === "root" ? (
                    <circle
                      r={10}
                      fill={lit ? "#4ade80" : "url(#morse-metal)"}
                      style={lit ? { filter: "url(#morse-led-glow)" } : undefined}
                    />
                  ) : node.kind === "dash" ? (
                    <rect
                      x={-14}
                      y={-7}
                      width={28}
                      height={14}
                      rx={3}
                      fill={lit ? "#4ade80" : "url(#morse-metal)"}
                      style={lit ? { filter: "url(#morse-led-glow)" } : undefined}
                    />
                  ) : (
                    <circle
                      r={9}
                      fill={lit ? "#4ade80" : "url(#morse-metal)"}
                      style={lit ? { filter: "url(#morse-led-glow)" } : undefined}
                    />
                  )}
                  {node.letter ? (
                    <text
                      y={node.y > 360 ? 28 : -18}
                      textAnchor="middle"
                      className="fill-[#d7dee8]"
                      style={{
                        fontSize: isTip ? 18 : 14,
                        fontWeight: isTip ? 700 : 600,
                        fontFamily: "var(--font-heading), ui-sans-serif, system-ui, sans-serif",
                        fill: lit ? "#86efac" : "#d7dee8",
                      }}
                    >
                      {node.letter}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          <div className="relative mt-1 flex flex-col items-center gap-1 px-2 text-center">
            <p
              key={pulseToken}
              className="font-heading text-5xl font-semibold tracking-tight text-[#86efac] transition-opacity sm:text-6xl"
              style={{ minHeight: "1.15em" }}
              aria-live="polite"
            >
              {letter ?? ""}
            </p>
            <p className="font-mono text-sm tracking-[0.35em] text-[#94a3b8]">
              {formatSequence(sequence)}
            </p>
            <p className="mt-1 text-xs text-[#64748b]">
              Idle {IDLE_RESET_MS / 1000}s clears the path · Esc resets now
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-xl grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => press(".")}
          className="morse-key group flex min-h-28 flex-col items-center justify-center gap-2 rounded-[1.5rem] border border-[#334155] bg-[#111827] text-[#e2e8f0] shadow-[0_12px_28px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.05)] transition active:translate-y-[1px] active:bg-[#0b1220] sm:min-h-32"
          aria-label="Dot"
        >
          <span className="inline-block h-5 w-5 rounded-full bg-[#4ade80] shadow-[0_0_16px_rgba(74,222,128,0.65)] transition group-active:scale-95" />
          <span className="font-heading text-xl font-semibold tracking-wide">Dot</span>
          <span className="text-xs uppercase tracking-[0.2em] text-[#64748b]">. / J</span>
        </button>
        <button
          type="button"
          onClick={() => press("-")}
          className="morse-key group flex min-h-28 flex-col items-center justify-center gap-2 rounded-[1.5rem] border border-[#334155] bg-[#111827] text-[#e2e8f0] shadow-[0_12px_28px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.05)] transition active:translate-y-[1px] active:bg-[#0b1220] sm:min-h-32"
          aria-label="Dash"
        >
          <span className="inline-block h-3 w-12 rounded-sm bg-[#4ade80] shadow-[0_0_16px_rgba(74,222,128,0.65)] transition group-active:scale-95" />
          <span className="font-heading text-xl font-semibold tracking-wide">Dash</span>
          <span className="text-xs uppercase tracking-[0.2em] text-[#64748b]">− / K</span>
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-xl justify-center">
        <button type="button" onClick={resetPath} className="neo-btn min-h-11 px-5 text-sm">
          Reset path
        </button>
      </div>
    </div>
  );
}

function AntennaIcon({ lit }: { lit: boolean }) {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden className="shrink-0">
      <path
        d="M14 4v10"
        stroke={lit ? "#4ade80" : "#c5cedb"}
        strokeWidth="2"
        strokeLinecap="round"
        style={lit ? { filter: "drop-shadow(0 0 4px #4ade80)" } : undefined}
      />
      <circle
        cx="14"
        cy="4"
        r="2.4"
        fill={lit ? "#4ade80" : "#c5cedb"}
        style={lit ? { filter: "drop-shadow(0 0 4px #4ade80)" } : undefined}
      />
      <path
        d="M8 12c3.2-3.2 8.8-3.2 12 0"
        fill="none"
        stroke={lit ? "#86efac" : "#94a3b8"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M10.5 14.5c2-2 5-2 7 0"
        fill="none"
        stroke={lit ? "#86efac" : "#94a3b8"}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="11" y="14" width="6" height="8" rx="1.5" fill={lit ? "#4ade80" : "#a8b4c4"} />
    </svg>
  );
}
