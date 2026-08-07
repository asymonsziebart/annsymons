import type { FamilyTreePerson, FamilyTreeViewMode } from "@/lib/familyTree/types";
import {
  buildRelationIndex,
  personDisplayName,
  type FamilyUnion,
  type PersonRelations,
} from "@/lib/familyTree/relations";

export const NODE_RADIUS = 34;
export const LABEL_HEIGHT = 28;
export const GENERATION_GAP = 170;
export const SIBLING_GAP = 56;
export const UNION_GAP = 96;
export const COUPLE_GAP = 110;

export type LayoutPerson = {
  /** Unique key for this placed node (may duplicate a person across blended columns). */
  id: string;
  person: FamilyTreePerson;
  x: number;
  y: number;
  isFocus: boolean;
};

export type LayoutMarriage = {
  id: string;
  x: number;
  y: number;
  partnerIds: [string, string];
};

export type LayoutEdge = {
  id: string;
  points: Array<{ x: number; y: number }>;
};

export type TreeLayout = {
  people: LayoutPerson[];
  marriages: LayoutMarriage[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  focusX: number;
  focusY: number;
};

type Index = ReturnType<typeof buildRelationIndex>;

function showsSiblings(mode: FamilyTreeViewMode): boolean {
  return mode === "siblings_child_spouse";
}

function maxDescendantDepth(mode: FamilyTreeViewMode): number {
  if (
    mode === "child" ||
    mode === "child_spouse" ||
    mode === "siblings_child_spouse"
  ) {
    return 1;
  }
  if (mode === "grandchild") return 2;
  return Number.POSITIVE_INFINITY;
}

function shouldShowSpouses(mode: FamilyTreeViewMode, depthFromFocus: number): boolean {
  if (depthFromFocus === 0) return true; // always show the focus person's partners
  if (mode === "child") return false;
  return true;
}

/** Compact modes show one partner per descendant to keep columns readable. */
function maxSpousesToShow(mode: FamilyTreeViewMode, depthFromFocus: number): number {
  if (depthFromFocus === 0) return Number.POSITIVE_INFINITY;
  if (mode === "child") return 0;
  if (mode === "child_spouse" || mode === "siblings_child_spouse") return 1;
  return Number.POSITIVE_INFINITY;
}

function unitWidth(hasSpouse: boolean): number {
  const diameter = NODE_RADIUS * 2;
  if (!hasSpouse) return diameter;
  return diameter * 2 + COUPLE_GAP;
}

/** Width of a person with N spouses arranged in a horizontal partner chain. */
function partnerChainWidth(spouseCount: number): number {
  if (spouseCount <= 0) return NODE_RADIUS * 2;
  const people = 1 + spouseCount;
  return people * (NODE_RADIUS * 2) + spouseCount * COUPLE_GAP;
}

function spouseCountForLayout(
  rel: PersonRelations,
  mode: FamilyTreeViewMode,
  depthFromFocus: number
): number {
  const max = maxSpousesToShow(mode, depthFromFocus);
  if (max <= 0) return 0;
  const count = rel.unions.filter((u) => u.spouse).length;
  return Math.min(count, max);
}

function unionsForPartnerDisplay(
  unions: FamilyUnion[],
  mode: FamilyTreeViewMode,
  depthFromFocus: number
): FamilyUnion[] {
  const max = maxSpousesToShow(mode, depthFromFocus);
  if (max <= 0) return [];
  const withSpouse = unions.filter((u) => u.spouse);
  if (max === Number.POSITIVE_INFINITY) return withSpouse;
  return withSpouse.slice(0, max);
}

function addPerson(
  person: FamilyTreePerson,
  x: number,
  y: number,
  isFocus: boolean,
  peopleOut: LayoutPerson[],
  placedIds: Set<string>,
  layoutKey?: string
): void {
  const key = layoutKey ?? person.id;
  if (placedIds.has(key)) {
    if (isFocus) {
      const existing = peopleOut.find((p) => p.id === key);
      if (existing) existing.isFocus = true;
    }
    return;
  }
  peopleOut.push({ id: key, person, x, y, isFocus });
  placedIds.add(key);
}

function addMarriage(
  id: string,
  x: number,
  y: number,
  partnerIds: [string, string],
  marriagesOut: LayoutMarriage[],
  edgesOut: LayoutEdge[],
  leftX: number,
  rightX: number
): void {
  marriagesOut.push({ id, x, y, partnerIds });
  edgesOut.push({
    id: `e-couple-${id}`,
    points: [
      { x: leftX, y },
      { x: rightX, y },
    ],
  });
}

function connectDrop(
  fromX: number,
  fromY: number,
  childCenters: number[],
  childY: number,
  edgeId: string,
  edgesOut: LayoutEdge[]
): void {
  if (childCenters.length === 0) return;
  const dropFromY = fromY + NODE_RADIUS + 8;
  const busY = fromY + GENERATION_GAP / 2;
  const dropToY = childY - NODE_RADIUS - LABEL_HEIGHT + 4;

  edgesOut.push({
    id: `${edgeId}-drop`,
    points: [
      { x: fromX, y: dropFromY },
      { x: fromX, y: busY },
    ],
  });

  if (childCenters.length === 1) {
    edgesOut.push({
      id: `${edgeId}-child`,
      points: [
        { x: fromX, y: busY },
        { x: childCenters[0], y: busY },
        { x: childCenters[0], y: dropToY },
      ],
    });
    return;
  }

  const minX = Math.min(...childCenters);
  const maxX = Math.max(...childCenters);
  edgesOut.push({
    id: `${edgeId}-bus`,
    points: [
      { x: minX, y: busY },
      { x: maxX, y: busY },
    ],
  });
  if (fromX < minX || fromX > maxX) {
    edgesOut.push({
      id: `${edgeId}-to-bus`,
      points: [
        { x: fromX, y: busY },
        { x: Math.min(Math.max(fromX, minX), maxX), y: busY },
      ],
    });
  }
  for (let i = 0; i < childCenters.length; i++) {
    edgesOut.push({
      id: `${edgeId}-child-${i}`,
      points: [
        { x: childCenters[i], y: busY },
        { x: childCenters[i], y: dropToY },
      ],
    });
  }
}

/**
 * Place focus/person with one or more spouses in a chain:
 * [SpouseA]—◆—[Person]—◆—[SpouseB]
 * Children of each union drop from that union's knot only.
 */
function placePartnerChain(
  person: FamilyTreePerson,
  unions: FamilyUnion[],
  centerX: number,
  y: number,
  isFocus: boolean,
  mode: FamilyTreeViewMode,
  depthFromFocus: number,
  peopleOut: LayoutPerson[],
  marriagesOut: LayoutMarriage[],
  edgesOut: LayoutEdge[],
  placedIds: Set<string>
): { personX: number; knotByFamilyId: Map<string, number> } {
  const showSpouses = shouldShowSpouses(mode, depthFromFocus);
  const displayUnions = showSpouses
    ? unionsForPartnerDisplay(unions, mode, depthFromFocus)
    : [];

  const spouses: FamilyTreePerson[] = [];
  for (const u of displayUnions) {
    if (u.spouse && !spouses.some((s) => s.id === u.spouse!.id)) spouses.push(u.spouse);
  }

  if (spouses.length === 0) {
    addPerson(person, centerX, y, isFocus, peopleOut, placedIds);
    const knotByFamilyId = new Map<string, number>();
    for (const u of unions) knotByFamilyId.set(u.familyId, centerX);
    return { personX: centerX, knotByFamilyId };
  }

  // Alternate spouses left/right around the person for a balanced chain.
  const leftSpouses: FamilyTreePerson[] = [];
  const rightSpouses: FamilyTreePerson[] = [];
  spouses.forEach((s, i) => {
    if (i % 2 === 0) leftSpouses.unshift(s);
    else rightSpouses.push(s);
  });

  const chain = [...leftSpouses, person, ...rightSpouses];
  const totalWidth = partnerChainWidth(spouses.length);
  let cursor = centerX - totalWidth / 2 + NODE_RADIUS;
  const xById = new Map<string, number>();

  for (let i = 0; i < chain.length; i++) {
    const p = chain[i];
    addPerson(p, cursor, y, p.id === person.id && isFocus, peopleOut, placedIds);
    xById.set(p.id, cursor);
    if (i < chain.length - 1) {
      cursor += NODE_RADIUS * 2 + COUPLE_GAP;
    }
  }

  const personX = xById.get(person.id) ?? centerX;
  const knotByFamilyId = new Map<string, number>();

  for (const union of displayUnions) {
    const spouse = union.spouse;
    if (!spouse) {
      knotByFamilyId.set(union.familyId, personX);
      continue;
    }
    const sx = xById.get(spouse.id);
    if (sx == null) {
      knotByFamilyId.set(union.familyId, personX);
      continue;
    }
    const leftX = Math.min(personX, sx);
    const rightX = Math.max(personX, sx);
    const knotX = (leftX + rightX) / 2;
    addMarriage(
      `m-${union.familyId}`,
      knotX,
      y,
      [person.id, spouse.id],
      marriagesOut,
      edgesOut,
      leftX,
      rightX
    );
    knotByFamilyId.set(union.familyId, knotX);
  }

  // Every union (including those without a drawn spouse) needs a drop anchor.
  for (const union of unions) {
    if (!knotByFamilyId.has(union.familyId)) {
      // Prefer a nearby displayed spouse knot on the same side, else the person.
      knotByFamilyId.set(union.familyId, personX);
    }
  }

  return { personX, knotByFamilyId };
}

function measureChildBlock(
  index: Index,
  children: FamilyTreePerson[],
  mode: FamilyTreeViewMode,
  depthFromFocus: number
): number {
  if (children.length === 0) return 0;
  let width = 0;
  for (let i = 0; i < children.length; i++) {
    width += measureSubtree(index, children[i].id, mode, depthFromFocus + 1);
    if (i < children.length - 1) width += SIBLING_GAP;
  }
  return width;
}

function measureSubtree(
  index: Index,
  personId: string,
  mode: FamilyTreeViewMode,
  depthFromFocus: number
): number {
  const rel = index.getRelations(personId);
  if (!rel) return NODE_RADIUS * 2;

  const spouseCount = spouseCountForLayout(rel, mode, depthFromFocus);
  const selfWidth = partnerChainWidth(spouseCount);

  const maxDepth = maxDescendantDepth(mode);
  if (depthFromFocus >= maxDepth) return selfWidth;

  const unions = rel.unions.filter((u) => u.children.length > 0);
  if (unions.length === 0) return selfWidth;

  let kidsWidth = 0;
  for (let i = 0; i < unions.length; i++) {
    kidsWidth += measureChildBlock(index, unions[i].children, mode, depthFromFocus);
    if (i < unions.length - 1) kidsWidth += UNION_GAP;
  }

  return Math.max(selfWidth, kidsWidth);
}

/** Push preferred centers apart so [center - width/2, center + width/2] ranges never overlap. */
function resolveCenters(
  items: Array<{ preferred: number; width: number }>
): number[] {
  if (items.length === 0) return [];
  const sorted = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.preferred - b.preferred || a.index - b.index);

  const centers = sorted.map((item) => item.preferred);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const minCenter = centers[i - 1] + prev.width / 2 + UNION_GAP + cur.width / 2;
    if (centers[i] < minCenter) centers[i] = minCenter;
  }
  for (let i = sorted.length - 2; i >= 0; i--) {
    const next = sorted[i + 1];
    const cur = sorted[i];
    const maxCenter = centers[i + 1] - next.width / 2 - UNION_GAP - cur.width / 2;
    if (centers[i] > maxCenter) centers[i] = maxCenter;
  }

  // Map back to original order.
  const byOriginal = new Array<number>(items.length);
  for (let i = 0; i < sorted.length; i++) {
    byOriginal[sorted[i].index] = centers[i];
  }
  return byOriginal;
}

