export type FamilyTreeDate = {
  year: number;
  month: number | null;
  day: number | null;
  known: boolean;
};

export type FamilyTreePerson = {
  id: string;
  familyId: string | null;
  siblingOrder: number;
  x: number;
  y: number;
  surname: string;
  given: string;
  middle: string | null;
  birth: FamilyTreeDate | null;
  death: FamilyTreeDate | null;
  gender: "male" | "female" | "unknown";
  /** Optional custom portrait URL (uploaded later). */
  photoUrl?: string | null;
};

/** How deep to expand descendants from the focused person. */
export type FamilyTreeViewMode = "child" | "child_spouse" | "grandchild" | "unlimited";

export type FamilyTreeFamily = {
  id: string;
  partner1Id: string | null;
  partner2Id: string | null;
  x: number;
  y: number;
};

export type FamilyTreeData = {
  name: string;
  sourceFilename: string | null;
  defaultFocusId: string | null;
  people: FamilyTreePerson[];
  families: FamilyTreeFamily[];
  updatedAt?: string | null;
};
