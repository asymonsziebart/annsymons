export type DriveMovieFile = {
  id: string;
  name: string;
};

export const DRIVE_MOVIES_FOLDER_ID = "1RBAj7byBO2YswerQRK105ba74ZvG6Qm9";
export const DRIVE_MOVIES_FOLDER_URL = `https://drive.google.com/drive/folders/${DRIVE_MOVIES_FOLDER_ID}`;

const DRIVE_FILE_ID_RE = /^[A-Za-z0-9_-]{20,}$/;
const USER_AGENT =
  "Mozilla/5.0 (compatible; AnnSymonsMoviePlayer/1.0; +https://www.annsymons.com)";

export function isDriveFileId(value: string): boolean {
  return DRIVE_FILE_ID_RE.test(value);
}

export async function getDriveMovies(): Promise<DriveMovieFile[]> {
  const response = await fetch(DRIVE_MOVIES_FOLDER_URL, {
    headers: { "user-agent": USER_AGENT },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Google Drive folder request failed with ${response.status}`);
  }

  return parseDriveFolderHtml(await response.text());
}

export function parseDriveFolderHtml(html: string): DriveMovieFile[] {
  const movies = new Map<string, DriveMovieFile>();
  const fileRe =
    /data-id="([A-Za-z0-9_-]{20,})"[^>]*data-tooltip="([^"]+?\.mp4)(?:\s+Video)?"/gi;

  for (const match of html.matchAll(fileRe)) {
    const [, id, encodedName] = match;
    if (!id || !encodedName || movies.has(id)) continue;
    movies.set(id, {
      id,
      name: decodeHtmlEntities(encodedName).trim(),
    });
  }

  return [...movies.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export async function fetchDriveMovieStream(
  fileId: string,
  rangeHeader: string | null
): Promise<Response> {
  if (!isDriveFileId(fileId)) {
    throw new Error("Invalid Google Drive file id");
  }

  const initialUrl = new URL("https://drive.usercontent.google.com/download");
  initialUrl.searchParams.set("id", fileId);
  initialUrl.searchParams.set("export", "download");

  const firstResponse = await fetchDriveDownload(initialUrl, rangeHeader);
  if (!isHtmlResponse(firstResponse)) return firstResponse;

  const confirmationHtml = await firstResponse.text();
  const confirmedUrl = getConfirmedDownloadUrl(confirmationHtml);
  if (!confirmedUrl) {
    throw new Error("Google Drive did not return a playable movie stream");
  }

  const confirmedResponse = await fetchDriveDownload(confirmedUrl, rangeHeader);
  if (isHtmlResponse(confirmedResponse)) {
    throw new Error("Google Drive returned another confirmation page");
  }

  return confirmedResponse;
}

function fetchDriveDownload(url: URL, rangeHeader: string | null): Promise<Response> {
  const headers = new Headers({
    accept: "video/mp4,video/*,*/*",
    "user-agent": USER_AGENT,
  });
  if (rangeHeader) headers.set("range", rangeHeader);
  return fetch(url, { headers, cache: "no-store" });
}

function isHtmlResponse(response: Response): boolean {
  return response.headers.get("content-type")?.includes("text/html") ?? false;
}

function getConfirmedDownloadUrl(html: string): URL | null {
  const fields = new URLSearchParams();
  const inputRe = /<input[^>]+type="hidden"[^>]+>/gi;

  for (const input of html.matchAll(inputRe)) {
    const tag = input[0];
    const name = getInputAttribute(tag, "name");
    if (!name) continue;
    fields.set(name, getInputAttribute(tag, "value") ?? "");
  }

  if (!fields.has("id") || !fields.has("confirm")) return null;

  const url = new URL("https://drive.usercontent.google.com/download");
  fields.forEach((value, key) => url.searchParams.set(key, value));
  return url;
}

function getInputAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match ? decodeHtmlEntities(match[1] ?? "") : null;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