function placeUnionChildrenAtCenter(
  index: Index,
  union: FamilyUnion,
  blockCenter: number,
  knotX: number,
  parentY: number,
  mode: FamilyTreeViewMode,
  depthFromFocus: number,
  peopleOut: LayoutPerson[],
  marriagesOut: LayoutMarriage[],
  edgesOut: LayoutEdge[],
  placedIds: Set<string>
): void {
  if (union.children.length === 0) return;
  const maxDepth = maxDescendantDepth(mode);
  if (depthFromFocus >= maxDepth) return;

  const childY = parentY + GENERATION_GAP;
  const widths = union.children.map((child) =>
    measureSubtree(index, child.id, mode, depthFromFocus + 1)
  );
  const total =
    widths.reduce((a, b) => a + b, 0) + SIBLING_GAP * Math.max(0, union.children.length - 1);

  let cursor = blockCenter - total / 2;
  const centers: number[] = [];

  for (let i = 0; i < union.children.length; i++) {
    const child = union.children[i];
    const w = widths[i];
    const center = cursor + w / 2;
    centers.push(center);
    placeSubtree(
      index,
      child.id,
      mode,
      depthFromFocus + 1,
      center,
      childY,
      peopleOut,
      marriagesOut,
      edgesOut,
      placedIds,
      false
    );
    cursor += w + SIBLING_GAP;
  }

  connectDrop(knotX, parentY, centers, childY, `e-union-${union.familyId}`, edgesOut);
}

