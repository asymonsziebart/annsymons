"use client";

import { useEffect, useRef } from "react";
import { personDisplayName } from "@/lib/familyTree/relations";
import type { FamilyTreePerson } from "@/lib/familyTree/types";
import type { AddRelativeKind } from "@/lib/familyTree/mutations";

export type ContextMenuAction =
  | { type: "edit" }
  | { type: "photo" }
  | { type: "clear-photo" }
  | { type: "add-relative"; kind: AddRelativeKind }
  | { type: "delete" }
  | { type: "center" };

type Props = {
  person: FamilyTreePerson;
  x: number;
  y: number;
  onAction: (action: ContextMenuAction) => void;
  onClose: () => void;
};

const ITEMS: Array<{
  label: string;
  action: ContextMenuAction;
  danger?: boolean;
}> = [
  { label: "Edit details", action: { type: "edit" } },
  { label: "Change photo", action: { type: "photo" } },
  { label: "Remove photo", action: { type: "clear-photo" } },
  { label: "Center on person", action: { type: "center" } },
  { label: "Add father", action: { type: "add-relative", kind: "father" } },
  { label: "Add mother", action: { type: "add-relative", kind: "mother" } },
  { label: "Add spouse", action: { type: "add-relative", kind: "spouse" } },
  { label: "Add son", action: { type: "add-relative", kind: "son" } },
  { label: "Add daughter", action: { type: "add-relative", kind: "daughter" } },
  { label: "Delete person", action: { type: "delete" }, danger: true },
];

export default function PersonContextMenu({ person, x, y, onAction, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

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

  // Keep menu on screen
  const style: React.CSSProperties = {
    left: Math.min(x, typeof window !== "undefined" ? window.innerWidth - 220 : x),
    top: Math.min(y, typeof window !== "undefined" ? window.innerHeight - 420 : y),
  };

  return (
    <div
      ref={ref}
      className="fixed z-[80] w-52 overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl"
      style={style}
      role="menu"
      aria-label={`Options for ${personDisplayName(person)}`}
    >
      <div className="border-b border-black/5 px-3 py-2">
        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
          {personDisplayName(person)}
        </p>
        <p className="text-[11px] text-[var(--color-ink-muted)]">Right-click menu</p>
      </div>
      <ul className="py-1">
        {ITEMS.map((item) => {
          if (item.action.type === "clear-photo" && !person.photoUrl) return null;
          return (
            <li key={item.label}>
              <button
                type="button"
                role="menuitem"
                className={`flex w-full min-h-10 items-center px-3 text-left text-sm transition hover:bg-black/5 ${
                  item.danger ? "text-red-700" : "text-[var(--color-ink)]"
                }`}
                onClick={() => {
                  onAction(item.action);
                  onClose();
                }}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
