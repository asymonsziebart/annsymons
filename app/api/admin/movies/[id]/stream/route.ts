import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import {
  fetchDriveMovieStream,
  isDriveFileId,
  isMovieStreamTokenValid,
} from "@/lib/googleDriveMovies";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isDriveFileId(id)) {
    return NextResponse.json({ error: "Invalid movie id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const hasValidStreamToken = isMovieStreamTokenValid(
    id,
    url.searchParams.get("expires"),
    url.searchParams.get("token")
  );
  const ok = hasValidStreamToken || (await isAdmin());
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const driveResponse = await fetchDriveMovieStream(id, request.headers.get("range"));
    if (!driveResponse.body) {
      return NextResponse.json({ error: "Movie stream is empty" }, { status: 502 });
    }

    const headers = new Headers();
    copyHeader(driveResponse.headers, headers, "content-length");
    copyHeader(driveResponse.headers, headers, "content-range");
    copyHeader(driveResponse.headers, headers, "accept-ranges");
    headers.set("content-type", driveResponse.headers.get("content-type") ?? "video/mp4");
    headers.set("content-disposition", "inline");
    headers.set("cache-control", "private, no-store");

    return new Response(driveResponse.body, {
      status: driveResponse.status,
      statusText: driveResponse.statusText,
      headers,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Movie stream failed" },
      { status: 502 }
    );
  }
}

function copyHeader(from: Headers, to: Headers, name: string): void {
  const value = from.get(name);
  if (value) to.set(name, value);
}
