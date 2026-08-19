import { NextResponse } from "next/server";
import { canUseAdminApi, isSharedAdmin } from "@/lib/auth";
import {
  ADMIN_UPLOAD_FOLDERS,
  storeAdminImageFile,
  type AdminUploadFolder,
} from "@/lib/admin/fileStorage";

const FOLDER_PAGE: Partial<Record<AdminUploadFolder, string>> = {
  "pokemon-cards": "/admin/pokemon-cards",
  backyard: "/admin/backyard",
  garage: "/admin/garage",
  recipes: "/admin/recipes",
  blog: "/admin",
  gallery: "/admin/gallery",
  "truck-fund": "/admin/truck-fund",
  instagram: "/admin/instagram",
  "family-tree": "/admin/family-tree",
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string | null;

    if (!file || !folder || !ADMIN_UPLOAD_FOLDERS.includes(folder as AdminUploadFolder)) {
      return NextResponse.json(
        {
          error:
            "Missing file or invalid folder. Use folder: recipes, blog, gallery, garage, truck-fund, backyard, instagram, family-tree, or pokemon-cards.",
        },
        { status: 400 }
      );
    }

    const uploadFolder = folder as AdminUploadFolder;
    const pageHref = FOLDER_PAGE[uploadFolder];
    const ok =
      (await isSharedAdmin()) ||
      (pageHref ? await canUseAdminApi(pageHref) : false);
    if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const publicPath = await storeAdminImageFile(file, uploadFolder);
    return NextResponse.json({ path: publicPath });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}
