import { redirect } from "next/navigation";
import AdminLoginForm from "./AdminLoginForm";

export const metadata = {
  title: "Admin Login | Ann Symons",
  robots: "noindex, nofollow",
};

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-8 shadow-lg ring-1 ring-[var(--color-border)]">
        <h1 className="font-heading text-xl font-semibold text-[var(--color-ink)]">
          Admin login
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Enter the admin password to continue.
        </p>
        <AdminLoginForm />
      </div>
    </div>
  );
}