function placeDescendantsByUnions(
  index: Index,
  rel: PersonRelations,
  knotByFamilyId: Map<string, number>,
  y: number,
  mode: FamilyTreeViewMode,
  depthFromFocus: number,
  peopleOut: LayoutPerson[],
  marriagesOut: LayoutMarriage[],
  edgesOut: LayoutEdge[],
  placedIds: Set<string>
): void {
  const maxDepth = maxDescendantDepth(mode);
  if (depthFromFocus >= maxDepth) return;

  const unions = rel.unions.filter((u) => u.children.length > 0);
  if (unions.length === 0) return;

  const blocks = unions.map((union) => {
    const width = measureChildBlock(index, union.children, mode, depthFromFocus);
    const preferred = knotByFamilyId.get(union.familyId) ?? 0;
    return { union, width: Math.max(width, NODE_RADIUS * 2), preferred };
  });

  const centers = resolveCenters(
    blocks.map((b) => ({ preferred: b.preferred, width: b.width }))
  );

  for (let i = 0; i < blocks.length; i++) {
    placeUnionChildrenAtCenter(
      index,
      blocks[i].union,
      centers[i],
      blocks[i].preferred,
      y,
      mode,
      depthFromFocus,
      peopleOut,
      marriagesOut,
      edgesOut,
      placedIds
    );
  }
}

