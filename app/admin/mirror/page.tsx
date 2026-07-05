import {
  backfillTaskPrioritiesFromSection,
  getTasks,
  syncTaskSectionsFromPriority,
} from "@/lib/data/tasks";
import { fetchMirrorWeather } from "@/lib/mirrorWeather";

import MirrorApp from "./MirrorApp";

export const dynamic = "force-dynamic";

export default async function MirrorPage() {
  await backfillTaskPrioritiesFromSection();
  await syncTaskSectionsFromPriority();
  const [tasks, weather] = await Promise.all([getTasks(), fetchMirrorWeather()]);
  return <MirrorApp initialTasks={tasks} initialWeather={weather} />;
}
