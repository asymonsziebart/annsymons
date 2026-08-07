import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getFamilyTree, mergePreservedPhotos, saveFamilyTree } from "@/lib/data/familyTree";
import { parseFamilyTreeFile } from "@/lib/familyTree/parseFtz";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;

export async function GET() {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const tree = await getFamilyTree();
    return NextResponse.json({ tree });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load family tree" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a FamilyTree.ftz file to upload." }, { status: 400 });
    }
    if (!file.size || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File is too large (max 25 MB)." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const parsed = await parseFamilyTreeFile(bytes, file.name || "FamilyTree.ftz");
    let previous = null;
    try {
      previous = await getFamilyTree();
    } catch {
      previous = null;
    }
    const tree = await saveFamilyTree(mergePreservedPhotos(parsed, previous));
    return NextResponse.json({
      ok: true,
      tree,
      imported: { people: tree.people.length, families: tree.families.length },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import family tree" },
      { status: 500 }
    );
  }
}
