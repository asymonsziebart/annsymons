"use client";

import { useState } from "react";

type Resume = {
  name: string;
  tagline?: string;
  website?: string;
  summary: string;
  experience: Array<{ role: string; company: string; period: string; details: string }>;
  education: Array<{ degree: string; school: string; period: string }>;
  skills: string[];
};

export default function ResumeCollapse({ resume }: { resume: Resume }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="overflow-hidden rounded-2xl bg-[var(--color-surface)] ring-1 ring-[var(--color-border)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition-colors hover:bg-[var(--color-cream-dark)]/50"
        aria-expanded={open}
      >
        <span className="font-heading text-lg font-semibold text-[var(--color-ink)]">
          Resume
        </span>
        <span className="text-[var(--color-muted)]" aria-hidden>
          {open ? "▼" : "▶"}
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)] p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-heading text-xl font-semibold text-[var(--color-ink)]">
                {resume.name}
              </h2>
              {resume.tagline && (
                <p className="mt-1 text-[var(--color-muted)]">{resume.tagline}</p>
              )}
              {resume.website && (
                <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                  {resume.website}
                </p>
              )}
            </div>
            <a
              href="/Profile.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-accent-hover)] transition-colors"
            >
              Download resume (PDF)
            </a>
          </div>
          <p className="mt-6 max-w-2xl whitespace-pre-line text-[var(--color-ink-muted)] leading-relaxed text-sm">
            {resume.summary}
          </p>

          {resume.experience.length > 0 && (
            <div className="mt-8 border-t border-[var(--color-border)] pt-8">
              <h3 className="font-heading font-semibold text-[var(--color-ink)]">
                Experience
              </h3>
              <ul className="mt-3 space-y-4">
                {resume.experience.map((job, i) => (
                  <li key={i}>
                    <div className="font-medium text-[var(--color-ink)] text-sm">
                      {job.role}
                    </div>
                    <div className="text-xs text-[var(--color-muted)]">
                      {job.company} · {job.period}
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-ink-muted)] leading-relaxed">
                      {job.details}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resume.education.length > 0 && (
            <div className="mt-6 border-t border-[var(--color-border)] pt-6">
              <h3 className="font-heading font-semibold text-[var(--color-ink)]">
                Education
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-[var(--color-ink-muted)]">
                {resume.education.map((edu, i) => (
                  <li key={i}>
                    <span className="font-medium text-[var(--color-ink)]">
                      {edu.degree}
                    </span>
                    {" · "}
                    {edu.school} ({edu.period})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resume.skills.length > 0 && (
            <div className="mt-6 border-t border-[var(--color-border)] pt-6">
              <h3 className="font-heading font-semibold text-[var(--color-ink)]">
                Skills
              </h3>
              <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
                {resume.skills.join(" · ")}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
