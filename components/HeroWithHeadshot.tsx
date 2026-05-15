"use client";

import { useState, useEffect } from "react";

type HeroProps = {
  name: string;
  tagline?: string;
  website?: string;
};

const SCROLL_DISTANCE = 420;
const SCROLL_THRESHOLD = 20;
const ENTRANCE_DURATION_MS = 1300;

export default function HeroWithHeadshot({ name, tagline, website }: HeroProps) {
  const [entranceDone, setEntranceDone] = useState(false);
  const [scrollStyle, setScrollStyle] = useState<React.CSSProperties>({});

  // Don't apply scroll-driven style until fly-in animation has finished
  useEffect(() => {
    const t = setTimeout(() => setEntranceDone(true), ENTRANCE_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function handleScroll() {
      if (!entranceDone) return;
      const y = window.scrollY;
      if (y < SCROLL_THRESHOLD) {
        setScrollStyle({});
        return;
      }
      const progress = Math.min((y - SCROLL_THRESHOLD) / (SCROLL_DISTANCE - SCROLL_THRESHOLD), 1);
      const eased = progress * progress * (3 - 2 * progress);
      setScrollStyle({
        opacity: 1 - eased,
        transform: `translateY(${-eased * 120}px) scale(${1 - eased * 0.5})`,
      });
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [entranceDone]);

  return (
    <>
      <header className="mx-auto max-w-2xl text-center">
        <h1 className="font-heading text-balance text-4xl font-semibold tracking-tight text-[var(--color-ink)] sm:text-5xl">
          {name}
        </h1>
        {tagline && (
          <p className="mx-auto mt-3 max-w-xl text-pretty text-base leading-relaxed text-[var(--color-muted)] sm:text-lg">
            {tagline}
          </p>
        )}
        {website && (
          <p className="mt-2 text-sm text-[var(--color-ink-muted)]">
            {website}
          </p>
        )}
      </header>

      <div className="mx-auto mt-8 flex justify-center overflow-visible sm:mt-10">
        <div
          className="hero-headshot-circle hero-headshot-fly-in relative h-52 w-52 overflow-hidden rounded-full ring-4 ring-[var(--color-surface)] shadow-xl sm:h-72 sm:w-72 md:h-80 md:w-80"
          style={entranceDone ? scrollStyle : undefined}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/headshot.png"
            alt={`${name} – professional headshot`}
            className="h-full w-full object-cover"
            fetchPriority="high"
          />
        </div>
      </div>
    </>
  );
}
