import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { storeAdminImageFile } from "@/lib/admin/fileStorage";
import { getFamilyTree, saveFamilyTree } from "@/lib/data/familyTree";
import {
  addRelative,
  linkAsSpouse,
  removePerson,
  unlinkPerson,
  updatePerson,
  type AddRelativeKind,
  type PersonEditInput,
} from "@/lib/familyTree/mutations";
import type { FamilyTreeDate, FamilyTreePerson } from "@/lib/familyTree/types";

export const runtime = "nodejs";

function parseDate(value: unknown): FamilyTreeDate | null | undefined {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null) return undefined;
  const obj = value as Record<string, unknown>;
  const year = Number(obj.year);
  if (!Number.isFinite(year) || year <= 0) return null;
  const month = Number(obj.month);
  const day = Number(obj.day);
  return {
    year,
    month: Number.isFinite(month) && month > 0 ? month : null,
    day: Number.isFinite(day) && day > 0 ? day : null,
    known: true,
  };
}

function parseGender(value: unknown): FamilyTreePerson["gender"] | undefined {
  if (value === "male" || value === "female" || value === "unknown") return value;
  return undefined;
}

export async function PATCH(request: Request) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const contentType = request.headers.get("content-type") || "";

    // Photo upload: multipart form
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const personId = String(form.get("personId") || "");
      const file = form.get("photo");
      if (!personId) {
        return NextResponse.json({ error: "personId is required" }, { status: 400 });
      }
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "Choose a photo to upload." }, { status: 400 });
      }
      const photoUrl = await storeAdminImageFile(file, "family-tree");
      const current = await getFamilyTree();
      const next = updatePerson(current, personId, { photoUrl });
      const tree = await saveFamilyTree(next);
      return NextResponse.json({ ok: true, tree, photoUrl });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const personId = typeof body.personId === "string" ? body.personId : "";
    const action = typeof body.action === "string" ? body.action : "update";
    if (!personId) {
      return NextResponse.json({ error: "personId is required" }, { status: 400 });
    }

    const current = await getFamilyTree();

    if (action === "delete") {
      const next = removePerson(current, personId);
      const tree = await saveFamilyTree(next);
      return NextResponse.json({ ok: true, tree });
    }

    if (action === "add-relative") {
      const kind = body.kind as AddRelativeKind;
      if (
        !["father", "mother", "spouse", "son", "daughter", "child", "parents"].includes(kind)
      ) {
        return NextResponse.json({ error: "Invalid relative kind" }, { status: 400 });
      }
      const { tree: next, newPersonId } = addRelative(current, personId, kind);
      const tree = await saveFamilyTree(next);
      return NextResponse.json({ ok: true, tree, newPersonId });
    }

    if (action === "unlink") {
      const next = unlinkPerson(current, personId);
      const tree = await saveFamilyTree(next);
      return NextResponse.json({ ok: true, tree });
    }

    if (action === "link-spouse") {
      const otherId = typeof body.otherId === "string" ? body.otherId : "";
      if (!otherId) {
        return NextResponse.json({ error: "otherId is required" }, { status: 400 });
      }
      const next = linkAsSpouse(current, personId, otherId);
      const tree = await saveFamilyTree(next);
      return NextResponse.json({ ok: true, tree });
    }

    if (action === "clear-photo") {
      const next = updatePerson(current, personId, { photoUrl: null });
      const tree = await saveFamilyTree(next);
      return NextResponse.json({ ok: true, tree });
    }

    const patch: PersonEditInput = {
      given: typeof body.given === "string" ? body.given : undefined,
      surname: typeof body.surname === "string" ? body.surname : undefined,
      middle: typeof body.middle === "string" || body.middle === null ? (body.middle as string | null) : undefined,
      gender: parseGender(body.gender),
      birth: parseDate(body.birth),
      death: parseDate(body.death),
      photoUrl: typeof body.photoUrl === "string" || body.photoUrl === null ? (body.photoUrl as string | null) : undefined,
    };

    const next = updatePerson(current, personId, patch);
    const tree = await saveFamilyTree(next);
    return NextResponse.json({ ok: true, tree });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update person" },
      { status: 500 }
    );
  }
}
