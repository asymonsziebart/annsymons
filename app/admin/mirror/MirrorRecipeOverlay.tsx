"use client";

import type { Recipe } from "@/lib/recipes";
import type { RecipePanel } from "@/lib/mirrorRecipeMatch";

type Props = {
  recipe: Recipe;
  panel: RecipePanel;
  stepIndex: number;
};

export default function MirrorRecipeOverlay({ recipe, panel, stepIndex }: Props) {
  const totalSteps = recipe.steps.length;
  const safeStepIndex =
    totalSteps === 0 ? 0 : Math.min(Math.max(stepIndex, 0), totalSteps - 1);
  const currentStep = recipe.steps[safeStepIndex];

  return (
    <div className="mirror-recipe" role="region" aria-label={`Recipe: ${recipe.title}`}>
      <header className="mirror-recipe__header">
        <p className="mirror-recipe__eyebrow">Recipe</p>
        <h1 className="mirror-recipe__title">{recipe.title}</h1>
        <div className="mirror-recipe__tabs" aria-hidden="true">
          <span
            className={`mirror-recipe__tab${
              panel === "ingredients" ? " mirror-recipe__tab--active" : ""
            }`}
          >
            Ingredients
          </span>
          <span
            className={`mirror-recipe__tab${
              panel === "steps" ? " mirror-recipe__tab--active" : ""
            }`}
          >
            Steps
          </span>
        </div>
      </header>

      <div className="mirror-recipe__panel">
        {panel === "ingredients" ? (
          <section className="mirror-recipe__section" aria-label="Ingredients">
            <h2 className="mirror-recipe__heading">Ingredients</h2>
            <ul className="mirror-recipe__list">
              {recipe.ingredients.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="mirror-recipe__section" aria-label="Steps">
            <h2 className="mirror-recipe__heading">
              {totalSteps > 0 ? `Step ${safeStepIndex + 1} of ${totalSteps}` : "Steps"}
            </h2>
            {currentStep ? (
              <p className="mirror-recipe__step-text">{currentStep}</p>
            ) : (
              <p className="mirror-recipe__step-text mirror-recipe__step-text--empty">
                No steps listed.
              </p>
            )}
          </section>
        )}
      </div>

      <p className="mirror-recipe__hint">
        Say “ingredients”, “steps”, “next”, “read this step”, “go home”, or “close recipe”
      </p>
    </div>
  );
}
