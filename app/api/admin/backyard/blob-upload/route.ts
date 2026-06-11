import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { BACKYARD_MAX_UPLOAD_BYTES } from "@/lib/admin/uploadLimits";

/**
 * Token exchange for @vercel/blob/client uploads. File bytes go browser → Blob,
 * avoiding Vercel's ~4.5 MB serverless request body limit.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ok = await isAdmin();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Blob is not configured" }, { status: 503 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("backyard/")) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: [
            "image/png",
            "image/jpeg",
            "image/jpg",
            "image/webp",
            "image/gif",
          ],
          maximumSizeInBytes: BACKYARD_MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (e) {
    console.error("backyard blob-upload:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload token failed" },
      { status: 400 }
    );
  }
}
