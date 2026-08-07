"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FamilyTreePerson, FamilyTreeViewMode } from "@/lib/familyTree/types";
import {
  buildTreeLayout,
  NODE_RADIUS,
  shortDisplayName,
} from "@/lib/familyTree/layout";
import type { buildRelationIndex } from "@/lib/familyTree/relations";
import PersonContextMenu, { type ContextMenuAction } from "./PersonContextMenu";

type Index = ReturnType<typeof buildRelationIndex>;

type Props = {
  index: Index;
  focusId: string;
  viewMode: FamilyTreeViewMode;
  onSelectPerson: (id: string) => void;
  onViewModeChange: (mode: FamilyTreeViewMode) => void;
  onPersonAction: (person: FamilyTreePerson, action: ContextMenuAction) => void;
  linkMode?: boolean;
};

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.4;
const MALE = "#4f8fd9";
const FEMALE = "#e0894a";
const UNKNOWN = "#8b95a5";

function genderColor(gender: string): string {
  if (gender === "male") return MALE;
  if (gender === "female") return FEMALE;
  return UNKNOWN;
}

function pointsToPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function Silhouette() {
  return (
    <g>
      <circle cx="0" cy="-6" r="9" fill="rgba(255,255,255,0.92)" />
      <path d="M -16 22 C -14 8 -8 4 0 4 C 8 4 14 8 16 22 Z" fill="rgba(255,255,255,0.92)" />
    </g>
  );
}

const VIEW_MODES: Array<{ id: FamilyTreeViewMode; label: string; hint: string }> = [
  { id: "child", label: "Child", hint: "Kids only" },
  { id: "child_spouse", label: "Child & spouse", hint: "Kids + their partners" },
  {
    id: "siblings_child_spouse",
    label: "Siblings + child & spouse",
    hint: "Siblings, kids, and kids' partners",
  },
  { id: "grandchild", label: "Grandchild", hint: "Two generations" },
  { id: "unlimited", label: "Unlimited", hint: "All descendants" },
];

