import RequestAccessForm from "./RequestAccessForm";

export const metadata = {
  title: "Request Access | Ann Symons",
  robots: "noindex, nofollow",
};

export default function RequestAccessPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12">
      <div className="neo w-full max-w-md p-8">
        <h1 className="font-heading text-2xl font-semibold text-[var(--color-ink)]">
          Request a login
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
          Create an account request for Ann’s private site. She’ll approve it and
          choose which pages you can see.
        </p>
        <RequestAccessForm />
      </div>
    </div>
  );
}
