import {
  backfillTaskPrioritiesFromSection,
  getTasks,
  syncTaskSectionsFromPriority,
} from "@/lib/data/tasks";

import MirrorApp from "./MirrorApp";

export const dynamic = "force-dynamic";

export default async function MirrorPage() {
  await backfillTaskPrioritiesFromSection();
  await syncTaskSectionsFromPriority();
  const tasks = await getTasks();
  return <MirrorApp initialTasks={tasks} />;
}
