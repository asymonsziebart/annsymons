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

function maxDescendantDepth(mode: FamilyTreeViewMode): number {
  if (mode === "child" || mode === "child_spouse") return 1;
  if (mode === "grandchild") return 2;
  return Number.POSITIVE_INFINITY;
}

function includeChildSpouses(mode: FamilyTreeViewMode, depthFromFocus: number): boolean {
  if (mode === "child") return false;
  if (mode === "child_spouse") return depthFromFocus === 1;
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
  const spouse = showSpouse ? rel.spouses[0] : undefined;

  let personX = centerX;
  let marriageX = centerX;
  let marriageY = y;

  if (spouse) {
    const leftIsFocus = true; // keep primary person on the left of the couple
    const left = leftIsFocus ? rel.person : spouse;
    const right = leftIsFocus ? spouse : rel.person;
    const leftX = centerX - (NODE_RADIUS + COUPLE_GAP / 2);
    const rightX = centerX + (NODE_RADIUS + COUPLE_GAP / 2);
    personX = left.id === personId ? leftX : rightX;
    const spouseX = left.id === personId ? rightX : leftX;

    if (!placedIds.has(rel.person.id)) {
      peopleOut.push({
        id: rel.person.id,
        person: rel.person,
        x: personX,
        y,
        isFocus,
      });
      placedIds.add(rel.person.id);
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

    marriageX = centerX;
    marriageY = y;
    const marriageId = `m-${rel.person.id}-${spouse.id}`;
    marriagesOut.push({
      id: marriageId,
      x: marriageX,
      y: marriageY,
      partnerIds: [rel.person.id, spouse.id],
    });
    edgesOut.push({
      id: `e-couple-${marriageId}`,
      points: [
        { x: leftX, y },
        { x: rightX, y },
      ],
    });
  } else if (!placedIds.has(rel.person.id)) {
    peopleOut.push({
      id: rel.person.id,
      person: rel.person,
      x: personX,
      y,
      isFocus,
    });
    placedIds.add(rel.person.id);
  }

  const maxDepth = maxDescendantDepth(mode);
  if (depthFromFocus >= maxDepth || rel.children.length === 0) return;

  const childY = y + GENERATION_GAP;
  const childWidths = rel.children.map((child) =>
    measureSubtree(index, child.id, mode, depthFromFocus + 1)
  );
  const totalKids =
    childWidths.reduce((a, b) => a + b, 0) + SIBLING_GAP * Math.max(0, rel.children.length - 1);

  let cursor = centerX - totalKids / 2;
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

  // Connector from marriage/person down to children
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

function placeParents(
  index: Index,
  rel: PersonRelations,
  focusX: number,
  focusY: number,
  peopleOut: LayoutPerson[],
  marriagesOut: LayoutMarriage[],
  edgesOut: LayoutEdge[],
  placedIds: Set<string>
): void {
  if (rel.parents.length === 0) return;

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

  const dropFromY = parentY + NODE_RADIUS + 8;
  const busY = parentY + GENERATION_GAP / 2;
  const dropToY = focusY - NODE_RADIUS - LABEL_HEIGHT + 4;

  edgesOut.push({
    id: `e-parents-drop-${rel.person.id}`,
    points: [
      { x: marriageX, y: dropFromY },
      { x: marriageX, y: busY },
      { x: focusX, y: busY },
      { x: focusX, y: dropToY },
    ],
  });
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

  placeParents(index, rel, focusX, focusY, peopleOut, marriagesOut, edgesOut, placedIds);
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
