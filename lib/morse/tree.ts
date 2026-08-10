/** Binary Morse tree: dash = left, dot = right (matches the physical trainer). */

export type MorseSymbol = "." | "-";

export type MorseNode = {
  /** Path from root using . and - */
  id: string;
  letter: string | null;
  /** SVG coordinates in viewBox units */
  x: number;
  y: number;
  /** Visual node style on the faceplate — root is the antenna, never a dot */
  kind: "root" | "dot" | "dash";
  /** Where to place the letter label relative to the symbol */
  label: "left" | "right" | "above" | "below" | "none";
  dashChild?: string;
  dotChild?: string;
};

/** Portrait faceplate proportions like the keychain trainer. */
export const MORSE_VIEWBOX = { width: 420, height: 520 } as const;

/**
 * Hand-placed layout matching the pocket Morse trainer board.
 * Dash branches lean left; dot branches lean right.
 * Connections are drawn as orthogonal (circuit-board) paths in the UI.
 */
export const MORSE_NODES: MorseNode[] = [
  // Antenna tip — not a lit circle
  { id: "", letter: null, x: 210, y: 58, kind: "root", label: "none", dashChild: "-", dotChild: "." },

  // Depth 1
  { id: "-", letter: "T", x: 118, y: 118, kind: "dash", label: "left", dashChild: "--", dotChild: "-." },
  { id: ".", letter: "E", x: 302, y: 118, kind: "dot", label: "right", dashChild: ".-", dotChild: ".." },

  // Depth 2
  { id: "--", letter: "M", x: 62, y: 188, kind: "dash", label: "left", dashChild: "---", dotChild: "--." },
  { id: "-.", letter: "N", x: 158, y: 188, kind: "dot", label: "right", dashChild: "-.-", dotChild: "-.." },
  { id: ".-", letter: "A", x: 262, y: 188, kind: "dash", label: "left", dashChild: ".--", dotChild: ".-." },
  { id: "..", letter: "I", x: 358, y: 188, kind: "dot", label: "right", dashChild: "..-", dotChild: "..." },

  // Depth 3
  { id: "---", letter: "O", x: 30, y: 268, kind: "dash", label: "left" },
  { id: "--.", letter: "G", x: 86, y: 268, kind: "dot", label: "right", dashChild: "--.-", dotChild: "--.." },
  { id: "-.-", letter: "K", x: 134, y: 268, kind: "dash", label: "left", dashChild: "-.--", dotChild: "-.-." },
  { id: "-..", letter: "D", x: 182, y: 268, kind: "dot", label: "right", dashChild: "-..-", dotChild: "-..." },
  { id: ".-.", letter: "R", x: 238, y: 268, kind: "dot", label: "left", dashChild: undefined, dotChild: ".-.." },
  { id: ".--", letter: "W", x: 286, y: 268, kind: "dash", label: "right", dashChild: ".---", dotChild: ".--." },
  { id: "...", letter: "S", x: 334, y: 268, kind: "dot", label: "left", dashChild: "...-", dotChild: "...." },
  { id: "..-", letter: "U", x: 382, y: 268, kind: "dash", label: "right", dashChild: undefined, dotChild: "..-." },

  // Depth 4
  { id: "--.-", letter: "Q", x: 64, y: 368, kind: "dash", label: "below" },
  { id: "--..", letter: "Z", x: 102, y: 368, kind: "dot", label: "below" },
  { id: "-.--", letter: "Y", x: 122, y: 368, kind: "dash", label: "below" },
  { id: "-.-.", letter: "C", x: 152, y: 368, kind: "dot", label: "below" },
  { id: "-..-", letter: "X", x: 172, y: 368, kind: "dash", label: "below" },
  { id: "-...", letter: "B", x: 202, y: 368, kind: "dot", label: "below" },
  { id: ".-..", letter: "L", x: 238, y: 368, kind: "dot", label: "below" },
  { id: ".--.", letter: "P", x: 274, y: 368, kind: "dot", label: "below" },
  { id: ".---", letter: "J", x: 302, y: 368, kind: "dash", label: "below" },
  { id: "...-", letter: "V", x: 326, y: 368, kind: "dash", label: "below" },
  { id: "....", letter: "H", x: 352, y: 368, kind: "dot", label: "below" },
  { id: "..-.", letter: "F", x: 390, y: 368, kind: "dot", label: "below" },
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

/** Orthogonal (right-angle) path from parent center to child center. */
export function orthogonalPath(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): string {
  const midY = fromY + (toY - fromY) * 0.45;
  return `M ${fromX} ${fromY} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${toY}`;
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
