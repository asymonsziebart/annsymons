import JSZip from "jszip";

import {
  HOME_VIDEO_SAVER_FILES,
  HOME_VIDEO_SAVER_VERSION,
} from "@/lib/homeVideoSaverBundle";
import { canUseAdminApi } from "@/lib/auth";

export async function GET() {
  if (!(await canUseAdminApi("/admin/home-video-saver"))) {
    return new Response("Forbidden", { status: 403 });
  }

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
  const body = new ArrayBuffer(archive.byteLength);
  new Uint8Array(body).set(archive);

  return new Response(body, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="home-video-saver-${HOME_VIDEO_SAVER_VERSION}.zip"`,
      "Content-Length": archive.byteLength.toString(),
      "Content-Type": "application/zip",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
