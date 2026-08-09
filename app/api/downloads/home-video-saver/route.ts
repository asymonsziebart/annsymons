import JSZip from "jszip";

import {
  HOME_VIDEO_SAVER_FILES,
  HOME_VIDEO_SAVER_VERSION,
} from "@/lib/homeVideoSaverBundle";

export const dynamic = "force-static";

export async function GET() {
  const zip = new JSZip();
  const folder = zip.folder("Home Video Saver");

  if (!folder) {
    return new Response("Could not prepare download.", { status: 500 });
  }

  for (const [name, contents] of Object.entries(HOME_VIDEO_SAVER_FILES)) {
    folder.file(name, contents, {
      unixPermissions: name.endsWith(".command") ? "755" : "644",
    });
  }

  const archive = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
    platform: "UNIX",
  });

  return new Response(archive, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Content-Disposition": `attachment; filename="home-video-saver-${HOME_VIDEO_SAVER_VERSION}.zip"`,
      "Content-Length": archive.byteLength.toString(),
      "Content-Type": "application/zip",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
