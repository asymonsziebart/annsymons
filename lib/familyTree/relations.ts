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

export type PersonRelations = {
  person: FamilyTreePerson;
  parents: FamilyTreePerson[];
  siblings: FamilyTreePerson[];
  spouses: FamilyTreePerson[];
  children: FamilyTreePerson[];
  parentFamilies: string[];
};

export function buildRelationIndex(data: FamilyTreeData) {
  const byId = new Map(data.people.map((p) => [p.id, p]));
  const childrenByFamily = new Map<string, FamilyTreePerson[]>();
  for (const person of data.people) {
    if (!person.familyId) continue;
    const list = childrenByFamily.get(person.familyId) ?? [];
    list.push(person);
    childrenByFamily.set(person.familyId, list);
  }
  for (const [, list] of childrenByFamily) {
    list.sort((a, b) => a.siblingOrder - b.siblingOrder || personDisplayName(a).localeCompare(personDisplayName(b)));
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

  function getRelations(personId: string): PersonRelations | null {
    const person = byId.get(personId);
    if (!person) return null;

    const parents: FamilyTreePerson[] = [];
    if (person.familyId) {
      const family = data.families.find((f) => f.id === person.familyId);
      if (family?.partner1Id && byId.has(family.partner1Id)) {
        parents.push(byId.get(family.partner1Id)!);
      }
      if (family?.partner2Id && byId.has(family.partner2Id)) {
        parents.push(byId.get(family.partner2Id)!);
      }
    }

    const siblings =
      person.familyId != null
        ? (childrenByFamily.get(person.familyId) ?? []).filter((p) => p.id !== person.id)
        : [];

    const parentFamilies = familiesByPartner.get(person.id) ?? [];
    const spouses: FamilyTreePerson[] = [];
    const children: FamilyTreePerson[] = [];
    for (const familyId of parentFamilies) {
      const family = data.families.find((f) => f.id === familyId);
      if (!family) continue;
      const spouseId =
        family.partner1Id === person.id
          ? family.partner2Id
          : family.partner2Id === person.id
            ? family.partner1Id
            : null;
      if (spouseId && byId.has(spouseId) && !spouses.some((s) => s.id === spouseId)) {
        spouses.push(byId.get(spouseId)!);
      }
      for (const child of childrenByFamily.get(familyId) ?? []) {
        if (!children.some((c) => c.id === child.id)) children.push(child);
      }
    }

    return { person, parents, siblings, spouses, children, parentFamilies };
  }

  return { byId, childrenByFamily, getRelations };
}
