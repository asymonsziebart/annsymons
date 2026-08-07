import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth";
import {
  deleteSiteUser,
  listSiteUsers,
  SITE_USER_STATUSES,
  updateSiteUser,
  type SiteUserStatus,
} from "@/lib/data/siteUsers";
import { normalizeAllowedPages } from "@/lib/admin/pageAccess";

export async function GET() {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const users = await listSiteUsers();
  return NextResponse.json({ users });
}

export async function PATCH(request: Request) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const id = Number(body?.id);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }

    const statusRaw =
      typeof body?.status === "string" ? body.status.trim().toLowerCase() : undefined;
    const status =
      statusRaw &&
      (SITE_USER_STATUSES as readonly string[]).includes(statusRaw)
        ? (statusRaw as SiteUserStatus)
        : undefined;

    const allowedPages =
      body?.allowedPages !== undefined
        ? normalizeAllowedPages(body.allowedPages)
        : undefined;

    const adminNote =
      body?.adminNote !== undefined
        ? body.adminNote == null
          ? null
          : String(body.adminNote)
        : undefined;

    if (status === "approved" && allowedPages !== undefined && allowedPages.length === 0) {
      return NextResponse.json(
        { error: "Approved users need at least one page." },
        { status: 400 }
      );
    }

    const user = await updateSiteUser(id, { status, allowedPages, adminNote });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isOwner())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const id = Number(body?.id);
    if (!Number.isFinite(id) || id < 1) {
      return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
    }
    const ok = await deleteSiteUser(id);
    if (!ok) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
