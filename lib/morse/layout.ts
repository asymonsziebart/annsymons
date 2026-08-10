import {
  MORSE_HUB,
  MORSE_NODES,
  type MorseNode,
} from "@/lib/morse/tree";

export const MORSE_LAYOUT_STORAGE_KEY = "annsymons.morse.layout.v1";

export type MorseLabelSide = MorseNode["label"];

export type MorseLayoutNode = {
  x: number;
  y: number;
  label: MorseLabelSide;
};

export type MorseLayout = {
  hub: { x: number; y: number };
  nodes: Record<string, MorseLayoutNode>;
};

export function defaultMorseLayout(): MorseLayout {
  const nodes: Record<string, MorseLayoutNode> = {};
  for (const node of MORSE_NODES) {
    nodes[node.id] = { x: node.x, y: node.y, label: node.label };
  }
  return {
    hub: { x: MORSE_HUB.x, y: MORSE_HUB.y },
    nodes,
  };
}

export function loadMorseLayout(): MorseLayout {
  const base = defaultMorseLayout();
  if (typeof window === "undefined") return base;
  try {
    const raw = window.localStorage.getItem(MORSE_LAYOUT_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<MorseLayout>;
    const nodes = { ...base.nodes };
    if (parsed.nodes && typeof parsed.nodes === "object") {
      for (const [id, value] of Object.entries(parsed.nodes)) {
        if (!nodes[id] || !value) continue;
        nodes[id] = {
          x: Number(value.x) || nodes[id].x,
          y: Number(value.y) || nodes[id].y,
          label: (value.label as MorseLabelSide) || nodes[id].label,
        };
      }
    }
    return {
      hub: {
        x: Number(parsed.hub?.x) || base.hub.x,
        y: Number(parsed.hub?.y) || base.hub.y,
      },
      nodes,
    };
  } catch {
    return base;
  }
}

export function saveMorseLayout(layout: MorseLayout): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MORSE_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

export const LABEL_CYCLE: MorseLabelSide[] = ["above", "right", "below", "left", "none"];

export function nextLabelSide(current: MorseLabelSide): MorseLabelSide {
  const idx = LABEL_CYCLE.indexOf(current);
  return LABEL_CYCLE[(idx + 1) % LABEL_CYCLE.length] ?? "above";
}
