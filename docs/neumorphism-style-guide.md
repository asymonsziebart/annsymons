# Soft UI / Neumorphism Style Guide

Share this file with any app that should match the Ann Symons Soft UI look.

Reference: [IxDF — Neumorphism](https://ixdf.org/literature/topics/neumorphism)

---

## Design intent

Soft UI (neumorphism) makes controls feel **extruded from** or **pressed into** one shared surface.

| Principle | Rule |
| --- | --- |
| One material | Page background and component fills use the **same** base color |
| Depth from light | Dual soft shadows only — no hard borders, rings, or drop-shadow cards |
| Quiet palette | Near-monochrome gray; accents sparingly |
| Pillowy shapes | Large corner radii; avoid sharp rectangles |
| Hybrid accessibility | Soft UI for chrome; **filled high-contrast CTAs** for primary actions |

Light source is assumed **top-left**.

---

## Tokens (copy these exactly)

```css
:root {
  /* Surface — page + raised/inset elements share this fill */
  --neo-bg: #e0e5ec;
  --neo-light: #ffffff;
  --neo-dark: #a3b1c6;

  /* Text (keep strong enough for WCAG) */
  --color-ink: #2b3340;
  --color-ink-muted: #4a5568;
  --color-muted: #64748b;

  /* Accents — use for CTAs / active states, not large fills */
  --color-accent: #2563eb;
  --color-accent-hover: #1d4ed8;
  --color-teal: #0f766e;
  --color-coral: #db2777;

  /* Radii */
  --neo-radius: 1.5rem;
  --neo-radius-sm: 1rem;
  --neo-radius-pill: 9999px;

  /* Raised (extruded) */
  --neo-shadow-out:
    9px 9px 16px var(--neo-dark),
    -9px -9px 16px var(--neo-light);
  --neo-shadow-out-sm:
    6px 6px 12px var(--neo-dark),
    -6px -6px 12px var(--neo-light);
  --neo-shadow-out-lg:
    12px 12px 24px var(--neo-dark),
    -12px -12px 24px var(--neo-light);

  /* Pressed / recessed */
  --neo-shadow-in:
    inset 6px 6px 12px var(--neo-dark),
    inset -6px -6px 12px var(--neo-light);
  --neo-shadow-in-sm:
    inset 4px 4px 8px var(--neo-dark),
    inset -4px -4px 8px var(--neo-light);
}
```

### Quick reference

| Role | Value |
| --- | --- |
| Surface | `#e0e5ec` |
| Light highlight | `#ffffff` |
| Dark shadow | `#a3b1c6` |
| Body text | `#2b3340` |
| Primary accent | `#2563eb` |
| Theme color / browser chrome | `#e0e5ec` |

---

## Typography

| Role | Font | Notes |
| --- | --- | --- |
| Headings | **Outfit** | Clean geometric sans |
| Body / UI | **Nunito** | Soft rounded sans |

```css
body {
  font-family: "Nunito", ui-sans-serif, system-ui, sans-serif;
  color: var(--color-ink);
  background-color: var(--neo-bg);
}

.font-heading {
  font-family: "Outfit", ui-sans-serif, system-ui, sans-serif;
  font-weight: 600;
}
```

Google Fonts:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Outfit:wght@500;600;700&display=swap"
  rel="stylesheet"
/>
```

---

## Page background

Base fill is solid `#e0e5ec`. Optional soft ambient gradients (keep subtle):

```css
body {
  background:
    radial-gradient(120% 80% at 0% 0%, #f4f7fb 0%, transparent 55%),
    radial-gradient(100% 70% at 100% 100%, #d5dce8 0%, transparent 50%),
    var(--neo-bg);
  background-color: var(--neo-bg);
}
```

---

## Core utilities

Drop these into a shared stylesheet.

```css
.neo {
  background: var(--neo-bg);
  border: none;
  border-radius: var(--neo-radius);
  box-shadow: var(--neo-shadow-out);
}

.neo-sm {
  background: var(--neo-bg);
  border: none;
  border-radius: var(--neo-radius-sm);
  box-shadow: var(--neo-shadow-out-sm);
}

.neo-inset {
  background: var(--neo-bg);
  border: none;
  border-radius: var(--neo-radius-sm);
  box-shadow: var(--neo-shadow-in);
}

.neo-chip {
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: 0.5rem 1.1rem;
  border: none;
  border-radius: var(--neo-radius-pill);
  background: var(--neo-bg);
  color: var(--color-ink-muted);
  font-weight: 700;
  font-size: 0.875rem;
  box-shadow: var(--neo-shadow-out-sm);
}

.neo-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: var(--neo-radius-sm);
  background: var(--neo-bg);
  color: var(--color-ink);
  font-weight: 700;
  font-size: 0.875rem;
  box-shadow: var(--neo-shadow-out-sm);
  cursor: pointer;
  transition: box-shadow 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.neo-btn:hover {
  color: var(--color-accent);
}

.neo-btn:active,
.neo-btn[aria-pressed="true"] {
  box-shadow: var(--neo-shadow-in-sm);
  transform: scale(0.985);
}

.neo-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}

/* Primary CTA — filled for contrast (IxDF hybrid) */
.neo-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: var(--neo-radius-sm);
  background: var(--color-accent);
  color: #ffffff;
  font-weight: 700;
  font-size: 0.875rem;
  box-shadow: var(--neo-shadow-out-sm);
  cursor: pointer;
  transition: background 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}

.neo-btn-primary:hover {
  background: var(--color-accent-hover);
}

.neo-btn-primary:active {
  box-shadow: var(--neo-shadow-in-sm);
  transform: scale(0.985);
}

.neo-btn-primary:focus-visible {
  outline: 2px solid var(--color-ink);
  outline-offset: 3px;
}

.neo-input {
  width: 100%;
  border: none;
  border-radius: var(--neo-radius-sm);
  background: var(--neo-bg);
  color: var(--color-ink);
  padding: 0.75rem 1rem;
  box-shadow: var(--neo-shadow-in);
  outline: none;
}

.neo-input::placeholder {
  color: var(--color-muted);
}

.neo-input:focus {
  box-shadow:
    var(--neo-shadow-in),
    0 0 0 2px rgba(37, 99, 235, 0.35);
}

.neo-input:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

---

## Component recipes

### Raised card

```html
<section class="neo" style="padding: 1.5rem;">
  <h2 class="font-heading">Card title</h2>
  <p style="color: var(--color-ink-muted);">Supporting copy.</p>
</section>
```

### Recessed well (lists, forms, panels)

```html
<div class="neo-inset" style="padding: 0.75rem;">
  <!-- items inside -->
</div>
```

### Soft button (secondary)

```html
<button type="button" class="neo-btn">Cancel</button>
```

### Primary button (high contrast)

```html
<button type="button" class="neo-btn-primary">Save</button>
```

### Search / text field

```html
<input class="neo-input" type="search" placeholder="Search…" />
```

### Chip / tag

```html
<span class="neo-chip">Crochet</span>
```

### Active nav item

Inactive: soft text link.  
Active / pressed: inset shadow on a pill:

```css
.nav-item-active {
  color: var(--color-accent);
  border-radius: var(--neo-radius-sm);
  box-shadow: var(--neo-shadow-in-sm);
  padding: 0.5rem 0.75rem;
}
```

### Avatar / circular media

```css
.neo-avatar {
  width: 10rem;
  height: 10rem;
  border-radius: 9999px;
  background: var(--neo-bg);
  padding: 0.35rem;
  box-shadow: var(--neo-shadow-out-lg);
  overflow: hidden;
}

.neo-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 9999px;
  box-shadow: var(--neo-shadow-in-sm);
}
```

---

## Interaction states

| State | Treatment |
| --- | --- |
| Default control | Raised (`--neo-shadow-out` / `-sm`) |
| Hover | Slightly stronger raised shadow **or** accent text color |
| Active / pressed | Inset (`--neo-shadow-in-sm`) + tiny scale `0.985` |
| Focus (keyboard) | Visible `outline` — never rely on shadow alone |
| Disabled | `opacity: 0.5`; keep shadow so shape still reads |

---

## Accessibility (required)

Soft UI fails when contrast is too low. Follow IxDF hybrid guidance:

1. **Body text** must stay dark on `#e0e5ec` (use `--color-ink`, not pale gray).
2. **Primary actions** use filled `--color-accent` with white text — do not make “Sign in / Save / Delete” pure Soft UI gray-on-gray.
3. Always ship `:focus-visible` outlines.
4. Prefer clear labels over icon-only Soft UI buttons.
5. Check contrast with a WCAG checker before shipping.

