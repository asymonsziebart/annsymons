import type { FamilyTreeData, FamilyTreeDate, FamilyTreePerson } from "@/lib/familyTree/types";

export function personDisplayName(person: FamilyTreePerson): string {
  const parts = [person.given, person.middle, person.surname].filter(Boolean);
  const name = parts.join(" ").trim();
  return name || "Unknown";
}

export function formatTreeDate(date: FamilyTreeDate | null | undefined): string | null {
  if (!date?.year) return null;
  const month = date.month ? String(date.month).padStart(2, "0") : null;
  const day = date.day ? String(date.day).padStart(2, "0") : null;
  if (month && day) return `${month}/${day}/${date.year}`;
  if (month) return `${month}/${date.year}`;
  return String(date.year);
}

export function lifespanLabel(person: FamilyTreePerson): string {
  const birth = formatTreeDate(person.birth);
  const death = formatTreeDate(person.death);
  if (birth && death) return `${birth} – ${death}`;
  if (birth) return `b. ${birth}`;
  if (death) return `d. ${death}`;
  return "";
}

/** One partnership and the children born to that specific couple. */
export type FamilyUnion = {
  familyId: string;
  spouse: FamilyTreePerson | null;
  children: FamilyTreePerson[];
};

export type PersonRelations = {
  person: FamilyTreePerson;
  parents: FamilyTreePerson[];
  /** Same two parents (same parental family id). */
  siblings: FamilyTreePerson[];
  /** Share exactly one parent. */
  halfSiblings: FamilyTreePerson[];
  spouses: FamilyTreePerson[];
  /** All children across every union. */
  children: FamilyTreePerson[];
  /** Children grouped by the partner they were born with. */
  unions: FamilyUnion[];
  parentFamilies: string[];
};

function parentIdsFor(person: FamilyTreePerson, data: FamilyTreeData): string[] {
  if (!person.familyId) return [];
  const family = data.families.find((f) => f.id === person.familyId);
  if (!family) return [];
  return [family.partner1Id, family.partner2Id].filter((id): id is string => Boolean(id));
}

export function buildRelationIndex(data: FamilyTreeData) {
  const byId = new Map(data.people.map((p) => [p.id, p]));
  const familyById = new Map(data.families.map((f) => [f.id, f]));

  const childrenByFamily = new Map<string, FamilyTreePerson[]>();
  for (const person of data.people) {
    if (!person.familyId) continue;
    const list = childrenByFamily.get(person.familyId) ?? [];
    list.push(person);
    childrenByFamily.set(person.familyId, list);
  }
  for (const [, list] of childrenByFamily) {
    list.sort(
      (a, b) =>
        a.siblingOrder - b.siblingOrder ||
        personDisplayName(a).localeCompare(personDisplayName(b))
    );
  }

  const familiesByPartner = new Map<string, string[]>();
  for (const family of data.families) {
    for (const partnerId of [family.partner1Id, family.partner2Id]) {
      if (!partnerId) continue;
      const list = familiesByPartner.get(partnerId) ?? [];
      list.push(family.id);
      familiesByPartner.set(partnerId, list);
    }
  }

  // Children of each adult (across all their unions).
  const childrenByParent = new Map<string, FamilyTreePerson[]>();
  for (const family of data.families) {
    const kids = childrenByFamily.get(family.id) ?? [];
    for (const partnerId of [family.partner1Id, family.partner2Id]) {
      if (!partnerId) continue;
      const list = childrenByParent.get(partnerId) ?? [];
      for (const kid of kids) {
        if (!list.some((p) => p.id === kid.id)) list.push(kid);
      }
      childrenByParent.set(partnerId, list);
    }
  }

  function getRelations(personId: string): PersonRelations | null {
    const person = byId.get(personId);
    if (!person) return null;

    const parents: FamilyTreePerson[] = [];
    const ownParentIds = parentIdsFor(person, data);
    for (const pid of ownParentIds) {
      const parent = byId.get(pid);
      if (parent) parents.push(parent);
    }

    const siblings =
      person.familyId != null
        ? (childrenByFamily.get(person.familyId) ?? []).filter((p) => p.id !== person.id)
        : [];

    // Half-siblings: share exactly one parent, not already a full sibling.
    const halfSiblingMap = new Map<string, FamilyTreePerson>();
    for (const parentId of ownParentIds) {
      for (const candidate of childrenByParent.get(parentId) ?? []) {
        if (candidate.id === person.id) continue;
        if (siblings.some((s) => s.id === candidate.id)) continue;
        const candidateParentIds = parentIdsFor(candidate, data);
        const shared = candidateParentIds.filter((id) => ownParentIds.includes(id));
        if (shared.length === 1) {
          halfSiblingMap.set(candidate.id, candidate);
        }
      }
    }
    const halfSiblings = [...halfSiblingMap.values()].sort(
      (a, b) =>
        a.siblingOrder - b.siblingOrder ||
        personDisplayName(a).localeCompare(personDisplayName(b))
    );

    const parentFamilies = familiesByPartner.get(person.id) ?? [];
    const spouses: FamilyTreePerson[] = [];
    const children: FamilyTreePerson[] = [];
    const unions: FamilyUnion[] = [];

    for (const familyId of parentFamilies) {
      const family = familyById.get(familyId);
      if (!family) continue;
      const spouseId =
        family.partner1Id === person.id
          ? family.partner2Id
          : family.partner2Id === person.id
            ? family.partner1Id
            : null;
      const spouse = spouseId && byId.has(spouseId) ? byId.get(spouseId)! : null;
      if (spouse && !spouses.some((s) => s.id === spouse.id)) {
        spouses.push(spouse);
      }
      const unionChildren = childrenByFamily.get(familyId) ?? [];
      for (const child of unionChildren) {
        if (!children.some((c) => c.id === child.id)) children.push(child);
      }
      unions.push({
        familyId,
        spouse,
        children: unionChildren,
      });
    }

    // Prefer unions that have children first, then by spouse name for stable layout.
    unions.sort((a, b) => {
      const ac = a.children.length > 0 ? 0 : 1;
      const bc = b.children.length > 0 ? 0 : 1;
      if (ac !== bc) return ac - bc;
      const an = a.spouse ? personDisplayName(a.spouse) : "";
      const bn = b.spouse ? personDisplayName(b.spouse) : "";
      return an.localeCompare(bn);
    });

    return {
      person,
      parents,
      siblings,
      halfSiblings,
      spouses,
      children,
      unions,
      parentFamilies,
    };
  }

  return { byId, childrenByFamily, familiesByPartner, getRelations };
}
