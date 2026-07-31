// Panel tab-strip — a shared, pure layout model for the row of tabs that
// sits at the top of a multi-section panel.
//
// The lore / bestiary panel (`) grew its own bespoke tab strip (Fish /
// Gems / Forage / Crops / Folk / Rumors), and the upcoming inventory bag
// panel wants the same navigation language (one row of evenly-spaced tabs,
// the active one lifted, a/d to switch). Rather than copy-paste the tab
// geometry + draw a second time, this module owns the *layout maths* and a
// couple of index helpers; a thin widget (ui/panel-tab-strip.ts) owns the
// drawing. Two panels then speak one tab dialect for free.
//
// Pure: no canvas, no engine imports. Given a list of tab items, the strip
// origin + width, and the active index, it returns one rect per tab. The
// defaults (gap 4, height 26) reproduce the lore panel's historical strip
// pixel-for-pixel so the retrofit doesn't shift anything.

/** A single tab: a primary label and an optional secondary line. */
export interface TabStripItem {
  /** Primary label drawn on the tab, e.g. "Fish" or "Seeds". */
  label: string;
  /** Optional secondary line under the label, e.g. "3/5" progress. */
  sub?: string;
}

/** A laid-out tab rect plus its resolved label/sub + active flag. */
export interface TabRect {
  x: number;
  y: number;
  w: number;
  h: number;
  active: boolean;
  label: string;
  sub: string;
}

/** Default strip height (px) — matches the lore panel's historical tabs. */
export const TAB_STRIP_HEIGHT = 26;

/** Default gap (px) carved out of each cell so neighbouring tabs breathe. */
export const TAB_STRIP_GAP = 4;

/**
 * Lay out a row of evenly-divided tabs across `totalWidth`, starting at
 * (originX, originY). Each tab claims an equal `floor(totalWidth / n)`
 * cell; the drawn rect is that cell minus `gap` so there's a sliver
 * between tabs. The active tab is flagged so the widget can lift it.
 *
 * Reproduces the lore panel's strip exactly when called with originX =
 * x+14, originY = y+38, totalWidth = PANEL_W-28, gap 4, height 26.
 *
 * Empty input -> empty array (the widget then draws nothing).
 */
export function tabStripLayout(
  items: readonly TabStripItem[],
  originX: number,
  originY: number,
  totalWidth: number,
  activeIndex: number,
  opts: { gap?: number; height?: number } = {},
): TabRect[] {
  const n = items.length;
  if (n <= 0) return [];
  const gap = opts.gap ?? TAB_STRIP_GAP;
  const height = opts.height ?? TAB_STRIP_HEIGHT;
  const cell = Math.floor(totalWidth / n);
  const rects: TabRect[] = [];
  for (let i = 0; i < n; i++) {
    rects.push({
      x: originX + i * cell,
      y: originY,
      w: Math.max(0, cell - gap),
      h: height,
      active: i === activeIndex,
      label: items[i].label,
      sub: items[i].sub ?? '',
    });
  }
  return rects;
}

/**
 * Wrap a tab index by `delta` into the valid range, cycling at both ends
 * so a/d (or arrow) navigation rolls Fish -> ... -> Rumors -> Fish. A
 * non-positive count clamps to 0 so callers never index past an empty list.
 */
export function cycleTabIndex(current: number, count: number, delta: number): number {
  if (count <= 0) return 0;
  return (((current + delta) % count) + count) % count;
}

/**
 * Which tab rect (if any) contains the point (px, py)? Returns the index
 * or -1 when the point misses every tab. Future-proofs the strip for a
 * pointer/touch build; the keyboard game doesn't use it yet but the bag
 * panel test pins the behaviour so it stays correct.
 */
export function tabAtPoint(rects: readonly TabRect[], px: number, py: number): number {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return i;
  }
  return -1;
}
