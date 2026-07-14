import { getAllRecipes } from "@/lib/data/recipes";
import { getSections } from "@/lib/data/taskSections";
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
  const [tasks, sections, weather, recipes] = await Promise.all([
    getTasks(),
    getSections(),
    fetchMirrorWeather(),
    getAllRecipes(),
  ]);
  return (
    <MirrorApp
      initialTasks={tasks}
      initialSections={sections}
      initialWeather={weather}
      initialRecipes={recipes}
    />
  );
}
