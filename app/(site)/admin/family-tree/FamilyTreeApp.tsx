"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { FamilyTreeData, FamilyTreeViewMode } from "@/lib/familyTree/types";
import {
  buildRelationIndex,
  lifespanLabel,
  personDisplayName,
} from "@/lib/familyTree/relations";
import FamilyTreeCanvas from "./FamilyTreeCanvas";

type Props = {
  initialTree: FamilyTreeData;
  dbReady: boolean;
};

export default function FamilyTreeApp({ initialTree, dbReady }: Props) {
  const [tree, setTree] = useState(initialTree);
  const [focusId, setFocusId] = useState(
    initialTree.defaultFocusId ?? initialTree.people[0]?.id ?? ""
  );
  const [viewMode, setViewMode] = useState<FamilyTreeViewMode>("child_spouse");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => buildRelationIndex(tree), [tree]);
  const focus = focusId ? index.byId.get(focusId) : undefined;
  const focusLife = focus ? lifespanLabel(focus) : "";

  function selectPerson(id: string) {
    startTransition(() => {
      setFocusId(id);
      setError("");
    });
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    if (!dbReady) {
      setError("Database is not configured, so uploads cannot be saved yet.");
      return;
    }

    setUploading(true);
    setError("");
    setStatus("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/admin/family-tree", { method: "POST", body });
      const data = (await res.json()) as {
        error?: string;
        tree?: FamilyTreeData;
        imported?: { people: number; families: number };
      };
      if (!res.ok || !data.tree) {
        throw new Error(data.error || "Upload failed");
      }
      setTree(data.tree);
      setFocusId(data.tree.defaultFocusId ?? data.tree.people[0]?.id ?? "");
      setStatus(
        `Imported ${data.imported?.people ?? data.tree.people.length} people from ${file.name}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-ink)]/10 bg-[var(--color-surface)]/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {tree.people.length} people · {tree.families.length} family links
            {tree.sourceFilename ? ` · ${tree.sourceFilename}` : ""}
          </p>
          {focus ? (
            <p className="mt-1 text-sm text-[var(--color-ink)]">
              Centered on <span className="font-semibold">{personDisplayName(focus)}</span>
              {focusLife ? ` · ${focusLife}` : ""}
            </p>
          ) : null}
          {!dbReady ? (
            <p className="mt-1 text-xs text-amber-700">
              Showing bundled tree. Set DATABASE_URL to save future uploads.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".ftz,.ftt,application/zip"
            className="sr-only"
            onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            className="neo-btn-primary !min-h-11"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? "Importing…" : "Upload .ftz"}
          </button>
        </div>
      </div>

      {status ? (
        <p className="text-sm text-emerald-700" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <FamilyTreeCanvas
        index={index}
        focusId={focusId}
        viewMode={viewMode}
        onSelectPerson={selectPerson}
        onViewModeChange={setViewMode}
      />

      <p className="text-xs text-[var(--color-ink-muted)]">
        Tap a circle to center that person. Drag to pan, use +/− to zoom. Custom photos per person
        are next.
      </p>
    </div>
  );
}
