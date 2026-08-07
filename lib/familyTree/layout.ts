import type { FamilyTreePerson, FamilyTreeViewMode } from "@/lib/familyTree/types";
import {
  buildRelationIndex,
  personDisplayName,
  type PersonRelations,
} from "@/lib/familyTree/relations";

export const NODE_RADIUS = 34;
export const LABEL_HEIGHT = 28;
export const GENERATION_GAP = 150;
export const SIBLING_GAP = 28;
export const COUPLE_GAP = 96;

export type LayoutPerson = {
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

function includeChildSpouses(mode: FamilyTreeViewMode, depthFromFocus: number): boolean {
  if (mode === "child") return false;
  if (mode === "child_spouse" || mode === "siblings_child_spouse") {
    return depthFromFocus === 1;
  }
  // grandchild + unlimited: spouses at every shown generation
  return true;
}

function unitWidth(hasSpouse: boolean): number {
  const diameter = NODE_RADIUS * 2;
  if (!hasSpouse) return diameter;
  return diameter * 2 + COUPLE_GAP;
}

function measureSubtree(
  index: Index,
  personId: string,
  mode: FamilyTreeViewMode,
  depthFromFocus: number
): number {
  const rel = index.getRelations(personId);
  if (!rel) return unitWidth(false);

  const showSpouse = depthFromFocus === 0 || includeChildSpouses(mode, depthFromFocus);
  const spouse = showSpouse ? rel.spouses[0] : undefined;
  const selfWidth = unitWidth(Boolean(spouse));

  const maxDepth = maxDescendantDepth(mode);
  if (depthFromFocus >= maxDepth || rel.children.length === 0) {
    return selfWidth;
  }

  let kidsWidth = 0;
  for (let i = 0; i < rel.children.length; i++) {
    const child = rel.children[i];
    kidsWidth += measureSubtree(index, child.id, mode, depthFromFocus + 1);
    if (i < rel.children.length - 1) kidsWidth += SIBLING_GAP;
  }

  return Math.max(selfWidth, kidsWidth);
}

function placePersonOrCouple(
  rel: PersonRelations,
  centerX: number,
  y: number,
  withSpouse: boolean,
  isFocus: boolean,
  peopleOut: LayoutPerson[],
  marriagesOut: LayoutMarriage[],
  edgesOut: LayoutEdge[],
  placedIds: Set<string>
): { marriageX: number; personX: number } {
  const spouse = withSpouse ? rel.spouses[0] : undefined;
  const personId = rel.person.id;

  if (spouse) {
    const leftX = centerX - (NODE_RADIUS + COUPLE_GAP / 2);
    const rightX = centerX + (NODE_RADIUS + COUPLE_GAP / 2);
    const personX = leftX;
    const spouseX = rightX;

    if (!placedIds.has(personId)) {
      peopleOut.push({
        id: personId,
        person: rel.person,
        x: personX,
        y,
        isFocus,
      });
      placedIds.add(personId);
    }
    if (!placedIds.has(spouse.id)) {
      peopleOut.push({
        id: spouse.id,
        person: spouse,
        x: spouseX,
        y,
        isFocus: false,
      });
      placedIds.add(spouse.id);
    }

    const marriageId = `m-${personId}-${spouse.id}`;
    marriagesOut.push({
      id: marriageId,
      x: centerX,
      y,
      partnerIds: [personId, spouse.id],
    });
    edgesOut.push({
      id: `e-couple-${marriageId}`,
      points: [
        { x: leftX, y },
        { x: rightX, y },
      ],
    });
    return { marriageX: centerX, personX };
  }

  if (!placedIds.has(personId)) {
    peopleOut.push({
      id: personId,
      person: rel.person,
      x: centerX,
      y,
      isFocus,
    });
    placedIds.add(personId);
  }
  return { marriageX: centerX, personX: centerX };
}

function placeDescendants(
  index: Index,
  personId: string,
  mode: FamilyTreeViewMode,
  depthFromFocus: number,
  marriageX: number,
  y: number,
  peopleOut: LayoutPerson[],
  marriagesOut: LayoutMarriage[],
  edgesOut: LayoutEdge[],
  placedIds: Set<string>
): void {
  const rel = index.getRelations(personId);
  if (!rel) return;

  const maxDepth = maxDescendantDepth(mode);
  if (depthFromFocus >= maxDepth || rel.children.length === 0) return;

  const childY = y + GENERATION_GAP;
  const childWidths = rel.children.map((child) =>
    measureSubtree(index, child.id, mode, depthFromFocus + 1)
  );
  const totalKids =
    childWidths.reduce((a, b) => a + b, 0) + SIBLING_GAP * Math.max(0, rel.children.length - 1);

  let cursor = marriageX - totalKids / 2;
  const childCenters: number[] = [];

  for (let i = 0; i < rel.children.length; i++) {
    const child = rel.children[i];
    const w = childWidths[i];
    const childCenter = cursor + w / 2;
    childCenters.push(childCenter);
    placeSubtree(
      index,
      child.id,
      mode,
      depthFromFocus + 1,
      childCenter,
      childY,
      peopleOut,
      marriagesOut,
      edgesOut,
      placedIds,
      false
    );
    cursor += w + SIBLING_GAP;
  }

  const dropFromY = y + NODE_RADIUS + 8;
  const busY = y + GENERATION_GAP / 2;
  const dropToY = childY - NODE_RADIUS - LABEL_HEIGHT + 4;

  edgesOut.push({
    id: `e-drop-${personId}`,
    points: [
      { x: marriageX, y: dropFromY },
      { x: marriageX, y: busY },
    ],
  });

  if (childCenters.length === 1) {
    edgesOut.push({
      id: `e-child-${personId}-${rel.children[0].id}`,
      points: [
        { x: marriageX, y: busY },
        { x: childCenters[0], y: busY },
        { x: childCenters[0], y: dropToY },
      ],
    });
  } else if (childCenters.length > 1) {
    const minX = Math.min(...childCenters);
    const maxX = Math.max(...childCenters);
    edgesOut.push({
      id: `e-bus-${personId}`,
      points: [
        { x: minX, y: busY },
        { x: maxX, y: busY },
      ],
    });
    for (let i = 0; i < childCenters.length; i++) {
      edgesOut.push({
        id: `e-child-${personId}-${rel.children[i].id}`,
        points: [
          { x: childCenters[i], y: busY },
          { x: childCenters[i], y: dropToY },
        ],
      });
    }
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

  const showSpouse = depthFromFocus === 0 || includeChildSpouses(mode, depthFromFocus);
  const { marriageX } = placePersonOrCouple(
    rel,
    centerX,
    y,
    showSpouse,
    isFocus,
    peopleOut,
    marriagesOut,
    edgesOut,
    placedIds
  );

  placeDescendants(
    index,
    personId,
    mode,
    depthFromFocus,
    marriageX,
    y,
    peopleOut,
    marriagesOut,
    edgesOut,
    placedIds
  );
}

function placeParentsOnly(
  rel: PersonRelations,
  focusX: number,
  focusY: number,
  peopleOut: LayoutPerson[],
  marriagesOut: LayoutMarriage[],
  edgesOut: LayoutEdge[],
  placedIds: Set<string>
): number | null {
  if (rel.parents.length === 0) return null;

  const parentY = focusY - GENERATION_GAP;
  let marriageX = focusX;

  if (rel.parents.length === 1) {
    const parent = rel.parents[0];
    if (!placedIds.has(parent.id)) {
      peopleOut.push({
        id: parent.id,
        person: parent,
        x: focusX,
        y: parentY,
        isFocus: false,
      });
      placedIds.add(parent.id);
    }
    marriageX = focusX;
  } else {
    const [p1, p2] = rel.parents;
    const leftX = focusX - (NODE_RADIUS + COUPLE_GAP / 2);
    const rightX = focusX + (NODE_RADIUS + COUPLE_GAP / 2);
    if (!placedIds.has(p1.id)) {
      peopleOut.push({ id: p1.id, person: p1, x: leftX, y: parentY, isFocus: false });
      placedIds.add(p1.id);
    }
    if (!placedIds.has(p2.id)) {
      peopleOut.push({ id: p2.id, person: p2, x: rightX, y: parentY, isFocus: false });
      placedIds.add(p2.id);
    }
    marriageX = focusX;
    const marriageId = `m-parents-${p1.id}-${p2.id}`;
    marriagesOut.push({
      id: marriageId,
      x: marriageX,
      y: parentY,
      partnerIds: [p1.id, p2.id],
    });
    edgesOut.push({
      id: `e-couple-${marriageId}`,
      points: [
        { x: leftX, y: parentY },
        { x: rightX, y: parentY },
      ],
    });
  }

  return marriageX;
}

function connectParentsToChildren(
  parentMarriageX: number,
  parentY: number,
  childCenters: number[],
  childY: number,
  edgeId: string,
  edgesOut: LayoutEdge[]
): void {
  if (childCenters.length === 0) return;

  const dropFromY = parentY + NODE_RADIUS + 8;
  const busY = parentY + GENERATION_GAP / 2;
  const dropToY = childY - NODE_RADIUS - LABEL_HEIGHT + 4;

  edgesOut.push({
    id: `${edgeId}-drop`,
    points: [
      { x: parentMarriageX, y: dropFromY },
      { x: parentMarriageX, y: busY },
    ],
  });

  if (childCenters.length === 1) {
    edgesOut.push({
      id: `${edgeId}-child`,
      points: [
        { x: parentMarriageX, y: busY },
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
  // Also connect parent drop into the bus if parent isn't already on it
  if (parentMarriageX < minX || parentMarriageX > maxX) {
    edgesOut.push({
      id: `${edgeId}-to-bus`,
      points: [
        { x: parentMarriageX, y: busY },
        { x: Math.min(Math.max(parentMarriageX, minX), maxX), y: busY },
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
  const parentY = focusY - GENERATION_GAP;

  const parentMarriageX = placeParentsOnly(
    rel,
    focusX,
    focusY,
    peopleOut,
    marriagesOut,
    edgesOut,
    placedIds
  );

  if (showsSiblings(mode)) {
    // Focus generation: siblings (+ spouses) in a row, focus unit centered at 0.
    const peers = [rel.person, ...rel.siblings].sort(
      (a, b) =>
        a.siblingOrder - b.siblingOrder ||
        personDisplayName(a).localeCompare(personDisplayName(b))
    );

    const peerWidths = peers.map((peer) => {
      const peerRel = index.getRelations(peer.id);
      const hasSpouse = Boolean(peerRel?.spouses[0]);
      return unitWidth(hasSpouse);
    });

    const focusIndex = peers.findIndex((p) => p.id === focusId);
    let before = 0;
    for (let i = 0; i < focusIndex; i++) {
      before += peerWidths[i] + SIBLING_GAP;
    }
    const focusUnitWidth = peerWidths[focusIndex] ?? unitWidth(Boolean(rel.spouses[0]));
    // Left edge of focus unit should be at -focusUnitWidth/2 so center is 0
    const rowLeft = -focusUnitWidth / 2 - before;

    const peerCenters: number[] = [];
    let cursor = rowLeft;
    let focusMarriageX = focusX;

    for (let i = 0; i < peers.length; i++) {
      const peer = peers[i];
      const peerRel = index.getRelations(peer.id);
      const w = peerWidths[i];
      const center = cursor + w / 2;
      peerCenters.push(center);
      if (peerRel) {
        const { marriageX } = placePersonOrCouple(
          peerRel,
          center,
          focusY,
          true,
          peer.id === focusId,
          peopleOut,
          marriagesOut,
          edgesOut,
          placedIds
        );
        if (peer.id === focusId) focusMarriageX = marriageX;
      }
      cursor += w + SIBLING_GAP;
    }

    if (parentMarriageX != null) {
      connectParentsToChildren(
        parentMarriageX,
        parentY,
        peerCenters,
        focusY,
        `e-parents-${focusId}`,
        edgesOut
      );
    }

    placeDescendants(
      index,
      focusId,
      mode,
      0,
      focusMarriageX,
      focusY,
      peopleOut,
      marriagesOut,
      edgesOut,
      placedIds
    );
  } else {
    if (parentMarriageX != null) {
      connectParentsToChildren(
        parentMarriageX,
        parentY,
        [focusX],
        focusY,
        `e-parents-${focusId}`,
        edgesOut
      );
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
    focusX,
    focusY,
  };
}

export function shortDisplayName(person: FamilyTreePerson): string {
  if (person.given && person.surname) return `${person.given} ${person.surname}`;
  return personDisplayName(person);
}
