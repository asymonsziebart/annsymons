"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MORSE_EDGES,
  MORSE_HUB,
  MORSE_NODE_MAP,
  MORSE_NODES,
  MORSE_VIEWBOX,
  childForSymbol,
  orthogonalPath,
  pathIds,
  rootEdgePath,
  type MorseNode,
  type MorseSymbol,
} from "@/lib/morse/tree";

const IDLE_RESET_MS = 2500;
const INK = "#e8edf4";
const LED = "#39ff6a";

function useMorseAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureCtx = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

function labelOffset(node: MorseNode): { x: number; y: number; anchor: "start" | "middle" | "end" } {
  switch (node.label) {
    case "left":
      return { x: -14, y: 4, anchor: "end" };
    case "right":
      return { x: 14, y: 4, anchor: "start" };
    case "above":
      return { x: 0, y: -14, anchor: "middle" };
    case "below":
      return { x: 0, y: 20, anchor: "middle" };
    default:
      return { x: 0, y: 0, anchor: "middle" };
  }
}

export default function MorseTrainer() {
  const [sequence, setSequence] = useState("");
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
          const fromRoot = childForSymbol("", symbol);
          return fromRoot ?? "";
        }
        return nextId;
      });
      armIdleReset();
    },
    [armIdleReset, playTone],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "." || event.key === "e" || event.key === "E" || event.key === "j" || event.key === "J") {
        event.preventDefault();
        press(".");
      } else if (
        event.key === "-" ||
        event.key === "t" ||
        event.key === "T" ||
        event.key === "k" ||
        event.key === "K"
      ) {
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

  const activeIds = new Set(sequence ? pathIds(sequence) : []);
  const current = MORSE_NODE_MAP[sequence];
  const letter = current?.letter ?? null;
  const antennaLit = sequence.length > 0;
  const root = MORSE_NODE_MAP[""];

  return (
    <div className="morse-device mx-auto w-full max-w-[26rem] overflow-hidden rounded-[1.25rem] border border-[#cfd6e0] bg-[#0b0d11] shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
      <div className="relative px-1.5 pt-2 sm:px-2 sm:pt-3">
        <svg
          viewBox={`0 0 ${MORSE_VIEWBOX.width} ${MORSE_VIEWBOX.height}`}
          className="relative h-auto w-full select-none"
          role="img"
          aria-label="Morse code rail-tree trainer"
        >
          <defs>
            <filter id="morse-led-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <text
            x="100"
            y="36"
            textAnchor="middle"
            fill={INK}
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "0.28em",
              fontFamily: "var(--font-heading), ui-sans-serif, system-ui, sans-serif",
            }}
          >
            MORSE
          </text>
          <text
            x="360"
            y="36"
            textAnchor="middle"
            fill={INK}
            style={{
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "0.28em",
              fontFamily: "var(--font-heading), ui-sans-serif, system-ui, sans-serif",
            }}
          >
            CODE
          </text>

          {/* Antenna root — V prongs on a stem, never a filled dot */}
          <g
            transform={`translate(${root.x} ${root.y})`}
            style={antennaLit ? { filter: "url(#morse-led-glow)" } : undefined}
          >
            <path
              d="M0 20 L0 0 M0 0 L-11 -14 M0 0 L11 -14"
              fill="none"
              stroke={antennaLit ? LED : INK}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>

          {MORSE_EDGES.map((edge) => {
            const from = MORSE_NODE_MAP[edge.from];
            const to = MORSE_NODE_MAP[edge.to];
            if (!from || !to) return null;
            const lit = activeIds.has(edge.from) && activeIds.has(edge.to);
            const d =
              from.kind === "root"
                ? rootEdgePath(to.x, to.y, from.y)
                : orthogonalPath(from.x, from.y, to.x, to.y);
            return (
              <path
                key={`${edge.from}->${edge.to}`}
                d={d}
                fill="none"
                stroke={lit ? LED : INK}
                strokeWidth={lit ? 2.5 : 1.6}
                strokeLinejoin="miter"
                strokeLinecap="square"
                opacity={lit ? 1 : 0.9}
                style={lit ? { filter: "url(#morse-led-glow)" } : undefined}
              />
            );
          })}

          {/* Tiny hub join on the main rail */}
          <circle
            cx={MORSE_HUB.x}
            cy={MORSE_HUB.y}
            r={2.2}
            fill={antennaLit ? LED : INK}
            style={antennaLit ? { filter: "url(#morse-led-glow)" } : undefined}
          />

          {MORSE_NODES.filter((n) => n.kind !== "root").map((node) => {
            const lit = activeIds.has(node.id);
            const isTip = node.id === sequence && sequence.length > 0;
            const fill = lit ? LED : INK;
            const offset = labelOffset(node);
            return (
              <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
                {node.kind === "dash" ? (
                  <rect
                    x={-10}
                    y={-4.5}
                    width={20}
                    height={9}
                    rx={1.2}
                    fill={fill}
                    style={lit ? { filter: "url(#morse-led-glow)" } : undefined}
                  />
                ) : (
                  <circle
                    r={6.5}
                    fill={fill}
                    style={lit ? { filter: "url(#morse-led-glow)" } : undefined}
                  />
                )}
                {node.letter ? (
                  <text
                    x={offset.x}
                    y={offset.y}
                    textAnchor={offset.anchor}
                    fill={lit ? LED : INK}
                    style={{
                      fontSize: isTip ? 15 : 12,
                      fontWeight: isTip ? 800 : 700,
                      fontFamily: "var(--font-heading), ui-sans-serif, system-ui, sans-serif",
                    }}
                  >
                    {node.letter}
                  </text>
                ) : null}
              </g>
            );
          })}

          <text
            x="230"
            y="450"
            textAnchor="middle"
            fill={letter ? LED : "#5b6472"}
            style={{
              fontSize: 40,
              fontWeight: 700,
              fontFamily: "var(--font-heading), ui-sans-serif, system-ui, sans-serif",
            }}
          >
            {letter ?? "·"}
          </text>
          <text
            x="230"
            y="478"
            textAnchor="middle"
            fill="#7b8798"
            style={{
              fontSize: 11,
              letterSpacing: "0.32em",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          >
            {sequence
              ? sequence.replaceAll(".", "·").replaceAll("-", "−")
              : `idle ${IDLE_RESET_MS / 1000}s`}
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-[#2a3140] bg-[#0b0d11] p-2.5 sm:p-3">
        <button
          type="button"
          onClick={() => press(".")}
          className="flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-[#3a4554] bg-[#141820] text-[#e8edf4] transition active:translate-y-px active:bg-[#0a0c10] sm:min-h-16"
          aria-label="Dot"
        >
          <span className="inline-block h-3 w-3 rounded-full bg-[#39ff6a] shadow-[0_0_10px_rgba(57,255,106,0.7)]" />
          <span className="font-heading text-sm font-semibold tracking-wide">Dot</span>
        </button>
        <button
          type="button"
          onClick={() => press("-")}
          className="flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-[#3a4554] bg-[#141820] text-[#e8edf4] transition active:translate-y-px active:bg-[#0a0c10] sm:min-h-16"
          aria-label="Dash"
        >
          <span className="inline-block h-2 w-8 rounded-[2px] bg-[#39ff6a] shadow-[0_0_10px_rgba(57,255,106,0.7)]" />
          <span className="font-heading text-sm font-semibold tracking-wide">Dash</span>
        </button>
        <button
          type="button"
          onClick={resetPath}
          className="col-span-2 rounded-lg py-1.5 text-xs font-semibold text-[#8b95a5] transition hover:text-[#e8edf4]"
        >
          Reset path
        </button>
      </div>
    </div>
  );
}
