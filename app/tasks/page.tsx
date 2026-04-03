import { getTasks } from "@/lib/data/tasks";
import TasksApp from "./TasksApp";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tasks",
  robots: "noindex, nofollow",
};

export default async function TasksPage() {
  const initialTasks = await getTasks();
  return <TasksApp initialTasks={initialTasks} />;
}
