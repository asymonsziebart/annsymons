import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

/**
 * Token exchange for @vercel/blob/client uploads. The file bytes never hit this
 * request body (avoids Vercel's ~4.5 MB serverless limit on Server Actions).
 */
export async function POST(request: Request): Promise<NextResponse> {
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
      onBeforeGenerateToken: async (pathname, _clientPayload, _multipart) => {
        if (!pathname.startsWith("statephotos/")) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"],
          maximumSizeInBytes: 20 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (e) {
    console.error("statephotos blob-upload:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload token failed" },
      { status: 400 }
    );
  }
}
