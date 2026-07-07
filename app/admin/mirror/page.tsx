import { getAllRecipes } from "@/lib/data/recipes";
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
  const [tasks, weather, recipes] = await Promise.all([
    getTasks(),
    fetchMirrorWeather(),
    getAllRecipes(),
  ]);
  return <MirrorApp initialTasks={tasks} initialWeather={weather} initialRecipes={recipes} />;
}
