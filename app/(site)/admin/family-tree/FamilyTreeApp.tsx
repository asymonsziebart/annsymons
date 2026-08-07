"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { FamilyTreeData, FamilyTreePerson } from "@/lib/familyTree/types";
import {
  buildRelationIndex,
  lifespanLabel,
  personDisplayName,
} from "@/lib/familyTree/relations";

type Props = {
  initialTree: FamilyTreeData;
  dbReady: boolean;
};

function PersonChip({
  person,
  onSelect,
  emphasized,
}: {
  person: FamilyTreePerson;
  onSelect: (id: string) => void;
  emphasized?: boolean;
}) {
  const life = lifespanLabel(person);
  return (
    <button
      type="button"
      onClick={() => onSelect(person.id)}
      className={`min-h-11 rounded-xl border px-3 py-2 text-left transition ${
        emphasized
          ? "border-[var(--color-accent)] bg-[var(--color-accent)]/10 shadow-sm"
          : "border-[var(--color-ink)]/15 bg-[var(--color-surface)] hover:border-[var(--color-accent)]/50"
      }`}
    >
      <span className="block font-medium text-[var(--color-ink)]">{personDisplayName(person)}</span>
      {life ? (
        <span className="mt-0.5 block text-xs text-[var(--color-ink-muted)]">{life}</span>
      ) : null}
    </button>
  );
}

function RelationSection({
  title,
  people,
  onSelect,
}: {
  title: string;
  people: FamilyTreePerson[];
  onSelect: (id: string) => void;
}) {
  if (people.length === 0) return null;
  return (
    <section className="mt-5">
      <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
        {title}
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {people.map((person) => (
          <PersonChip key={person.id} person={person} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}

export default function FamilyTreeApp({ initialTree, dbReady }: Props) {
  const [tree, setTree] = useState(initialTree);
  const [query, setQuery] = useState("");
  const [focusId, setFocusId] = useState(
    initialTree.defaultFocusId ?? initialTree.people[0]?.id ?? ""
  );
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const index = useMemo(() => buildRelationIndex(tree), [tree]);
  const relations = focusId ? index.getRelations(focusId) : null;

  const sortedPeople = useMemo(() => {
    return [...tree.people].sort((a, b) =>
      personDisplayName(a).localeCompare(personDisplayName(b), undefined, { sensitivity: "base" })
    );
  }, [tree.people]);

  const filteredPeople = useMemo(() => {
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    if (terms.length === 0) return sortedPeople;
    return sortedPeople.filter((person) => {
      const hay = [
        personDisplayName(person),
        person.surname,
        person.given,
        lifespanLabel(person),
        person.gender,
      ]
        .join(" ")
        .toLowerCase();
      return terms.every((term) => hay.includes(term));
    });
  }, [sortedPeople, query]);

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

  const focusLife = relations ? lifespanLabel(relations.person) : "";

  return (
    <div className="mt-8 space-y-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--color-ink)]/10 bg-[var(--color-surface)]/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-sm text-[var(--color-ink-muted)]">
            {tree.people.length} people · {tree.families.length} family links
            {tree.sourceFilename ? ` · ${tree.sourceFilename}` : ""}
          </p>
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

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <div>
          {relations ? (
            <div
              className={`rounded-2xl border border-[var(--color-ink)]/10 bg-gradient-to-b from-[var(--color-surface)] to-transparent p-5 sm:p-6 ${
                isPending ? "opacity-80" : ""
              }`}
            >
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                Focus
              </p>
              <h2 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-4xl">
                {personDisplayName(relations.person)}
              </h2>
              <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                {[
                  focusLife,
                  relations.person.gender !== "unknown" ? relations.person.gender : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No dates recorded"}
              </p>

              <RelationSection title="Parents" people={relations.parents} onSelect={selectPerson} />
              <RelationSection title="Spouses" people={relations.spouses} onSelect={selectPerson} />
              <RelationSection
                title="Children"
                people={relations.children}
                onSelect={selectPerson}
              />
              <RelationSection
                title="Siblings"
                people={relations.siblings}
                onSelect={selectPerson}
              />

              {!relations.parents.length &&
              !relations.spouses.length &&
              !relations.children.length &&
              !relations.siblings.length ? (
                <p className="mt-6 text-sm text-[var(--color-ink-muted)]">
                  No linked relatives for this person yet.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-ink-muted)]">Select someone from the list.</p>
          )}
        </div>

        <aside className="min-w-0">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
              Find someone
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name or year…"
              className="mt-2 w-full min-h-11 rounded-xl border border-[var(--color-ink)]/15 bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)]"
            />
          </label>

          <ul className="mt-3 max-h-[min(70vh,36rem)] space-y-1 overflow-y-auto overscroll-contain rounded-xl border border-[var(--color-ink)]/10 p-2">
            {filteredPeople.map((person) => {
              const active = person.id === focusId;
              const life = lifespanLabel(person);
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => selectPerson(person.id)}
                    className={`flex w-full min-h-11 flex-col items-start rounded-lg px-3 py-2 text-left text-sm transition ${
                      active
                        ? "bg-[var(--color-accent)]/15 text-[var(--color-ink)]"
                        : "hover:bg-[var(--color-ink)]/5 text-[var(--color-ink)]"
                    }`}
                  >
                    <span className="font-medium">{personDisplayName(person)}</span>
                    {life ? (
                      <span className="text-xs text-[var(--color-ink-muted)]">{life}</span>
                    ) : null}
                  </button>
                </li>
              );
            })}
            {filteredPeople.length === 0 ? (
              <li className="px-3 py-4 text-sm text-[var(--color-ink-muted)]">No matches.</li>
            ) : null}
          </ul>
        </aside>
      </div>
    </div>
  );
}
