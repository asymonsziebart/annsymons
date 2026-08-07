"use client";

import { useEffect, useRef } from "react";
import { personDisplayName } from "@/lib/familyTree/relations";
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

const ITEMS: Array<{
  label: string;
  action: ContextMenuAction;
  danger?: boolean;
  separatorAfter?: boolean;
}> = [
  { label: "Edit", action: { type: "edit" } },
  { label: "Change photo", action: { type: "photo" }, separatorAfter: true },
  { label: "Add parents", action: { type: "add-parents" } },
  { label: "Add a spouse", action: { type: "add-spouse" } },
  { label: "Add a child", action: { type: "add-child" }, separatorAfter: true },
  { label: "Link", action: { type: "link" } },
  { label: "Unlink", action: { type: "unlink" }, separatorAfter: true },
  { label: "Delete", action: { type: "delete" }, danger: true },
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

  const menuWidth = 220;
  const menuHeight = 380;
  const left = Math.max(
    8,
    Math.min(x, (typeof window !== "undefined" ? window.innerWidth : x) - menuWidth - 8)
  );
  const top = Math.max(
    8,
    Math.min(y, (typeof window !== "undefined" ? window.innerHeight : y) - menuHeight - 8)
  );

  return (
    <div
      ref={ref}
      className="fixed z-[80] w-[220px] overflow-hidden rounded-xl border border-black/10 bg-white shadow-2xl"
      style={{ left, top }}
      role="menu"
      aria-label={`Options for ${personDisplayName(person)}`}
    >
      <div className="border-b border-black/5 px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
          {personDisplayName(person)}
        </p>
      </div>
      <ul className="py-1">
        {ITEMS.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              role="menuitem"
              className={`flex w-full min-h-11 items-center px-3 text-left text-sm font-medium transition hover:bg-[#e0894a]/12 ${
                item.danger ? "text-red-700" : "text-[var(--color-ink)]"
              }`}
              onClick={() => {
                onAction(item.action);
                onClose();
              }}
            >
              {item.label}
            </button>
            {item.separatorAfter ? (
              <div className="my-1 border-t border-black/5" aria-hidden />
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
