import TasksLoginForm from "./TasksLoginForm";

export const metadata = {
  title: "Sign in | Tasks",
  robots: "noindex, nofollow",
};

export default function TasksLoginPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-[var(--color-surface)] p-8 shadow-lg ring-1 ring-[var(--color-border)]">
        <h1 className="font-heading text-xl font-semibold text-[var(--color-ink)]">
          Tasks
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Sign in to continue.
        </p>
        <TasksLoginForm />
      </div>
    </div>
  );
}
