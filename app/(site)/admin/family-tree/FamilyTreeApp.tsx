"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { FamilyTreeData, FamilyTreePerson, FamilyTreeViewMode } from "@/lib/familyTree/types";
import {
  buildRelationIndex,
  lifespanLabel,
  personDisplayName,
} from "@/lib/familyTree/relations";
import {
  addRelative,
  removePerson,
  updatePerson,
} from "@/lib/familyTree/mutations";
import FamilyTreeCanvas from "./FamilyTreeCanvas";
import PersonEditDialog from "./PersonEditDialog";
import type { ContextMenuAction } from "./PersonContextMenu";

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
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<FamilyTreePerson | null>(null);
  const [, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const photoPersonIdRef = useRef<string | null>(null);

  const index = useMemo(() => buildRelationIndex(tree), [tree]);
  const focus = focusId ? index.byId.get(focusId) : undefined;
  const focusLife = focus ? lifespanLabel(focus) : "";

  function selectPerson(id: string) {
    startTransition(() => {
      setFocusId(id);
      setError("");
    });
  }

  async function apiAction(body: Record<string, unknown>): Promise<{
    tree: FamilyTreeData;
    newPersonId?: string;
  }> {
    if (!dbReady) {
      // Apply locally for preview without DB.
      const personId = String(body.personId || "");
      const action = String(body.action || "update");
      if (action === "delete") {
        return { tree: removePerson(tree, personId) };
      }
      if (action === "add-relative") {
        return addRelative(tree, personId, body.kind as "father" | "mother" | "spouse" | "son" | "daughter");
      }
      if (action === "clear-photo") {
        return { tree: updatePerson(tree, personId, { photoUrl: null }) };
      }
      return {
        tree: updatePerson(tree, personId, {
          given: typeof body.given === "string" ? body.given : undefined,
          surname: typeof body.surname === "string" ? body.surname : undefined,
          middle: typeof body.middle === "string" ? body.middle : undefined,
          gender:
            body.gender === "male" || body.gender === "female" || body.gender === "unknown"
              ? body.gender
              : undefined,
          birth: (body.birth as never) ?? undefined,
          death: (body.death as never) ?? undefined,
        }),
      };
    }

    const res = await fetch("/api/admin/family-tree/person", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as {
      error?: string;
      tree?: FamilyTreeData;
      newPersonId?: string;
    };
    if (!res.ok || !data.tree) throw new Error(data.error || "Update failed");
    return { tree: data.tree, newPersonId: data.newPersonId };
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

  async function onPhotoSelected(file: File | null) {
    const personId = photoPersonIdRef.current;
    photoPersonIdRef.current = null;
    if (!file || !personId) return;
    if (!dbReady) {
      setError("Database is not configured, so photos cannot be saved yet.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("personId", personId);
      body.append("photo", file);
      const res = await fetch("/api/admin/family-tree/person", { method: "PATCH", body });
      const data = (await res.json()) as { error?: string; tree?: FamilyTreeData };
      if (!res.ok || !data.tree) throw new Error(data.error || "Photo upload failed");
      setTree(data.tree);
      setStatus("Photo updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setBusy(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  }

  async function handlePersonAction(person: FamilyTreePerson, action: ContextMenuAction) {
    setError("");
    setStatus("");

    if (action.type === "center") {
      selectPerson(person.id);
      return;
    }
    if (action.type === "edit") {
      setEditing(person);
      return;
    }
    if (action.type === "photo") {
      photoPersonIdRef.current = person.id;
      photoRef.current?.click();
      return;
    }

    if (action.type === "delete") {
      const ok = window.confirm(
        `Delete ${personDisplayName(person)} from the family tree? This cannot be undone.`
      );
      if (!ok) return;
    }

    setBusy(true);
    try {
      if (action.type === "clear-photo") {
        const { tree: next } = await apiAction({
          personId: person.id,
          action: "clear-photo",
        });
        setTree(next);
        setStatus("Photo removed.");
        return;
      }
      if (action.type === "delete") {
        const { tree: next } = await apiAction({
          personId: person.id,
          action: "delete",
        });
        setTree(next);
        if (focusId === person.id) {
          setFocusId(next.defaultFocusId ?? next.people[0]?.id ?? "");
        }
        setStatus(`Deleted ${personDisplayName(person)}.`);
        return;
      }
      if (action.type === "add-relative") {
        const { tree: next, newPersonId } = await apiAction({
          personId: person.id,
          action: "add-relative",
          kind: action.kind,
        });
        setTree(next);
        if (newPersonId) {
          setFocusId(newPersonId);
          const created = next.people.find((p) => p.id === newPersonId);
          if (created) setEditing(created);
        }
        setStatus(`Added ${action.kind}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-ink)]/10 bg-[var(--color-surface)]/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {tree.people.length} people · {tree.families.length} family links
            {tree.sourceFilename ? ` · ${tree.sourceFilename}` : ""}
            {busy ? " · Saving…" : ""}
          </p>
          {focus ? (
            <p className="mt-1 text-sm text-[var(--color-ink)]">
              Centered on <span className="font-semibold">{personDisplayName(focus)}</span>
              {focusLife ? ` · ${focusLife}` : ""}
            </p>
          ) : null}
          {!dbReady ? (
            <p className="mt-1 text-xs text-amber-700">
              Showing bundled tree. Set DATABASE_URL to save edits and photos permanently.
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
          <input
            ref={photoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            onChange={(e) => void onPhotoSelected(e.target.files?.[0] ?? null)}
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
        onPersonAction={(person, action) => void handlePersonAction(person, action)}
      />

      <p className="text-xs text-[var(--color-ink-muted)]">
        Tap a circle to center that person. Right-click (or press and hold) a circle for edit,
        photo, and add-relative options. Drag to pan, use +/− to zoom.
      </p>

      {editing ? (
        <PersonEditDialog
          person={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            const { tree: next } = await apiAction({
              personId: editing.id,
              action: "update",
              ...patch,
            });
            setTree(next);
            setStatus("Details saved.");
          }}
        />
      ) : null}
    </div>
  );
}