---

## Do / don’t

### Do

- Match control fill to `--neo-bg`
- Use dual opposite-side shadows only
- Keep the palette nearly monochrome
- Use large radii (`1rem`–`1.5rem`, pills for chips)
- Use Soft UI for cards, nav chrome, secondary controls, wells
- Use filled accent buttons for critical CTAs

### Don’t

- Hard borders, 1px rings, Material elevation, glassmorphism blurs on cards
- Purple neon gradients or glow effects
- Different fill colors for every card (breaks the “one surface” illusion)
- Tiny sharp corners
- Pure Soft UI for every button (hurts usability)
- Busy paint-splash / sticker clutter over Soft UI surfaces

---

## Dark Soft UI (optional variant)

If you need a dark theme later, keep the same shadow *logic* with inverted tones:

```css
:root[data-theme="dark"] {
  --neo-bg: #2e3440;
  --neo-light: #3b4252;
  --neo-dark: #1d2129;
  --color-ink: #e5e9f0;
  --color-ink-muted: #c0c7d4;
  --color-muted: #9aa3b5;
}
```

(Still use a brighter filled accent for primary CTAs.)

---

## Framework notes

### Plain CSS / any stack

Copy the tokens + utilities above into a global stylesheet.

### Tailwind / CSS variables

Expose the same custom properties, then apply classes like `neo`, `neo-btn`, `neo-inset` (utility classes, not Tailwind defaults).

