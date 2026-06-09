import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import {
  ADMIN_UPLOAD_FOLDERS,
  storeAdminImageFile,
  type AdminUploadFolder,
} from "@/lib/admin/fileStorage";

export async function POST(request: Request) {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string | null;

    if (!file || !folder || !ADMIN_UPLOAD_FOLDERS.includes(folder as AdminUploadFolder)) {
      return NextResponse.json(
        {
          error:
            "Missing file or invalid folder. Use folder: recipes, blog, gallery, garage, truck-fund, or backyard.",
        },
        { status: 400 }
      );
    }

    const publicPath = await storeAdminImageFile(file, folder as AdminUploadFolder);
    return NextResponse.json({ path: publicPath });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
