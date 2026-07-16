import { redirect } from "next/navigation";
import AdminLoginForm from "./AdminLoginForm";

export const metadata = {
  title: "Admin Login | Ann Symons",
  robots: "noindex, nofollow",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const nextPath =
    typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/admin";
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="neo w-full max-w-sm p-8">
        <h1 className="font-heading text-xl font-semibold text-[var(--color-ink)]">
          Admin login
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Enter the admin password to continue.
        </p>
        <AdminLoginForm nextPath={nextPath} />
      </div>
    </div>
  );
}
