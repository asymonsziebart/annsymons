import type { Recipe } from "@/lib/recipes";

function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ");
}

const RECIPE_OPEN_PATTERNS: RegExp[] = [
  /\bshow (me )?(the )?recipe (for|of)\b/,
  /\bpull up (the )?recipe (for|of)\b/,
  /\bopen (the )?recipe (for|of)\b/,
  /\bdisplay (the )?recipe (for|of)\b/,
  /\bhow do i make\b/,
  /\bhow to make\b/,
  /\brecipe for\b/,
  /\bmake (the )?recipe (for|of)\b/,
];

const RECIPE_CLOSE_PATTERNS: RegExp[] = [
  /\bclose (the )?recipe\b/,
  /\bhide (the )?recipe\b/,
  /\bdismiss (the )?recipe\b/,
  /\bgo back\b/,
  /\bclose that\b/,
];

export type RecipePanel = "ingredients" | "steps";

export type RecipePanelCommand =
  | { type: "panel"; panel: RecipePanel }
  | { type: "step"; direction: "next" | "prev" };

const INGREDIENTS_PATTERNS: RegExp[] = [
  /\bshow (the )?ingredients\b/,
  /\bwhat (are |do i need )?(the )?ingredients\b/,
  /\bingredient list\b/,
  /^ingredients$/,
];

const STEPS_PATTERNS: RegExp[] = [
  /\bshow (the )?steps\b/,
  /\bshow (the )?(instructions|directions)\b/,
  /\bwhat (are |are )?(the )?steps\b/,
  /^(steps|instructions|directions)$/,
];

const NEXT_STEP_PATTERNS: RegExp[] = [/\bnext step\b/];
const NEXT_STEP_LOOSE_PATTERNS: RegExp[] = [/^next$/];
const PREV_STEP_PATTERNS: RegExp[] = [/\bprevious step\b/, /\bprevious\b/];
const PREV_STEP_LOOSE_PATTERNS: RegExp[] = [/^back$/, /^prev$/];

export function stripMirrorWakePrefix(transcript: string): string {
  let t = normalize(transcript);
  if (t.startsWith("hey mirror ")) return t.slice("hey mirror ".length).trim();
  if (t === "hey mirror") return "";
  if (t.includes("mirror mirror")) return t;
  if (t.startsWith("mirror ")) return t.slice("mirror ".length).trim();
  if (t === "mirror") return "";
  return t;
}

export function parseRecipePanelCommand(
  transcript: string,
  currentPanel?: RecipePanel,
): RecipePanelCommand | null {
  const variants = [normalize(transcript), normalize(stripMirrorWakePrefix(transcript))].filter(
    (v, i, arr) => v.length > 0 && arr.indexOf(v) === i,
  );

  for (const t of variants) {
    if (INGREDIENTS_PATTERNS.some((p) => p.test(t))) {
      return { type: "panel", panel: "ingredients" };
    }
    if (STEPS_PATTERNS.some((p) => p.test(t))) {
      return { type: "panel", panel: "steps" };
    }
  }

  if (currentPanel !== "steps") return null;

  for (const t of variants) {
    if (
      NEXT_STEP_PATTERNS.some((p) => p.test(t)) ||
      NEXT_STEP_LOOSE_PATTERNS.some((p) => p.test(t))
    ) {
      return { type: "step", direction: "next" };
    }
    if (
      PREV_STEP_PATTERNS.some((p) => p.test(t)) ||
      PREV_STEP_LOOSE_PATTERNS.some((p) => p.test(t))
    ) {
      return { type: "step", direction: "prev" };
    }
  }

  return null;
}

export function jarvisLineForRecipeCommand(
  command: RecipePanelCommand,
  recipe: Recipe,
  stepIndex: number,
): string {
  if (command.type === "panel") {
    return command.panel === "ingredients" ? "Showing ingredients." : "Showing steps.";
  }

  const total = recipe.steps.length;
  const stepNum = stepIndex + 1;
  if (total === 0) return "There are no steps for this recipe.";
  return `Step ${stepNum} of ${total}.`;
}

export function isRecipeCloseCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return RECIPE_CLOSE_PATTERNS.some((p) => p.test(t));
}

export function isRecipeOpenCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return RECIPE_OPEN_PATTERNS.some((p) => p.test(t));
}

export function extractRecipeQuery(transcript: string): string {
  let t = normalize(transcript);
  for (const pattern of RECIPE_OPEN_PATTERNS) {
    t = t.replace(pattern, " ");
  }
  return t.replace(/\b(please|the|a|an|my)\b/g, " ").replace(/\s+/g, " ").trim();
}

function wordOverlapScore(query: string, title: string): number {
  if (!query || !title) return 0;
  if (title.includes(query)) return 1;
  if (query.includes(title)) return 0.95;

  const qWords = query.split(" ").filter((w) => w.length > 2);
  if (qWords.length === 0) return 0;

  let hits = 0;
  for (const word of qWords) {
    if (title.includes(word)) {
      hits += 1;
      continue;
    }
    const titleWords = title.split(" ");
    if (titleWords.some((tw) => tw.startsWith(word) || word.startsWith(tw))) {
      hits += 0.85;
    }
  }
  return hits / qWords.length;
}

/** Match a spoken recipe name against your site's recipe catalog. */
export function matchRecipeFromTranscript(
  transcript: string,
  recipes: Recipe[],
): Recipe | null {
  const t = normalize(transcript);
  let query = "";

  if (isRecipeOpenCommand(transcript)) {
    query = extractRecipeQuery(transcript);
  } else if (/\bpull up\b/.test(t)) {
    query = t
      .replace(/\bpull up\b/, " ")
      .replace(/\b(please|the|a|an|my)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } else {
    return null;
  }

  if (!query) return null;

  let best: { recipe: Recipe; score: number } | null = null;
  for (const recipe of recipes) {
    const score = wordOverlapScore(query, normalize(recipe.title));
    if (score > 0 && (!best || score > best.score)) {
      best = { recipe, score };
    }
  }

  return best && best.score >= (isRecipeOpenCommand(transcript) ? 0.45 : 0.55) ? best.recipe : null;
}

export function listRecipeTitles(recipes: Recipe[], limit = 4): string {
  return recipes
    .slice(0, limit)
    .map((r) => r.title)
    .join(", ");
}
