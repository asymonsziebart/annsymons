type TipPos = "top" | "bottom" | "left" | "right";

/** Spread onto buttons/inputs for styled hover tooltips. */
export function tipProps(label: string, pos: TipPos = "bottom") {
  return {
    "data-tip": label,
    "data-tip-pos": pos,
    "aria-label": label,
  } as const;
}

export type { TipPos };
