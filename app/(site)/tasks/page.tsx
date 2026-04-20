import { getSections } from "@/lib/data/taskSections";
import { backfillTaskPrioritiesFromSection, getTasks } from "@/lib/data/tasks";
import TasksApp from "./TasksApp";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tasks",
  robots: "noindex, nofollow",
};

export default async function TasksPage() {
  await backfillTaskPrioritiesFromSection();
  const [initialTasks, initialSections] = await Promise.all([getTasks(), getSections()]);
  return <TasksApp initialTasks={initialTasks} initialSections={initialSections} />;
}
