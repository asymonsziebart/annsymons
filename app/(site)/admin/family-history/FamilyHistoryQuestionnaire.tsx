"use client";

import { useEffect, useMemo, useState } from "react";
import type { FamilyHistoryQuestion } from "@/lib/familyHistory";

type StoredAnswer = {
  questionId: string;
  answer: string;
  answeredBy?: string;
};

type RequestState = "loading" | "ready" | "saving" | "saved" | "error";

const DRAFT_KEY = "family-history-questionnaire-draft";

export default function FamilyHistoryQuestionnaire({
  questions,
}: {
  questions: FamilyHistoryQuestion[];
}) {
  const emptyAnswers = useMemo(
    () => Object.fromEntries(questions.map((question) => [question.id, ""])),
    [questions]
  );
  const [answers, setAnswers] = useState<Record<string, string>>(emptyAnswers);
  const [answeredBy, setAnsweredBy] = useState("Karolyn");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [state, setState] = useState<RequestState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") as {
        answers?: Record<string, string>;
        answeredBy?: string;
      };
      setAnswers((current) => ({ ...current, ...(draft.answers ?? {}) }));
      if (draft.answeredBy) setAnsweredBy(draft.answeredBy);
    } catch {
      // Ignore an invalid local draft and continue with server answers.
    }

    async function loadAnswers() {
      try {
        const response = await fetch("/api/admin/family-history/answers", { cache: "no-store" });
        const data = (await response.json()) as { answers?: StoredAnswer[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Could not load saved answers.");

        const serverAnswers = Object.fromEntries(
          (data.answers ?? []).map((item) => [item.questionId, item.answer])
        );
        setAnswers((current) => ({ ...current, ...serverAnswers }));
        const lastResponder = data.answers?.find((item) => item.answeredBy)?.answeredBy;
        if (lastResponder) setAnsweredBy(lastResponder);
        setState("ready");
      } catch (error) {
        setState("error");
        setMessage(error instanceof Error ? error.message : "Could not load saved answers.");
      }
    }

    void loadAnswers();
  }, []);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ answers, answeredBy }));
  }, [answers, answeredBy]);

  if (questions.length === 0) return null;

  const current = questions[currentIndex]!;
  const answeredCount = questions.filter((question) => answers[question.id]?.trim()).length;
  const isComplete = answeredCount === questions.length;
  const percent = Math.round((answeredCount / questions.length) * 100);

  function updateAnswer(value: string) {
    setAnswers((currentAnswers) => ({ ...currentAnswers, [current.id]: value }));
    if (state === "saved") setState("ready");
  }

  function goToFirstUnanswered() {
    const index = questions.findIndex((question) => !answers[question.id]?.trim());
    if (index >= 0) setCurrentIndex(index);
  }

  async function saveAnswers() {
    setState("saving");
    setMessage("");

    try {
      const response = await fetch("/api/admin/family-history/answers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answeredBy,
          answers: questions.map((question) => ({
            questionId: question.id,
            answer: answers[question.id] ?? "",
          })),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save the answers.");

      setState("saved");
      setMessage(
        isComplete
          ? "Questionnaire complete — every answer is saved for the family history."
          : `Progress saved — ${answeredCount} of ${questions.length} questions answered.`
      );
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Could not save the answers.");
    }
  }

  return (
    <section className="neo mt-10 p-5 sm:p-7" aria-labelledby="family-questions-heading">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--color-accent)]">
        Help complete the story
      </p>
      <h2
        id="family-questions-heading"
        className="mt-2 font-heading text-3xl font-semibold tracking-tight text-[var(--color-ink)]"
      >
        Questions for Mom
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-muted)]">
        Answer what you remember. If you do not know something, write “I don’t know” so the
        question counts as complete. You can save and come back at any time.
      </p>

      <div className="mt-5" aria-label={`${answeredCount} of ${questions.length} answered`}>
        <div className="flex items-center justify-between gap-4 text-xs font-bold text-[var(--color-ink-muted)]">
          <span>
            {answeredCount} of {questions.length} answered
          </span>
          <span>{percent}%</span>
        </div>
        <div className="neo-inset mt-2 h-3 overflow-hidden" aria-hidden="true">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <div className="mt-7 border-t border-[var(--color-ink)]/10 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-accent)]">
            {current.category}
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            Question {currentIndex + 1} of {questions.length}
          </p>
        </div>
        <label
          htmlFor={`family-question-${current.id}`}
          className="mt-3 block text-base font-semibold leading-relaxed text-[var(--color-ink)]"
        >
          {current.prompt}
        </label>
        <textarea
          id={`family-question-${current.id}`}
          value={answers[current.id] ?? ""}
          onChange={(event) => updateAnswer(event.target.value)}
          className="neo-input mt-3 min-h-40 resize-y text-base"
          rows={6}
          maxLength={8000}
          placeholder="Type your answer here..."
        />

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            className="neo-btn"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          >
            ← Previous
          </button>
          <button
            type="button"
            className="neo-btn"
            disabled={currentIndex === questions.length - 1}
            onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}
          >
            Next →
          </button>
          {!isComplete ? (
            <button type="button" className="neo-btn" onClick={goToFirstUnanswered}>
              First unanswered
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-7 border-t border-[var(--color-ink)]/10 pt-6">
        <label
          htmlFor="family-history-answered-by"
          className="mb-1 block text-sm font-semibold text-[var(--color-ink)]"
        >
          Answered by
        </label>
        <input
          id="family-history-answered-by"
          value={answeredBy}
          onChange={(event) => setAnsweredBy(event.target.value)}
          className="neo-input max-w-sm text-base"
          maxLength={100}
        />

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void saveAnswers()}
            disabled={state === "saving" || state === "loading"}
            className="neo-btn-primary min-h-12 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {state === "saving"
              ? "Saving..."
              : isComplete
                ? "Finish and save questionnaire"
                : "Save progress"}
          </button>
          {message ? (
            <p
              className={`text-sm font-medium ${
                state === "error" ? "text-red-700" : "text-emerald-700"
              }`}
              role="status"
              aria-live="polite"
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
