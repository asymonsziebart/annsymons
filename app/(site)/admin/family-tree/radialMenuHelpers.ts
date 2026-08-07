import type { FamilyTreePerson } from "@/lib/familyTree/types";
import { personDisplayName as fullName } from "@/lib/familyTree/relations";

export function personDisplayName(person: FamilyTreePerson): string {
  return fullName(person);
}

export function shortName(person: FamilyTreePerson): string {
  if (person.given && person.surname) return `${person.given} ${person.surname}`;
  return fullName(person);
}
