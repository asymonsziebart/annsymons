"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  defaultMorseLayout,
  loadMorseLayout,
  nextLabelSide,
  saveMorseLayout,
  type MorseLayout,
  type MorseLabelSide,
} from "@/lib/morse/layout";
import {
  MORSE_EDGES,
  MORSE_NODES,
  MORSE_VIEWBOX,
  childForSymbol,
  orthogonalPath,
  pathIds,
  type MorseSymbol,
} from "@/lib/morse/tree";

const IDLE_RESET_MS = 2500;
const INK = "#e8edf4";
const LED = "#39ff6a";
const SNAP = 2;

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

function labelOffset(label: MorseLabelSide): {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
} {
  switch (label) {
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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function snap(n: number) {
  return Math.round(n / SNAP) * SNAP;
}

type DragTarget =
  | { kind: "node"; id: string }
  | { kind: "hub" }
  | null;

export default function MorseTrainer() {
  const [sequence, setSequence] = useState("");
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<MorseLayout>(() => defaultMorseLayout());
  const [layoutReady, setLayoutReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{
    target: DragTarget;
    moved: boolean;
  }>({ target: null, moved: false });
  const playTone = useMorseAudio();

  useEffect(() => {
    setLayout(loadMorseLayout());
    setLayoutReady(true);
  }, []);

  useEffect(() => {
    if (!layoutReady) return;
    saveMorseLayout(layout);
  }, [layout, layoutReady]);

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
    if (editing) return;
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      setSequence("");
      idleTimerRef.current = null;
    }, IDLE_RESET_MS);
  }, [clearIdleTimer, editing]);

  const press = useCallback(
    (symbol: MorseSymbol) => {
      if (editing) return;
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
    [armIdleReset, editing, playTone],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (editing) return;
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
  }, [editing, press, resetPath]);

  useEffect(() => () => clearIdleTimer(), [clearIdleTimer]);

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return {
      x: clamp(snap(local.x), 8, MORSE_VIEWBOX.width - 8),
      y: clamp(snap(local.y), 8, MORSE_VIEWBOX.height - 8),
    };
  }, []);

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const target = dragRef.current.target;
      if (!target) return;
      dragRef.current.moved = true;
      const { x, y } = clientToSvg(event.clientX, event.clientY);
      setLayout((prev) => {
        if (target.kind === "hub") {
          return { ...prev, hub: { x, y } };
        }
        const current = prev.nodes[target.id];
        if (!current) return prev;
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [target.id]: { ...current, x, y },
          },
        };
      });
    },
    [clientToSvg],
  );

  const endDrag = useCallback(() => {
    const { target, moved } = dragRef.current;
    dragRef.current = { target: null, moved: false };
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", endDrag);
    // Tap without move on a letter node cycles label side
    if (editing && target?.kind === "node" && !moved && target.id !== "") {
      setLayout((prev) => {
        const current = prev.nodes[target.id];
        if (!current) return prev;
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [target.id]: { ...current, label: nextLabelSide(current.label) },
          },
        };
      });
    }
  }, [editing, onPointerMove]);

  const startDrag = useCallback(
    (target: Exclude<DragTarget, null>, event: ReactPointerEvent) => {
      if (!editing) return;
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = { target, moved: false };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
    },
    [editing, endDrag, onPointerMove],
  );

  const activeIds = new Set(sequence && !editing ? pathIds(sequence) : []);
  const tipLetter = useMemo(() => {
    if (!sequence || editing) return null;
    const base = MORSE_NODES.find((n) => n.id === sequence);
    return base?.letter ?? null;
  }, [editing, sequence]);

  const antenna = layout.nodes[""] ?? { x: 230, y: 46, label: "none" as const };
  const antennaLit = sequence.length > 0 && !editing;

  const rootEdge = useCallback(
    (toX: number, toY: number) => {
      const stemBottom = antenna.y + 20;
      return `M ${layout.hub.x} ${stemBottom} L ${layout.hub.x} ${layout.hub.y} L ${toX} ${toY}`;
    },
    [antenna.y, layout.hub.x, layout.hub.y],
  );

  const copyLayout = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(layout, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="morse-device mx-auto w-full max-w-[26rem] overflow-hidden rounded-[1.25rem] border border-[#cfd6e0] bg-[#0b0d11] shadow-[0_18px_40px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between gap-2 border-b border-[#2a3140] px-3 py-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[#8b95a5]">
          {editing ? "Edit layout" : "Practice"}
        </p>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => setLayout(defaultMorseLayout())}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-[#8b95a5] transition hover:text-[#e8edf4]"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => void copyLayout()}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-[#8b95a5] transition hover:text-[#e8edf4]"
              >
                {copied ? "Copied" : "Copy JSON"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  resetPath();
                }}
                className="rounded-lg bg-[#39ff6a]/15 px-2.5 py-1 text-xs font-semibold text-[#39ff6a]"
              >
                Done
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                resetPath();
                setEditing(true);
              }}
              className="rounded-lg border border-[#3a4554] px-2.5 py-1 text-xs font-semibold text-[#e8edf4] transition hover:bg-[#141820]"
            >
              Edit layout
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <p className="border-b border-[#2a3140] px-3 py-2 text-[0.7rem] leading-relaxed text-[#8b95a5]">
          Drag dots, dashes, antenna, or the center hub. Tap a letter node to cycle its label side.
          Layout saves on this device automatically.
        </p>
      ) : null}

      <div className="relative px-1.5 pt-2 sm:px-2 sm:pt-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MORSE_VIEWBOX.width} ${MORSE_VIEWBOX.height}`}
          className={`relative h-auto w-full select-none ${editing ? "touch-none cursor-grab active:cursor-grabbing" : ""}`}
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

          {editing ? (
            <g opacity="0.18" stroke="#94a3b8" strokeWidth="1">
              {Array.from({ length: 23 }, (_, i) => (
                <line key={`v${i}`} x1={i * 20} y1={0} x2={i * 20} y2={MORSE_VIEWBOX.height} />
              ))}
              {Array.from({ length: 26 }, (_, i) => (
                <line key={`h${i}`} x1={0} y1={i * 20} x2={MORSE_VIEWBOX.width} y2={i * 20} />
              ))}
            </g>
          ) : null}

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

          <g
            transform={`translate(${antenna.x} ${antenna.y})`}
            style={antennaLit ? { filter: "url(#morse-led-glow)" } : undefined}
            onPointerDown={(e) => startDrag({ kind: "node", id: "" }, e)}
            className={editing ? "cursor-grab" : undefined}
          >
            <path
              d="M0 20 L0 0 M0 0 L-11 -14 M0 0 L11 -14"
              fill="none"
              stroke={antennaLit ? LED : INK}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {editing ? <circle r={14} fill="transparent" /> : null}
          </g>

          {MORSE_EDGES.map((edge) => {
            const fromLayout = layout.nodes[edge.from];
            const toLayout = layout.nodes[edge.to];
            const fromMeta = MORSE_NODES.find((n) => n.id === edge.from);
            if (!fromLayout || !toLayout || !fromMeta) return null;
            const lit = activeIds.has(edge.from) && activeIds.has(edge.to);
            const d =
              fromMeta.kind === "root"
                ? rootEdge(toLayout.x, toLayout.y)
                : orthogonalPath(fromLayout.x, fromLayout.y, toLayout.x, toLayout.y);
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

          <g
            onPointerDown={(e) => startDrag({ kind: "hub" }, e)}
            className={editing ? "cursor-grab" : undefined}
          >
            <circle
              cx={layout.hub.x}
              cy={layout.hub.y}
              r={editing ? 7 : 2.2}
              fill={antennaLit ? LED : INK}
              style={antennaLit ? { filter: "url(#morse-led-glow)" } : undefined}
            />
            {editing ? (
              <circle cx={layout.hub.x} cy={layout.hub.y} r={14} fill="transparent" />
            ) : null}
          </g>

          {MORSE_NODES.filter((n) => n.kind !== "root").map((node) => {
            const pos = layout.nodes[node.id];
            if (!pos) return null;
            const lit = activeIds.has(node.id);
            const isTip = node.id === sequence && sequence.length > 0 && !editing;
            const fill = lit ? LED : INK;
            const offset = labelOffset(pos.label);
            return (
              <g
                key={node.id}
                transform={`translate(${pos.x} ${pos.y})`}
                onPointerDown={(e) => startDrag({ kind: "node", id: node.id }, e)}
                className={editing ? "cursor-grab" : undefined}
              >
                {editing ? <circle r={16} fill="rgba(57,255,106,0.08)" stroke="#39ff6a" strokeWidth="1" /> : null}
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
                {node.letter && pos.label !== "none" ? (
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

          {!editing ? (
            <>
              <text
                x="230"
                y="450"
                textAnchor="middle"
                fill={tipLetter ? LED : "#5b6472"}
                style={{
                  fontSize: 40,
                  fontWeight: 700,
                  fontFamily: "var(--font-heading), ui-sans-serif, system-ui, sans-serif",
                }}
              >
                {tipLetter ?? "·"}
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
            </>
          ) : (
            <text
              x="230"
              y="470"
              textAnchor="middle"
              fill="#64748b"
              style={{ fontSize: 12, fontFamily: "var(--font-heading), ui-sans-serif, system-ui, sans-serif" }}
            >
              Drag parts into place
            </text>
          )}
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-[#2a3140] bg-[#0b0d11] p-2.5 sm:p-3">
        <button
          type="button"
          onClick={() => press(".")}
          disabled={editing}
          className="flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-[#3a4554] bg-[#141820] text-[#e8edf4] transition active:translate-y-px active:bg-[#0a0c10] disabled:opacity-40 sm:min-h-16"
          aria-label="Dot"
        >
          <span className="inline-block h-3 w-3 rounded-full bg-[#39ff6a] shadow-[0_0_10px_rgba(57,255,106,0.7)]" />
          <span className="font-heading text-sm font-semibold tracking-wide">Dot</span>
        </button>
        <button
          type="button"
          onClick={() => press("-")}
          disabled={editing}
          className="flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-xl border border-[#3a4554] bg-[#141820] text-[#e8edf4] transition active:translate-y-px active:bg-[#0a0c10] disabled:opacity-40 sm:min-h-16"
          aria-label="Dash"
        >
          <span className="inline-block h-2 w-8 rounded-[2px] bg-[#39ff6a] shadow-[0_0_10px_rgba(57,255,106,0.7)]" />
          <span className="font-heading text-sm font-semibold tracking-wide">Dash</span>
        </button>
        <button
          type="button"
          onClick={resetPath}
          disabled={editing}
          className="col-span-2 rounded-lg py-1.5 text-xs font-semibold text-[#8b95a5] transition hover:text-[#e8edf4] disabled:opacity-40"
        >
          Reset path
        </button>
      </div>
    </div>
  );
}
