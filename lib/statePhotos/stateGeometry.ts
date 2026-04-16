import { DOMParser } from "@xmldom/xmldom";

import { ALL_CODES } from "./states";

function codeFromClass(classAttr: string | null): string | null {
  if (!classAttr) return null;
  const codes = new Set(ALL_CODES.map((c) => c.toLowerCase()));
  for (const token of classAttr.split(/\s+/)) {
    const t = token.toLowerCase();
    if (t.length === 2 && /^[a-z]{2}$/.test(t) && codes.has(t)) {
      return t.toUpperCase();
    }
  }
  return null;
}

export type StateShape =
  | { kind: "path"; d: string }
  | { kind: "circle"; cx: string; cy: string; r: string };

export function loadStateShapes(svgXml: string): Record<string, StateShape> {
  const doc = new DOMParser().parseFromString(svgXml, "image/svg+xml");
  const out: Record<string, StateShape> = {};

  const paths = Array.from(doc.getElementsByTagName("path"));
  for (const el of paths) {
    const code = codeFromClass(el.getAttribute("class"));
    if (!code) continue;
    const d = el.getAttribute("d");
    if (!d) continue;
    if (code === "DC") {
      out.DC = { kind: "path", d };
      continue;
    }
    out[code] = { kind: "path", d };
  }

  const circles = Array.from(doc.getElementsByTagName("circle"));
  for (const el of circles) {
    const code = codeFromClass(el.getAttribute("class"));
    if (code !== "DC") continue;
    out.DC = {
      kind: "circle",
      cx: el.getAttribute("cx") ?? "0",
      cy: el.getAttribute("cy") ?? "0",
      r: el.getAttribute("r") ?? "5",
    };
  }

  return out;
}

export function getShapesForSvg(svgXml: string): Record<string, StateShape> {
  return loadStateShapes(svgXml);
}
