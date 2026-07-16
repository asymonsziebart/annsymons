import TasksLoginForm from "./TasksLoginForm";

export const metadata = {
  title: "Sign in | Tasks",
  robots: "noindex, nofollow",
};

export default function TasksLoginPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="neo w-full max-w-sm p-8">
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
