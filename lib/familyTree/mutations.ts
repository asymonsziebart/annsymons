import type {
  FamilyTreeData,
  FamilyTreeDate,
  FamilyTreeFamily,
  FamilyTreePerson,
} from "@/lib/familyTree/types";

function newId(): string {
  return String(Math.floor(Math.random() * 900000) + 100000 + Date.now() % 100000);
}

function emptyPerson(
  partial: Partial<FamilyTreePerson> & { gender: FamilyTreePerson["gender"] }
): FamilyTreePerson {
  return {
    id: partial.id ?? newId(),
    familyId: partial.familyId ?? null,
    siblingOrder: partial.siblingOrder ?? 0,
    x: 0,
    y: 0,
    surname: partial.surname ?? "",
    given: partial.given ?? "",
    middle: partial.middle ?? null,
    birth: partial.birth ?? null,
    death: partial.death ?? null,
    gender: partial.gender,
    photoUrl: partial.photoUrl ?? null,
  };
}

export type PersonEditInput = {
  given?: string;
  surname?: string;
  middle?: string | null;
  gender?: FamilyTreePerson["gender"];
  birth?: FamilyTreeDate | null;
  death?: FamilyTreeDate | null;
  photoUrl?: string | null;
};

export function updatePerson(
  tree: FamilyTreeData,
  personId: string,
  patch: PersonEditInput
): FamilyTreeData {
  return {
    ...tree,
    people: tree.people.map((p) => {
      if (p.id !== personId) return p;
      return {
        ...p,
        given: patch.given !== undefined ? patch.given.trim() : p.given,
        surname: patch.surname !== undefined ? patch.surname.trim() : p.surname,
        middle:
          patch.middle !== undefined
            ? patch.middle?.trim() || null
            : p.middle,
        gender: patch.gender ?? p.gender,
        birth: patch.birth !== undefined ? patch.birth : p.birth,
        death: patch.death !== undefined ? patch.death : p.death,
        photoUrl: patch.photoUrl !== undefined ? patch.photoUrl : p.photoUrl,
      };
    }),
  };
}

export function removePerson(tree: FamilyTreeData, personId: string): FamilyTreeData {
  const people = tree.people.filter((p) => p.id !== personId);
  // Drop families that referenced this person as a partner; orphan kids keep familyId
  // but lose that parent link.
  const families = tree.families
    .map((f) => {
      if (f.partner1Id === personId) return { ...f, partner1Id: null };
      if (f.partner2Id === personId) return { ...f, partner2Id: null };
      return f;
    })
    .filter((f) => f.partner1Id || f.partner2Id);

  let defaultFocusId = tree.defaultFocusId;
  if (defaultFocusId === personId) {
    defaultFocusId = people[0]?.id ?? null;
  }

  return { ...tree, people, families, defaultFocusId };
}

export type AddRelativeKind =
  | "father"
  | "mother"
  | "spouse"
  | "son"
  | "daughter";

export function addRelative(
  tree: FamilyTreeData,
  personId: string,
  kind: AddRelativeKind
): { tree: FamilyTreeData; newPersonId: string } {
  const person = tree.people.find((p) => p.id === personId);
  if (!person) throw new Error("Person not found");

  if (kind === "father" || kind === "mother") {
    const gender = kind === "father" ? "male" : "female";
    const parent = emptyPerson({
      gender,
      given: kind === "father" ? "Father" : "Mother",
      surname: person.surname,
    });

    let families = [...tree.families];
    let people = [...tree.people];
    let familyId = person.familyId;
    const famIdx = familyId ? families.findIndex((f) => f.id === familyId) : -1;

    if (famIdx >= 0) {
      const fam = { ...families[famIdx] };
      const slotEmpty =
        kind === "father"
          ? !fam.partner1Id || !fam.partner2Id
          : !fam.partner1Id || !fam.partner2Id;

      if (fam.partner1Id && fam.partner2Id) {
        // Both parents already set — replace the matching-gender slot when possible.
        const p1 = people.find((p) => p.id === fam.partner1Id);
        const p2 = people.find((p) => p.id === fam.partner2Id);
        if (kind === "father") {
          if (p1?.gender === "male") fam.partner1Id = parent.id;
          else if (p2?.gender === "male") fam.partner2Id = parent.id;
          else fam.partner1Id = parent.id;
        } else {
          if (p1?.gender === "female") fam.partner1Id = parent.id;
          else if (p2?.gender === "female") fam.partner2Id = parent.id;
          else fam.partner2Id = parent.id;
        }
        families[famIdx] = fam;
      } else if (slotEmpty) {
        if (!fam.partner1Id) fam.partner1Id = parent.id;
        else fam.partner2Id = parent.id;
        families[famIdx] = fam;
      }
    } else {
      familyId = newId();
      families.push({
        id: familyId,
        partner1Id: parent.id,
        partner2Id: null,
        x: 0,
        y: 0,
      });
      people = people.map((p) =>
        p.id === personId ? { ...p, familyId, siblingOrder: p.siblingOrder || 0 } : p
      );
    }

    people.push(parent);
    return {
      tree: { ...tree, people, families },
      newPersonId: parent.id,
    };
  }

  if (kind === "spouse") {
    const spouseGender =
      person.gender === "male" ? "female" : person.gender === "female" ? "male" : "unknown";
    const spouse = emptyPerson({
      gender: spouseGender,
      given: "Spouse",
      surname: "",
    });
    const familyId = newId();
    const family: FamilyTreeFamily = {
      id: familyId,
      partner1Id: person.id,
      partner2Id: spouse.id,
      x: 0,
      y: 0,
    };
    return {
      tree: {
        ...tree,
        people: [...tree.people, spouse],
        families: [...tree.families, family],
      },
      newPersonId: spouse.id,
    };
  }

  // son / daughter
  const childGender = kind === "son" ? "male" : "female";
  const child = emptyPerson({
    gender: childGender,
    given: kind === "son" ? "Son" : "Daughter",
    surname: person.surname,
  });

  // Prefer an existing union for this person; otherwise create one with a placeholder spouse.
  let families = [...tree.families];
  let people = [...tree.people];
  let familyId =
    families.find((f) => f.partner1Id === personId || f.partner2Id === personId)?.id ?? null;

  if (!familyId) {
    familyId = newId();
    families.push({
      id: familyId,
      partner1Id: person.id,
      partner2Id: null,
      x: 0,
      y: 0,
    });
  }

  const siblings = people.filter((p) => p.familyId === familyId);
  const siblingOrder =
    siblings.reduce((max, p) => Math.max(max, p.siblingOrder), -1) + 1;
  child.familyId = familyId;
  child.siblingOrder = siblingOrder;
  people.push(child);

  return {
    tree: { ...tree, people, families },
    newPersonId: child.id,
  };
}