export default function FamilyTreeCanvas({
  index,
  focusId,
  viewMode,
  onSelectPerson,
  onViewModeChange,
  onPersonAction,
  linkMode = false,
}: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [viewport, setViewport] = useState({ w: 800, h: 560 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origTx: number;
    origTy: number;
  } | null>(null);
  const longPressRef = useRef<{
    personId: string;
    timer: ReturnType<typeof setTimeout>;
    x: number;
    y: number;
  } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [menu, setMenu] = useState<{
    person: FamilyTreePerson;
    x: number;
    y: number;
  } | null>(null);

  function openMenu(person: FamilyTreePerson, clientX: number, clientY: number) {
    setMenu({ person, x: clientX, y: clientY });
  }

  useEffect(() => {
    if (!isFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Context menu owns the first Escape; a second Escape exits fullscreen.
      if (menu) return;
      e.preventDefault();
      setIsFullscreen(false);
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [isFullscreen, menu]);

  function clearLongPress() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current.timer);
      longPressRef.current = null;
    }
  }

  const layout = useMemo(
    () => buildTreeLayout(index, focusId, viewMode),
    [index, focusId, viewMode]
  );

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setViewport({ w: rect.width, h: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);

    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((prev) => {
        const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
        const cx = el.clientWidth / 2;
        const cy = el.clientHeight / 2;
        setTx((t) => cx - ((cx - t) / prev) * next);
        setTy((t) => cy - ((cy - t) / prev) * next);
        return next;
      });
    };
    el.addEventListener("wheel", onWheelNative, { passive: false });

    return () => {
      ro.disconnect();
      el.removeEventListener("wheel", onWheelNative);
    };
  }, []);

  // Center the focus person whenever focus, mode, or viewport changes.
  useEffect(() => {
    if (!layout) return;
    setTx(viewport.w / 2 - layout.focusX * scale);
    setTy(viewport.h / 2 - layout.focusY * scale);
    // scale intentionally omitted: zoom should keep current pan; recenter button restores focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, viewMode, layout, viewport.w, viewport.h]);

  function recenter() {
    if (!layout) return;
    setTx(viewport.w / 2 - layout.focusX * scale);
    setTy(viewport.h / 2 - layout.focusY * scale);
  }

  function zoomBy(factor: number) {
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev * factor));
      const cx = viewport.w / 2;
      const cy = viewport.h / 2;
      setTx((t) => cx - ((cx - t) / prev) * next);
      setTy((t) => cy - ((cy - t) / prev) * next);
      return next;
    });
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origTx: tx,
      origTy: ty,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    setTx(drag.origTx + (e.clientX - drag.startX));
    setTy(drag.origTy + (e.clientY - drag.startY));
  }

  function onPointerUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
  }

  const people = useMemo(() => {
    return [...index.byId.values()].sort((a, b) =>
      shortDisplayName(a).localeCompare(shortDisplayName(b), undefined, { sensitivity: "base" })
    );
  }, [index]);

  const filtered = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return people.slice(0, 40);
    return people
      .filter((p) => {
        const hay = shortDisplayName(p).toLowerCase();
        return terms.every((t) => hay.includes(t));
      })
      .slice(0, 40);
  }, [people, query]);

  if (!layout) {
    return (
      <div className="flex min-h-[28rem] items-center justify-center rounded-2xl border border-[var(--color-ink)]/10 bg-[#f3efe6] text-sm text-[var(--color-ink-muted)]">
        Select a person to view their tree.
      </div>
    );
  }

  return (
    <>
    {isFullscreen ? (
      <div className="h-[min(72vh,40rem)] w-full" aria-hidden />
    ) : null}
    <div
      className={`relative overflow-hidden border border-[var(--color-ink)]/10 bg-[#f3efe6] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] ${
        isFullscreen
          ? "fixed inset-0 z-[70] rounded-none border-0"
          : "rounded-2xl"
      }`}
    >
      <div
        ref={viewportRef}
        className={`relative w-full touch-none ${
          isFullscreen ? "h-dvh" : "h-[min(72vh,40rem)]"
        } ${linkMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg className="absolute inset-0 h-full w-full" aria-label="Family tree">
          <g transform={`translate(${tx} ${ty}) scale(${scale})`}>
            {layout.edges.map((edge) => (
              <path
                key={edge.id}
                d={pointsToPath(edge.points)}
                fill="none"
                stroke="#9aa3b2"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}

            {layout.marriages.map((m) => (
              <g key={m.id} transform={`translate(${m.x} ${m.y})`}>
                <circle r={11} fill="#f7f2ea" stroke="#c4a484" strokeWidth={2} />
                <path
                  d="M -5 -2 C -7 -6 -2 -7 0 -3 C 2 -7 7 -6 5 -2 C 7 1 3 6 0 4 C -3 6 -7 1 -5 -2 Z"
                  fill="#d0894a"
                  opacity={0.9}
                />
              </g>
            ))}

            {layout.people.map((node) => {
              const color = genderColor(node.person.gender);
              const label = shortDisplayName(node.person);
              const photo = node.person.photoUrl;
              const clipId = `ft-clip-${node.id}`;
              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x} ${node.y})`}
                  className="cursor-pointer"
                  onPointerDown={(e) => {
                    // Don't start a canvas drag when tapping a person.
                    e.stopPropagation();
                    if (e.button === 2) return;
                    clearLongPress();
                    longPressRef.current = {
                      personId: node.person.id,
                      x: e.clientX,
                      y: e.clientY,
                      timer: setTimeout(() => {
                        if (!longPressRef.current) return;
                        openMenu(node.person, longPressRef.current.x, longPressRef.current.y);
                        longPressRef.current = null;
                      }, 520),
                    };
                  }}
                  onPointerMove={(e) => {
                    const lp = longPressRef.current;
                    if (!lp || lp.personId !== node.person.id) return;
                    if (
                      Math.abs(e.clientX - lp.x) > 8 ||
                      Math.abs(e.clientY - lp.y) > 8
                    ) {
                      clearLongPress();
                    }
                  }}
                  onPointerUp={() => clearLongPress()}
                  onPointerCancel={() => clearLongPress()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (menu) {
                      setMenu(null);
                      return;
                    }
                    onSelectPerson(node.person.id);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    clearLongPress();
                    openMenu(node.person, e.clientX, e.clientY);
                  }}
                >
                  <defs>
                    <clipPath id={clipId}>
                      <circle r={NODE_RADIUS - 2} />
                    </clipPath>
                  </defs>
                  {node.isFocus ? (
                    <circle r={NODE_RADIUS + 5} fill="rgba(224,137,74,0.22)" />
                  ) : null}
                  <circle
                    r={NODE_RADIUS}
                    fill={color}
                    stroke={node.isFocus ? "#c45f1a" : "rgba(255,255,255,0.75)"}
                    strokeWidth={node.isFocus ? 3.5 : 2}
                  />
                  {photo ? (
                    <image
                      href={photo}
                      x={-(NODE_RADIUS - 2)}
                      y={-(NODE_RADIUS - 2)}
                      width={(NODE_RADIUS - 2) * 2}
                      height={(NODE_RADIUS - 2) * 2}
                      clipPath={`url(#${clipId})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  ) : (
                    <Silhouette />
                  )}
                  <rect
                    x={-54}
                    y={NODE_RADIUS + 6}
                    width={108}
                    height={22}
                    rx={5}
                    fill="rgba(255,255,255,0.96)"
                    stroke="rgba(0,0,0,0.06)"
                  />
                  <text
                    y={NODE_RADIUS + 21}
                    textAnchor="middle"
                    fontSize={11}
                    fontWeight={650}
                    fill="#2b3340"
                    style={{ fontFamily: "var(--font-body), sans-serif" }}
                  >
                    {label.length > 16 ? `${label.slice(0, 15)}…` : label}
                  </text>
                  <title>{label}</title>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="pointer-events-auto absolute bottom-3 left-3 flex flex-col overflow-hidden rounded-xl bg-[#e0894a] shadow-lg">
        {VIEW_MODES.map((mode) => {
          const active = viewMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              title={mode.hint}
              onClick={() => onViewModeChange(mode.id)}
              className={`min-h-11 min-w-[9.5rem] max-w-[11rem] px-3 text-left text-[10px] font-bold uppercase leading-snug tracking-wide transition sm:text-xs ${
                active
                  ? "bg-[#c45f1a] text-white"
                  : "bg-[#e0894a] text-white/95 hover:bg-[#d47a38]"
              }`}
            >
              {mode.label}
            </button>
          );
        })}
      </div>

      <div className="pointer-events-auto absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-xl bg-[#e0894a] shadow-lg">
        <button
          type="button"
          aria-label="Zoom in"
          className="flex min-h-11 min-w-11 items-center justify-center text-xl font-bold text-white hover:bg-[#d47a38]"
          onClick={() => zoomBy(1.15)}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          className="flex min-h-11 min-w-11 items-center justify-center text-xl font-bold text-white hover:bg-[#d47a38]"
          onClick={() => zoomBy(1 / 1.15)}
        >
          −
        </button>
        <button
          type="button"
          aria-label="Center on selected person"
          className="flex min-h-11 min-w-11 items-center justify-center text-white hover:bg-[#d47a38]"
          onClick={recenter}
          title="Center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
            <path
              d="M12 3v3M12 18v3M3 12h3M18 12h3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="pointer-events-auto absolute right-3 top-3 flex flex-col items-end gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[#e0894a] text-white shadow-lg hover:bg-[#d47a38]"
            onClick={() => setIsFullscreen((v) => !v)}
          >
            {isFullscreen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
          <button
            type="button"
            aria-label="Search people"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl bg-[#e0894a] text-white shadow-lg hover:bg-[#d47a38]"
            onClick={() => setSearchOpen((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {searchOpen ? (
          <div className="w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-black/10 bg-white/95 p-2 shadow-xl backdrop-blur">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find someone…"
              className="w-full min-h-11 rounded-lg border border-black/10 px-3 text-sm outline-none focus:border-[#e0894a]"
              autoFocus
            />
            <ul className="mt-2 max-h-56 overflow-y-auto">
              {filtered.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    className={`flex w-full min-h-10 items-center rounded-lg px-2 text-left text-sm ${
                      person.id === focusId
                        ? "bg-[#e0894a]/15 font-semibold"
                        : "hover:bg-black/5"
                    }`}
                    onClick={() => {
                      onSelectPerson(person.id);
                      setSearchOpen(false);
                      setQuery("");
                    }}
                  >
                    <span
                      className="mr-2 inline-block h-3 w-3 rounded-full"
                      style={{ background: genderColor(person.gender) }}
                    />
                    {shortDisplayName(person)}
                  </button>
                </li>
              ))}
              {filtered.length === 0 ? (
                <li className="px-2 py-3 text-sm text-[var(--color-ink-muted)]">No matches.</li>
              ) : null}
            </ul>
          </div>
        ) : null}
      </div>

      {menu ? (
        <PersonContextMenu
          person={menu.person}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onAction={(action) => onPersonAction(menu.person, action)}
        />
      ) : null}
    </div>
    </>
  );
}
