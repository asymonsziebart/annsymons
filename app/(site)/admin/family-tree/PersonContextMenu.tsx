"use client";

import { useEffect, useRef } from "react";
import { personDisplayName, shortName } from "./radialMenuHelpers";
import type { FamilyTreePerson } from "@/lib/familyTree/types";

export type ContextMenuAction =
  | { type: "edit" }
  | { type: "photo" }
  | { type: "delete" }
  | { type: "add-parents" }
  | { type: "add-spouse" }
  | { type: "add-child" }
  | { type: "unlink" }
  | { type: "link" };

type Props = {
  person: FamilyTreePerson;
  x: number;
  y: number;
  onAction: (action: ContextMenuAction) => void;
  onClose: () => void;
};

type Segment = {
  id: string;
  label: string;
  action: ContextMenuAction;
  icon: "delete" | "parents" | "spouse" | "child" | "unlink" | "link";
};

/** Clockwise from upper-left, matching the Quick Family Tree radial menu. */
const SEGMENTS: Segment[] = [
  { id: "delete", label: "Delete", action: { type: "delete" }, icon: "delete" },
  { id: "parents", label: "Add parents", action: { type: "add-parents" }, icon: "parents" },
  { id: "spouse", label: "Add a spouse", action: { type: "add-spouse" }, icon: "spouse" },
  { id: "child", label: "Add a child", action: { type: "add-child" }, icon: "child" },
  { id: "unlink", label: "Unlink", action: { type: "unlink" }, icon: "unlink" },
  { id: "link", label: "Link", action: { type: "link" }, icon: "link" },
];

