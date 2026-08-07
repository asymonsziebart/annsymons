import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import PaintSplashes from "@/components/PaintSplashes";
import MobileAdminSettings from "@/components/MobileAdminSettings";
import AdminSideNav from "@/components/AdminSideNav";
import { getVisibleAdminHrefs, isAdmin, isOwner } from "@/lib/auth";

export default async function SiteChromeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const admin = await isAdmin();
  const owner = admin ? await isOwner() : false;
  const allowedHrefs = admin ? await getVisibleAdminHrefs() : [];

  return (
    <>
      <PaintSplashes />
      <Header />
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 overflow-hidden">
        {admin ? (
          <AdminSideNav
            allowedHrefs={allowedHrefs}
            showManageUsers={owner}
          />
        ) : null}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-auto overscroll-y-contain pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
            {children}
            <SiteFooter />
          </div>
        </div>
      </div>
      <MobileAdminSettings isAdmin={admin} />
    </>
  );
}
