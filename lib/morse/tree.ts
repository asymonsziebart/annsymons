/** Condensed rail Morse tree: same symbol stays horizontal, opposite drops vertical. */

export type MorseSymbol = "." | "-";

export type MorseNode = {
  /** Path from root using . and - */
  id: string;
  letter: string | null;
  x: number;
  y: number;
  /** root = antenna; never drawn as a lit circle */
  kind: "root" | "dot" | "dash";
  label: "left" | "right" | "above" | "below" | "none";
  dashChild?: string;
  dotChild?: string;
};

/** Portrait faceplate for the pocket-trainer rail layout. */
export const MORSE_VIEWBOX = { width: 460, height: 500 } as const;

/** Junction under the antenna on the main T—E rail (not a letter node). */
export const MORSE_HUB = { x: 230, y: 112 } as const;

/**
 * Rail layout (matches the physical LED trainer):
 * - Main horizontal rail: O—M—T · hub · E—I—S—H
 * - Same symbol continues sideways on a rail
 * - Opposite symbol drops straight down to the next row
 */
export const MORSE_NODES: MorseNode[] = [
  {
    id: "",
    letter: null,
    x: MORSE_HUB.x,
    y: 46,
    kind: "root",
    label: "none",
    dashChild: "-",
    dotChild: ".",
  },

  // Main dash rail (left)
  { id: "---", letter: "O", x: 48, y: 112, kind: "dash", label: "above" },
  {
    id: "--",
    letter: "M",
    x: 108,
    y: 112,
    kind: "dash",
    label: "above",
    dashChild: "---",
    dotChild: "--.",
  },
  {
    id: "-",
    letter: "T",
    x: 170,
    y: 112,
    kind: "dash",
    label: "above",
    dashChild: "--",
    dotChild: "-.",
  },

  // Main dot rail (right)
  {
    id: ".",
    letter: "E",
    x: 290,
    y: 112,
    kind: "dot",
    label: "above",
    dashChild: ".-",
    dotChild: "..",
  },
  {
    id: "..",
    letter: "I",
    x: 350,
    y: 112,
    kind: "dot",
    label: "above",
    dashChild: "..-",
    dotChild: "...",
  },
  {
    id: "...",
    letter: "S",
    x: 410,
    y: 112,
    kind: "dot",
    label: "above",
    dashChild: "...-",
    dotChild: "....",
  },
  { id: "....", letter: "H", x: 450, y: 112, kind: "dot", label: "above" },

  // Row 2 — first opposite-symbol drops
  {
    id: "--.",
    letter: "G",
    x: 108,
    y: 200,
    kind: "dot",
    label: "left",
    dashChild: "--.-",
    dotChild: "--..",
  },
  {
    id: "-.",
    letter: "N",
    x: 170,
    y: 200,
    kind: "dot",
    label: "right",
    dashChild: "-.-",
    dotChild: "-..",
  },
  {
    id: ".-",
    letter: "A",
    x: 290,
    y: 200,
    kind: "dash",
    label: "left",
    dashChild: ".--",
    dotChild: ".-.",
  },
  {
    id: "..-",
    letter: "U",
    x: 350,
    y: 200,
    kind: "dash",
    label: "right",
    dashChild: undefined,
    dotChild: "..-.",
  },
  { id: "...-", letter: "V", x: 410, y: 200, kind: "dash", label: "right" },

  // Row 3
  { id: "--.-", letter: "Q", x: 55, y: 290, kind: "dash", label: "below" },
  { id: "--..", letter: "Z", x: 105, y: 290, kind: "dot", label: "below" },
  {
    id: "-.-",
    letter: "K",
    x: 155,
    y: 290,
    kind: "dash",
    label: "left",
    dashChild: "-.--",
    dotChild: "-.-.",
  },
  {
    id: "-..",
    letter: "D",
    x: 210,
    y: 290,
    kind: "dot",
    label: "right",
    dashChild: "-..-",
    dotChild: "-...",
  },
  {
    id: ".--",
    letter: "W",
    x: 260,
    y: 290,
    kind: "dash",
    label: "left",
    dashChild: ".---",
    dotChild: ".--.",
  },
  {
    id: ".-.",
    letter: "R",
    x: 325,
    y: 290,
    kind: "dot",
    label: "right",
    dashChild: undefined,
    dotChild: ".-..",
  },
  { id: "..-.", letter: "F", x: 385, y: 290, kind: "dot", label: "below" },

  // Row 4
  { id: "-.--", letter: "Y", x: 130, y: 390, kind: "dash", label: "below" },
  { id: "-.-.", letter: "C", x: 170, y: 390, kind: "dot", label: "below" },
  { id: "-..-", letter: "X", x: 195, y: 390, kind: "dash", label: "below" },
  { id: "-...", letter: "B", x: 235, y: 390, kind: "dot", label: "below" },
  { id: ".---", letter: "J", x: 255, y: 390, kind: "dash", label: "below" },
  { id: ".--.", letter: "P", x: 295, y: 390, kind: "dot", label: "below" },
  { id: ".-..", letter: "L", x: 335, y: 390, kind: "dot", label: "below" },
];

export const MORSE_NODE_MAP = Object.fromEntries(
  MORSE_NODES.map((node) => [node.id, node]),
) as Record<string, MorseNode>;

export const MORSE_EDGES: { from: string; to: string; symbol: MorseSymbol }[] =
  MORSE_NODES.flatMap((node) => {
    const edges: { from: string; to: string; symbol: MorseSymbol }[] = [];
    if (node.dashChild) edges.push({ from: node.id, to: node.dashChild, symbol: "-" });
    if (node.dotChild) edges.push({ from: node.id, to: node.dotChild, symbol: "." });
    return edges;
  });

/**
 * Strict right-angle trace between two points.
 * Prefers: horizontal if same row, vertical if same column,
 * otherwise vertical-then-horizontal (drop, then rail).
 */
export function orthogonalPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  if (fromX === toX || fromY === toY) {
    return `M ${fromX} ${fromY} L ${toX} ${toY}`;
  }
  // Drop first, then run sideways — matches the condensed trainer wiring
  return `M ${fromX} ${fromY} L ${fromX} ${toY} L ${toX} ${toY}`;
}

/** Root edges route through the hub on the main rail. */
export function rootEdgePath(toX: number, toY: number, antennaY: number): string {
  const stemBottom = antennaY + 20;
  return `M ${MORSE_HUB.x} ${stemBottom} L ${MORSE_HUB.x} ${MORSE_HUB.y} L ${toX} ${toY}`;
}

export function pathIds(sequence: string): string[] {
  const ids = [""];
  for (let i = 1; i <= sequence.length; i += 1) {
    ids.push(sequence.slice(0, i));
  }
  return ids.filter((id) => id in MORSE_NODE_MAP);
}

export function childForSymbol(nodeId: string, symbol: MorseSymbol): string | null {
  const node = MORSE_NODE_MAP[nodeId];
  if (!node) return null;
  const next = symbol === "-" ? node.dashChild : node.dotChild;
  return next && next in MORSE_NODE_MAP ? next : null;
}