function placeSubtree(
  index: Index,
  personId: string,
  mode: FamilyTreeViewMode,
  depthFromFocus: number,
  centerX: number,
  y: number,
  peopleOut: LayoutPerson[],
  marriagesOut: LayoutMarriage[],
  edgesOut: LayoutEdge[],
  placedIds: Set<string>,
  isFocus: boolean
): void {
  const rel = index.getRelations(personId);
  if (!rel) return;

  const { knotByFamilyId } = placePartnerChain(
    rel.person,
    rel.unions,
    centerX,
    y,
    isFocus,
    mode,
    depthFromFocus,
    peopleOut,
    marriagesOut,
    edgesOut,
    placedIds
  );

  placeDescendantsByUnions(
    index,
    rel,
    knotByFamilyId,
    y,
    mode,
    depthFromFocus,
    peopleOut,
    marriagesOut,
    edgesOut,
    placedIds
  );
}

export function buildTreeLayout(
  index: Index,
  focusId: string,
  mode: FamilyTreeViewMode
): TreeLayout | null {
  const rel = index.getRelations(focusId);
  if (!rel) return null;

  const peopleOut: LayoutPerson[] = [];
  const marriagesOut: LayoutMarriage[] = [];
  const edgesOut: LayoutEdge[] = [];
  const placedIds = new Set<string>();

  const focusX = 0;
  const focusY = 0;

  if (showsSiblings(mode) && (rel.siblings.length > 0 || rel.halfSiblings.length > 0)) {
    // One column per parental couple so half-siblings only hang under their real parents.
    // Parents may appear in more than one column when they had kids with multiple partners.
    const peers = [rel.person, ...rel.siblings, ...rel.halfSiblings];
    const parentY = focusY - GENERATION_GAP;
    const focusFamilyId = rel.person.familyId;

    const peersByFamily = new Map<string, FamilyTreePerson[]>();
    for (const peer of peers) {
      if (!peer.familyId) continue;
      const list = peersByFamily.get(peer.familyId) ?? [];
      list.push(peer);
      peersByFamily.set(peer.familyId, list);
    }

    type Column = {
      familyId: string;
      parents: FamilyTreePerson[];
      kids: FamilyTreePerson[];
      kidWidths: number[];
      kidsWidth: number;
      coupleWidth: number;
      width: number;
      center: number;
    };

    const columns: Column[] = [];
    for (const [familyId, kids] of peersByFamily.entries()) {
      const sample = kids[0];
      const sampleRel = index.getRelations(sample.id);
      const parents = sampleRel?.parents ?? [];
      const sortedKids = [...kids].sort(
        (a, b) =>
          a.siblingOrder - b.siblingOrder ||
          personDisplayName(a).localeCompare(personDisplayName(b))
      );
      const kidWidths = sortedKids.map((kid) => {
        const kidRel = index.getRelations(kid.id);
        if (!kidRel) return NODE_RADIUS * 2;
        // Peers share the focus generation; non-focus peers use compact spouse count.
        const depth = kid.id === focusId ? 0 : 1;
        return partnerChainWidth(spouseCountForLayout(kidRel, mode, depth));
      });
      const kidsWidth =
        kidWidths.reduce((s, w) => s + w, 0) +
        SIBLING_GAP * Math.max(0, sortedKids.length - 1);
      const coupleWidth =
        parents.length >= 2 ? unitWidth(true) : parents.length === 1 ? NODE_RADIUS * 2 : 0;
      const width = Math.max(kidsWidth, coupleWidth, NODE_RADIUS * 2);
      columns.push({
        familyId,
        parents,
        kids: sortedKids,
        kidWidths,
        kidsWidth,
        coupleWidth,
        width,
        center: 0,
      });
    }

    // Put the focus person's parental family in the middle, then others by name.
    columns.sort((a, b) => {
      if (a.familyId === focusFamilyId) return -1;
      if (b.familyId === focusFamilyId) return 1;
      const an = a.parents.map(personDisplayName).join(" ");
      const bn = b.parents.map(personDisplayName).join(" ");
      return an.localeCompare(bn);
    });
    // Re-order so focus column is center-ish: focus first in array then distribute L/R
    const focusCol = columns.find((c) => c.familyId === focusFamilyId);
    const others = columns.filter((c) => c.familyId !== focusFamilyId);
    const ordered: Column[] = [];
    if (focusCol) {
      const left = others.slice(0, Math.ceil(others.length / 2));
      const right = others.slice(Math.ceil(others.length / 2));
      ordered.push(...left, focusCol, ...right);
    } else {
      ordered.push(...columns);
    }

    // Lay out column centers in a row, focus column at focusX.
    const columnGap = UNION_GAP * 1.5;
    const focusIndex = ordered.findIndex((c) => c.familyId === focusFamilyId);
    let before = 0;
    for (let i = 0; i < focusIndex; i++) {
      before += ordered[i].width + columnGap;
    }
    const focusWidth = ordered[focusIndex]?.width ?? NODE_RADIUS * 2;
    let cursor = focusX - focusWidth / 2 - before;
    for (const col of ordered) {
      col.center = cursor + col.width / 2;
      cursor += col.width + columnGap;
    }

    for (const col of ordered) {
      // Parents for this couple only (allow duplicate visual nodes via layoutKey).
      if (col.parents.length >= 2) {
        const leftX = col.center - (NODE_RADIUS + COUPLE_GAP / 2);
        const rightX = col.center + (NODE_RADIUS + COUPLE_GAP / 2);
        addPerson(
          col.parents[0],
          leftX,
          parentY,
          false,
          peopleOut,
          placedIds,
          `${col.parents[0].id}__${col.familyId}`
        );
        addPerson(
          col.parents[1],
          rightX,
          parentY,
          false,
          peopleOut,
          placedIds,
          `${col.parents[1].id}__${col.familyId}`
        );
        addMarriage(
          `m-blend-${col.familyId}`,
          col.center,
          parentY,
          [col.parents[0].id, col.parents[1].id],
          marriagesOut,
          edgesOut,
          leftX,
          rightX
        );
      } else if (col.parents.length === 1) {
        addPerson(
          col.parents[0],
          col.center,
          parentY,
          false,
          peopleOut,
          placedIds,
          `${col.parents[0].id}__${col.familyId}`
        );
      }

      let kidCursor = col.center - col.kidsWidth / 2;
      const childCenters: number[] = [];
      for (let i = 0; i < col.kids.length; i++) {
        const kid = col.kids[i];
        const w = col.kidWidths[i];
        const center = kidCursor + w / 2;
        childCenters.push(center);
        const kidRel = index.getRelations(kid.id);
        if (kidRel) {
          const depth = kid.id === focusId ? 0 : 1;
          placePartnerChain(
            kidRel.person,
            kidRel.unions,
            center,
            focusY,
            kid.id === focusId,
            mode,
            depth,
            peopleOut,
            marriagesOut,
            edgesOut,
            placedIds
          );
        }
        kidCursor += w + SIBLING_GAP;
      }

      if (col.parents.length > 0) {
        connectDrop(
          col.center,
          parentY,
          childCenters,
          focusY,
          `e-blend-${col.familyId}`,
          edgesOut
        );
      }
    }

    // Descendants of focus only, under focus's own unions.
    const focusPlaced = peopleOut.find((p) => p.person.id === focusId && p.isFocus);
    const focusRel2 = index.getRelations(focusId)!;
    const focusUnionsKnots = new Map<string, number>();
    for (const u of focusRel2.unions) {
      const m = marriagesOut.find(
        (mm) =>
          mm.partnerIds.includes(focusId) &&
          (u.spouse ? mm.partnerIds.includes(u.spouse.id) : false)
      );
      focusUnionsKnots.set(u.familyId, m?.x ?? focusPlaced?.x ?? focusX);
    }
    placeDescendantsByUnions(
      index,
      focusRel2,
      focusUnionsKnots,
      focusY,
      mode,
      0,
      peopleOut,
      marriagesOut,
      edgesOut,
      placedIds
    );
  } else {
    // Standard view: parents (biological couple) above, multi-partner chain for focus below.
    if (rel.parents.length > 0) {
      const parentY = focusY - GENERATION_GAP;
      if (rel.parents.length === 1) {
        addPerson(rel.parents[0], focusX, parentY, false, peopleOut, placedIds);
        connectDrop(focusX, parentY, [focusX], focusY, `e-parents-${focusId}`, edgesOut);
      } else {
        const [p1, p2] = rel.parents;
        const leftX = focusX - (NODE_RADIUS + COUPLE_GAP / 2);
        const rightX = focusX + (NODE_RADIUS + COUPLE_GAP / 2);
        addPerson(p1, leftX, parentY, false, peopleOut, placedIds);
        addPerson(p2, rightX, parentY, false, peopleOut, placedIds);
        addMarriage(
          `m-parents-${p1.id}-${p2.id}`,
          focusX,
          parentY,
          [p1.id, p2.id],
          marriagesOut,
          edgesOut,
          leftX,
          rightX
        );
        connectDrop(focusX, parentY, [focusX], focusY, `e-parents-${focusId}`, edgesOut);
      }
    }

    placeSubtree(
      index,
      focusId,
      mode,
      0,
      focusX,
      focusY,
      peopleOut,
      marriagesOut,
      edgesOut,
      placedIds,
      true
    );
  }

  // Recenter layout so the focus person node is at 0,0 for the canvas.
  const focusNode = peopleOut.find((p) => p.person.id === focusId && p.isFocus)
    ?? peopleOut.find((p) => p.person.id === focusId);
  const shiftX = focusNode ? -focusNode.x : 0;
  const shiftY = focusNode ? -focusNode.y : 0;
  if (shiftX || shiftY) {
    for (const p of peopleOut) {
      p.x += shiftX;
      p.y += shiftY;
    }
    for (const m of marriagesOut) {
      m.x += shiftX;
      m.y += shiftY;
    }
    for (const e of edgesOut) {
      for (const pt of e.points) {
        pt.x += shiftX;
        pt.y += shiftY;
      }
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of peopleOut) {
    minX = Math.min(minX, p.x - NODE_RADIUS - 40);
    maxX = Math.max(maxX, p.x + NODE_RADIUS + 40);
    minY = Math.min(minY, p.y - NODE_RADIUS - 20);
    maxY = Math.max(maxY, p.y + NODE_RADIUS + LABEL_HEIGHT + 20);
  }
  if (!Number.isFinite(minX)) {
    minX = -200;
    maxX = 200;
    minY = -200;
    maxY = 200;
  }

  return {
    people: peopleOut,
    marriages: marriagesOut,
    edges: edgesOut,
    width: maxX - minX,
    height: maxY - minY,
    focusX: 0,
    focusY: 0,
  };
}

export function shortDisplayName(person: FamilyTreePerson): string {
  if (person.given && person.surname) return `${person.given} ${person.surname}`;
  return personDisplayName(person);
}