const SIZE = 340;
const CX = SIZE / 2;
const CY = SIZE / 2;
const INNER = 62;
const OUTER = 118;
const LABEL_R = 148;
/** Start at upper-left, going clockwise (SVG: 0° = east, clockwise positive). */
const START_DEG = -150;

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function polar(r: number, deg: number): { x: number; y: number } {
  const a = degToRad(deg);
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function wedgePath(startDeg: number, endDeg: number): string {
  const r0 = INNER + 4;
  const r1 = OUTER;
  const p0 = polar(r0, startDeg);
  const p1 = polar(r1, startDeg);
  const p2 = polar(r1, endDeg);
  const p3 = polar(r0, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${p0.x} ${p0.y}`,
    `L ${p1.x} ${p1.y}`,
    `A ${r1} ${r1} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${r0} ${r0} 0 ${large} 0 ${p0.x} ${p0.y}`,
    "Z",
  ].join(" ");
}

function SegmentIcon({ type }: { type: Segment["icon"] }) {
  const stroke = "#e0894a";
  const fill = "none";
  switch (type) {
    case "delete":
      return (
        <g stroke={stroke} strokeWidth="2" fill={fill} strokeLinecap="round">
          <path d="M-7 -4 h14" />
          <path d="M-5 -4 v12 a2 2 0 0 0 2 2 h6 a2 2 0 0 0 2 -2 v-12" />
          <path d="M-3 -4 v-2 h6 v2" />
        </g>
      );
    case "parents":
      return (
        <g stroke={stroke} strokeWidth="2" fill={fill} strokeLinecap="round">
          <circle cx="-8" cy="-4" r="3.5" />
          <circle cx="8" cy="-4" r="3.5" />
          <path d="M-8 0 h16" />
          <path d="M0 0 v10" />
          <circle cx="0" cy="13" r="2.5" />
        </g>
      );
    case "spouse":
      return (
        <g stroke={stroke} strokeWidth="2" fill={fill} strokeLinecap="round">
          <circle cx="-9" cy="0" r="3.5" />
          <circle cx="9" cy="0" r="3.5" />
          <path d="M-4 0 h8" />
          <path d="M-2 -2.5 l2.5 2.5 -2.5 2.5" />
          <path d="M2 -2.5 l-2.5 2.5 2.5 2.5" />
        </g>
      );
    case "child":
      return (
        <g stroke={stroke} strokeWidth="2" fill={fill} strokeLinecap="round">
          <path d="M0 -10 v14" />
          <path d="M-8 -2 h16" />
          <circle cx="0" cy="8" r="3.5" />
        </g>
      );
    case "unlink":
      return (
        <g stroke={stroke} strokeWidth="2" fill={fill} strokeLinecap="round">
          <path d="M-8 -4 a4 4 0 0 1 0 -8 h3" />
          <path d="M8 4 a4 4 0 0 1 0 8 h-3" transform="translate(0 -8)" />
          <path d="M-2 -2 l4 4" />
          <path d="M2 -2 l-4 4" />
        </g>
      );
    case "link":
      return (
        <g stroke={stroke} strokeWidth="2" fill={fill} strokeLinecap="round">
          <path d="M-3 -5 a4 4 0 0 1 0 -8 h4 a4 4 0 0 1 0 8" transform="translate(0 5)" />
          <path d="M3 5 a4 4 0 0 1 0 8 h-4 a4 4 0 0 1 0 -8" transform="translate(0 -5)" />
        </g>
      );
  }
}

function genderColor(gender: string): string {
  if (gender === "male") return "#4f8fd9";
  if (gender === "female") return "#e0894a";
  return "#8b95a5";
}

export default function PersonContextMenu({ person, x, y, onAction, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const slice = 360 / SEGMENTS.length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onPointer(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [onClose]);

  const half = SIZE / 2;
  const left = Math.max(8, Math.min(x - half, window.innerWidth - SIZE - 8));
  const top = Math.max(8, Math.min(y - half, window.innerHeight - SIZE - 8));
  const label = shortName(person);
  const photo = person.photoUrl;

  return (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        className="absolute"
        style={{ left, top, width: SIZE, height: SIZE }}
        role="menu"
        aria-label={`Options for ${personDisplayName(person)}`}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          {/* Dimmed disc behind wedges */}
          <circle cx={CX} cy={CY} r={OUTER + 8} fill="rgba(40,40,40,0.45)" />

          {SEGMENTS.map((seg, i) => {
            const start = START_DEG + i * slice;
            const end = start + slice;
            const mid = start + slice / 2;
            const iconPos = polar((INNER + OUTER) / 2 + 2, mid);
            const labelPos = polar(LABEL_R, mid);
            return (
              <g key={seg.id}>
                <path
                  d={wedgePath(start, end)}
                  fill="rgba(255,255,255,0.96)"
                  stroke="rgba(0,0,0,0.06)"
                  strokeWidth={1}
                  className="cursor-pointer transition hover:fill-[#fff6ee]"
                  onClick={() => {
                    onAction(seg.action);
                    onClose();
                  }}
                />
                <g
                  transform={`translate(${iconPos.x} ${iconPos.y})`}
                  className="pointer-events-none"
                >
                  <SegmentIcon type={seg.icon} />
                </g>
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none select-none"
                  fontSize={11}
                  fontWeight={600}
                  fill="#2b3340"
                  style={{ fontFamily: "var(--font-body), sans-serif" }}
                >
                  {seg.label}
                </text>
              </g>
            );
          })}

          {/* Center hub */}
          <circle cx={CX} cy={CY} r={INNER} fill="#ffffff" stroke="rgba(0,0,0,0.08)" />
          <circle cx={CX} cy={CY - 10} r={22} fill={genderColor(person.gender)} />
          {photo ? (
            <>
              <defs>
                <clipPath id="radial-photo-clip">
                  <circle cx={CX} cy={CY - 10} r={20} />
                </clipPath>
              </defs>
              <image
                href={photo}
                x={CX - 20}
                y={CY - 30}
                width={40}
                height={40}
                clipPath="url(#radial-photo-clip)"
                preserveAspectRatio="xMidYMid slice"
              />
            </>
          ) : (
            <g transform={`translate(${CX} ${CY - 10})`} fill="rgba(255,255,255,0.92)">
              <circle cx="0" cy="-4" r="6" />
              <path d="M -10 14 C -9 5 -5 3 0 3 C 5 3 9 5 10 14 Z" />
            </g>
          )}
          <rect
            x={CX - 42}
            y={CY + 14}
            width={84}
            height={18}
            rx={4}
            fill="rgba(255,255,255,0.98)"
            stroke="rgba(0,0,0,0.06)"
          />
          <text
            x={CX}
            y={CY + 27}
            textAnchor="middle"
            fontSize={11}
            fontWeight={700}
            fill="#2b3340"
          >
            {label.length > 14 ? `${label.slice(0, 13)}…` : label}
          </text>
        </svg>

        {/* Edit button under name in hub */}
        <button
          type="button"
          className="absolute left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-[#e0894a] text-white shadow-md transition hover:bg-[#d47a38]"
          style={{ top: CY + 36 }}
          title="Edit"
          aria-label="Edit"
          onClick={() => {
            onAction({ type: "edit" });
            onClose();
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 20h4l10-10-4-4L4 16v4z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path d="M13 7l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
