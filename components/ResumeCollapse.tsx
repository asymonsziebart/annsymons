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
    <section className="neo overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-14 w-full items-center justify-between gap-4 px-4 py-4 text-left transition-[box-shadow] duration-200 hover:shadow-[var(--neo-shadow-in-sm)] sm:px-6"
        aria-expanded={open}
      >
        <span className="font-heading text-lg font-semibold text-[var(--color-ink)]">
          Resume
        </span>
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-muted)] shadow-[var(--neo-shadow-out-sm)]"
          aria-hidden
        >
          {open ? "▼" : "▶"}
        </span>
      </button>
      {open && (
        <div className="mx-4 mb-4 rounded-[var(--neo-radius-sm)] p-4 shadow-[var(--neo-shadow-in)] sm:mx-6 sm:mb-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
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
              className="neo-btn-primary w-full shrink-0 sm:w-auto"
            >
              Download resume (PDF)
            </a>
          </div>
          <p className="mt-6 max-w-2xl whitespace-pre-line text-sm leading-relaxed text-[var(--color-ink-muted)]">
            {resume.summary}
          </p>

          {resume.experience.length > 0 && (
            <div className="mt-8 pt-8 shadow-[inset_0_1px_0_var(--color-border)]">
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
            <div className="mt-6 pt-6 shadow-[inset_0_1px_0_var(--color-border)]">
              <h3 className="font-heading font-semibold text-[var(--color-ink)]">
                Education
              </h3>
              <ul className="mt-2 space-y-2 text-sm text-[var(--color-ink-muted)]">
                {resume.education.map((edu, i) => (
                  <li key={i} className="leading-relaxed">
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
            <div className="mt-6 pt-6 shadow-[inset_0_1px_0_var(--color-border)]">
              <h3 className="font-heading font-semibold text-[var(--color-ink)]">
                Skills
              </h3>
              <ul className="mt-3 flex flex-wrap gap-2.5">
                {resume.skills.map((skill) => (
                  <li key={skill} className="neo-chip !min-h-8 !py-1 text-xs">
                    {skill}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
