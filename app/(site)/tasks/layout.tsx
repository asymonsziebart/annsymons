/**
 * Keeps the tasks UI in a flex child with basis 0 so the inner task list can
 * scroll on mobile (iOS Safari) instead of collapsing to zero height.
 */
export default function TasksLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col [flex-basis:0]">
      {children}
    </div>
  );
}
