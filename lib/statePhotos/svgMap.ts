import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

import { ALL_CODES } from "./states";
import { patternImageTransform } from "./framing";

const SVG_NS = "http://www.w3.org/2000/svg";

/** xmldom document (avoid clashing with DOM lib `Document` typings). */
type SvgDom = {
  documentElement: Element;
  getElementsByTagName: (name: string) => ArrayLike<Element>;
  createElementNS: (namespaceURI: string | null, qualifiedName: string) => Element;
};

export type CoverSpec = {
  href: string;
  focus_x: number;
  focus_y: number;
  zoom: number;
};

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

function localTag(tag: string): string {
  return tag.includes("}") ? (tag.split("}", 2)[1] ?? tag) : tag;
}

function ensureDefs(doc: SvgDom): Element {
  const root = doc.documentElement;
  const list = doc.getElementsByTagName("defs");
  if (list.length > 0) return list[0] as Element;
  const defs = doc.createElementNS(SVG_NS, "defs");
  root.insertBefore(defs, root.firstChild);
  return defs;
}

export function buildMapSvg(
  svgXml: string,
  covers: Record<string, CoverSpec>,
  pathPrefix: string
): string {
  const base = pathPrefix.replace(/\/$/, "");
  const stateBase = base ? `${base}/state` : "/state";

  const doc = new DOMParser().parseFromString(svgXml, "image/svg+xml") as unknown as SvgDom;
  const root = doc.documentElement;
  const defs = ensureDefs(doc);

  const existingPatternIds = new Set<string>();
  for (let i = 0; i < defs.childNodes.length; i++) {
    const ch = defs.childNodes.item(i);
    if (ch?.nodeType === 1 && localTag((ch as Element).tagName) === "pattern") {
      const id = (ch as Element).getAttribute("id");
      if (id) existingPatternIds.add(id);
    }
  }

  for (const [code, spec] of Object.entries(covers)) {
    const pid = `photo-pat-${code}`;
    if (existingPatternIds.has(pid)) continue;
    existingPatternIds.add(pid);
    const pattern = doc.createElementNS(SVG_NS, "pattern");
    pattern.setAttribute("id", pid);
    pattern.setAttribute("patternContentUnits", "objectBoundingBox");
    pattern.setAttribute("width", "1");
    pattern.setAttribute("height", "1");
    const img = doc.createElementNS(SVG_NS, "image");
    img.setAttribute("href", spec.href);
    img.setAttribute("width", "1");
    img.setAttribute("height", "1");
    img.setAttribute("preserveAspectRatio", "xMidYMid slice");
    img.setAttribute("transform", patternImageTransform(spec.focus_x, spec.focus_y, spec.zoom));
    pattern.appendChild(img);
    defs.appendChild(pattern);
  }

  const paths = Array.from(doc.getElementsByTagName("path"));
  for (const el of paths) {
    const code = codeFromClass(el.getAttribute("class"));
    if (!code) continue;
    if (code === "DC") {
      el.setAttribute("style", "display:none;");
      continue;
    }
    el.setAttribute("id", `state-path-${code}`);
    el.setAttribute("data-state", code);
    const onclick = `window.location.href='${stateBase}/${code}';`;
    if (covers[code]) {
      el.setAttribute("fill", `url(#photo-pat-${code})`);
      el.setAttribute("style", `cursor:pointer;${el.getAttribute("style") ?? ""}`);
    } else {
      el.setAttribute("style", "cursor:pointer;");
    }
    el.setAttribute("onclick", onclick);
  }

  const circles = Array.from(doc.getElementsByTagName("circle"));
  for (const el of circles) {
    const code = codeFromClass(el.getAttribute("class"));
    if (code !== "DC") continue;
    el.setAttribute("id", "state-path-DC");
    el.setAttribute("data-state", "DC");
    const onclick = `window.location.href='${stateBase}/DC';`;
    if (covers.DC) {
      el.setAttribute("fill", "url(#photo-pat-DC)");
    }
    el.setAttribute("style", "cursor:pointer;");
    el.setAttribute("onclick", onclick);
  }

  return new XMLSerializer().serializeToString(root as never);
}
