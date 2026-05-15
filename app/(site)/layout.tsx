import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import PaintSplashes from "@/components/PaintSplashes";
import MobileAdminSettings from "@/components/MobileAdminSettings";

export default function SiteChromeLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <PaintSplashes />
      <Header />
      <div className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-y-auto overscroll-y-contain pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          {children}
          <SiteFooter />
        </div>
      </div>
      <MobileAdminSettings />
    </>
  );
}
