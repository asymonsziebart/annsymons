"use client";

import { useEffect, useState } from "react";
import type { FamilyTreeDate, FamilyTreePerson } from "@/lib/familyTree/types";
import { personDisplayName } from "@/lib/familyTree/relations";

type Props = {
  person: FamilyTreePerson;
  onSave: (patch: {
    given: string;
    surname: string;
    middle: string;
    gender: FamilyTreePerson["gender"];
    birth: FamilyTreeDate | null;
    death: FamilyTreeDate | null;
  }) => Promise<void>;
  onClose: () => void;
};

function dateToInputs(date: FamilyTreeDate | null | undefined) {
  return {
    year: date?.year ? String(date.year) : "",
    month: date?.month ? String(date.month) : "",
    day: date?.day ? String(date.day) : "",
  };
}

function inputsToDate(year: string, month: string, day: string): FamilyTreeDate | null {
  const y = Number.parseInt(year, 10);
  if (!Number.isFinite(y) || y <= 0) return null;
  const m = Number.parseInt(month, 10);
  const d = Number.parseInt(day, 10);
  return {
    year: y,
    month: Number.isFinite(m) && m > 0 ? m : null,
    day: Number.isFinite(d) && d > 0 ? d : null,
    known: true,
  };
}

export default function PersonEditDialog({ person, onSave, onClose }: Props) {
  const [given, setGiven] = useState(person.given);
  const [surname, setSurname] = useState(person.surname);
  const [middle, setMiddle] = useState(person.middle ?? "");
  const [gender, setGender] = useState<FamilyTreePerson["gender"]>(person.gender);
  const birth0 = dateToInputs(person.birth);
  const death0 = dateToInputs(person.death);
  const [birthYear, setBirthYear] = useState(birth0.year);
  const [birthMonth, setBirthMonth] = useState(birth0.month);
  const [birthDay, setBirthDay] = useState(birth0.day);
  const [deathYear, setDeathYear] = useState(death0.year);
  const [deathMonth, setDeathMonth] = useState(death0.month);
  const [deathDay, setDeathDay] = useState(death0.day);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        given,
        surname,
        middle,
        gender,
        birth: inputsToDate(birthYear, birthMonth, birthDay),
        death: inputsToDate(deathYear, deathMonth, deathDay),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 p-3 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <form
        onSubmit={(e) => void submit(e)}
        className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
      >
        <h2 className="font-heading text-xl font-semibold text-[var(--color-ink)]">
          Edit {personDisplayName(person)}
        </h2>
        <div className="mt-4 grid gap-3">
          <label className="block text-sm">
            <span className="text-[var(--color-ink-muted)]">First name</span>
            <input
              className="mt-1 w-full min-h-11 rounded-xl border border-black/10 px-3"
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              autoFocus
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--color-ink-muted)]">Middle</span>
            <input
              className="mt-1 w-full min-h-11 rounded-xl border border-black/10 px-3"
              value={middle}
              onChange={(e) => setMiddle(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--color-ink-muted)]">Last name</span>
            <input
              className="mt-1 w-full min-h-11 rounded-xl border border-black/10 px-3"
              value={surname}
              onChange={(e) => setSurname(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--color-ink-muted)]">Gender</span>
            <select
              className="mt-1 w-full min-h-11 rounded-xl border border-black/10 px-3"
              value={gender}
              onChange={(e) => setGender(e.target.value as FamilyTreePerson["gender"])}
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="unknown">Unknown</option>
            </select>
          </label>
          <fieldset className="grid grid-cols-3 gap-2">
            <legend className="mb-1 text-sm text-[var(--color-ink-muted)]">Birth</legend>
            <input
              placeholder="Year"
              inputMode="numeric"
              className="min-h-11 rounded-xl border border-black/10 px-2 text-sm"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
            />
            <input
              placeholder="Month"
              inputMode="numeric"
              className="min-h-11 rounded-xl border border-black/10 px-2 text-sm"
              value={birthMonth}
              onChange={(e) => setBirthMonth(e.target.value)}
            />
            <input
              placeholder="Day"
              inputMode="numeric"
              className="min-h-11 rounded-xl border border-black/10 px-2 text-sm"
              value={birthDay}
              onChange={(e) => setBirthDay(e.target.value)}
            />
          </fieldset>
          <fieldset className="grid grid-cols-3 gap-2">
            <legend className="mb-1 text-sm text-[var(--color-ink-muted)]">Death</legend>
            <input
              placeholder="Year"
              inputMode="numeric"
              className="min-h-11 rounded-xl border border-black/10 px-2 text-sm"
              value={deathYear}
              onChange={(e) => setDeathYear(e.target.value)}
            />
            <input
              placeholder="Month"
              inputMode="numeric"
              className="min-h-11 rounded-xl border border-black/10 px-2 text-sm"
              value={deathMonth}
              onChange={(e) => setDeathMonth(e.target.value)}
            />
            <input
              placeholder="Day"
              inputMode="numeric"
              className="min-h-11 rounded-xl border border-black/10 px-2 text-sm"
              value={deathDay}
              onChange={(e) => setDeathDay(e.target.value)}
            />
          </fieldset>
        </div>
        {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="neo-btn !min-h-11" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="neo-btn-primary !min-h-11" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
