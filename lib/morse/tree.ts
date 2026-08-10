/** Binary Morse tree: dash = left, dot = right (matches the physical trainer). */

export type MorseSymbol = "." | "-";

export type MorseNode = {
  /** Path from root using . and - */
  id: string;
  letter: string | null;
  /** SVG coordinates in viewBox units */
  x: number;
  y: number;
  /** Visual node style on the faceplate */
  kind: "root" | "dot" | "dash";
  dashChild?: string;
  dotChild?: string;
};

/** Compact board so tree + controls fit one phone viewport. */
export const MORSE_VIEWBOX = { width: 640, height: 430 } as const;

/**
 * Hand-placed layout approximating the keychain Morse trainer board.
 * Dash branches lean left; dot branches lean right.
 */
export const MORSE_NODES: MorseNode[] = [
  { id: "", letter: null, x: 320, y: 28, kind: "root", dashChild: "-", dotChild: "." },

  // Depth 1
  { id: "-", letter: "T", x: 178, y: 92, kind: "dash", dashChild: "--", dotChild: "-." },
  { id: ".", letter: "E", x: 462, y: 92, kind: "dot", dashChild: ".-", dotChild: ".." },

  // Depth 2
  { id: "--", letter: "M", x: 96, y: 156, kind: "dash", dashChild: "---", dotChild: "--." },
  { id: "-.", letter: "N", x: 236, y: 156, kind: "dot", dashChild: "-.-", dotChild: "-.." },
  { id: ".-", letter: "A", x: 404, y: 156, kind: "dash", dashChild: ".--", dotChild: ".-." },
  { id: "..", letter: "I", x: 544, y: 156, kind: "dot", dashChild: "..-", dotChild: "..." },

  // Depth 3
  { id: "---", letter: "O", x: 48, y: 228, kind: "dash" },
  { id: "--.", letter: "G", x: 132, y: 228, kind: "dot", dashChild: "--.-", dotChild: "--.." },
  { id: "-.-", letter: "K", x: 200, y: 228, kind: "dash", dashChild: "-.--", dotChild: "-.-." },
  { id: "-..", letter: "D", x: 272, y: 228, kind: "dot", dashChild: "-..-", dotChild: "-..." },
  { id: ".-.", letter: "R", x: 368, y: 228, kind: "dot", dashChild: undefined, dotChild: ".-.." },
  { id: ".--", letter: "W", x: 440, y: 228, kind: "dash", dashChild: ".---", dotChild: ".--." },
  { id: "...", letter: "S", x: 508, y: 228, kind: "dot", dashChild: "...-", dotChild: "...." },
  { id: "..-", letter: "U", x: 584, y: 228, kind: "dash", dashChild: undefined, dotChild: "..-." },

  // Depth 4
  { id: "--.-", letter: "Q", x: 98, y: 318, kind: "dash" },
  { id: "--..", letter: "Z", x: 152, y: 318, kind: "dot" },
  { id: "-.--", letter: "Y", x: 188, y: 318, kind: "dash" },
  { id: "-.-.", letter: "C", x: 228, y: 318, kind: "dot" },
  { id: "-..-", letter: "X", x: 258, y: 318, kind: "dash" },
  { id: "-...", letter: "B", x: 298, y: 318, kind: "dot" },
  { id: ".-..", letter: "L", x: 358, y: 318, kind: "dot" },
  { id: ".--.", letter: "P", x: 418, y: 318, kind: "dot" },
  { id: ".---", letter: "J", x: 458, y: 318, kind: "dash" },
  { id: "...-", letter: "V", x: 498, y: 318, kind: "dash" },
  { id: "....", letter: "H", x: 538, y: 318, kind: "dot" },
  { id: "..-.", letter: "F", x: 592, y: 318, kind: "dot" },
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