### React / Next.js

1. Put tokens + utilities in `globals.css`
2. Load Outfit + Nunito (e.g. `next/font/google`)
3. Prefer shared primitives over one-off shadow strings

### Flutter / native

Approximate with:

- Same surface color for scaffold + controls  
- Dual soft shadows (bottom-right dark, top-left light)  
- Inset / pressed state for toggles and selected nav  
- Large corner radii  

---

## Minimal starter HTML

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="theme-color" content="#e0e5ec" />
    <title>Soft UI starter</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700&family=Outfit:wght@600&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="soft-ui.css" />
  </head>
  <body>
    <main class="neo" style="max-width: 28rem; margin: 3rem auto; padding: 2rem;">
      <h1 class="font-heading">Welcome</h1>
      <p style="color: var(--color-ink-muted);">Soft UI starter panel.</p>
      <div style="display: flex; gap: 0.75rem; margin-top: 1.25rem;">
        <button class="neo-btn-primary" type="button">Continue</button>
        <button class="neo-btn" type="button">Later</button>
      </div>
    </main>
  </body>
</html>
```

Save the **Tokens** + **Core utilities** sections as `soft-ui.css`.

---

## Checklist for adopting in another app

- [ ] Set page background to `#e0e5ec`
- [ ] Wire `--neo-bg`, `--neo-light`, `--neo-dark` and dual shadow tokens
- [ ] Convert cards → `.neo` / `.neo-sm`
- [ ] Convert inputs / wells → `.neo-inset` / `.neo-input`
- [ ] Secondary controls → `.neo-btn` (pressed = inset)
- [ ] Primary CTAs → `.neo-btn-primary`
- [ ] Swap fonts to Outfit + Nunito
- [ ] Remove borders / Material shadows / glass cards
- [ ] Verify text + CTA contrast
- [ ] Add `:focus-visible` styles

---

## Source of truth in this repo

Live implementation:

- `app/globals.css` — tokens + Soft UI utilities  
- `app/layout.tsx` — Outfit / Nunito + `themeColor: #e0e5ec`  
- Shared chrome: `components/Header.tsx`, `Footer.tsx`, `HeroWithHeadshot.tsx`, etc.
