import { METHOD_LABELS } from '@/entities/brew';
import { useDeleteRecipeMutation, useGetRecipesQuery } from '@/entities/recipe';
import { formatBrewTime, formatDose, formatTemperature } from '@/shared/lib';
import { Button, ConfirmDialog, EmptyState, ErrorState, Skeleton } from '@/shared/ui';

import styles from './RecipesPage.module.css';

export function RecipesPage() {
  const { data, isLoading, isError, refetch } = useGetRecipesQuery();
  const [deleteRecipe, { isLoading: isDeleting }] = useDeleteRecipeMutation();

  if (isLoading) {
    return <Skeleton count={3} />;
  }

  if (isError || data === undefined) {
    return <ErrorState onRetry={() => void refetch()} />;
  }

  if (data.items.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Recipes</h1>
        <EmptyState
          title="No saved recipes yet."
          hint="Open a brew you were happy with and save it as a recipe — the next one starts from those numbers instead of a blank form."
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Recipes</h1>

      <ul className={styles.list}>
        {data.items.map((recipe) => (
          <li key={recipe.id} className={styles.card}>
            <div className={styles.head}>
              <h2 className={styles.name}>{recipe.name}</h2>
              <p className={styles.meta}>
                {METHOD_LABELS[recipe.method]}
                {recipe.beanName !== null && ` · ${recipe.beanName}`}
              </p>
            </div>

            <dl className={styles.numbers}>
              {recipe.doseGrams !== null && (
                <div>
                  <dt className={styles.numberLabel}>dose</dt>
                  <dd className={styles.numberValue}>{formatDose(recipe.doseGrams)}</dd>
                </div>
              )}
              {recipe.waterMl !== null && (
                <div>
                  <dt className={styles.numberLabel}>water</dt>
                  <dd className={styles.numberValue}>{`${String(recipe.waterMl)} ml`}</dd>
                </div>
              )}
              {recipe.waterTempC !== null && (
                <div>
                  <dt className={styles.numberLabel}>temperature</dt>
                  <dd className={styles.numberValue}>{formatTemperature(recipe.waterTempC)}</dd>
                </div>
              )}
              {recipe.brewTimeSeconds !== null && (
                <div>
                  <dt className={styles.numberLabel}>time</dt>
                  <dd className={styles.numberValue}>{formatBrewTime(recipe.brewTimeSeconds)}</dd>
                </div>
              )}
            </dl>

            <div className={styles.actions}>
              <ConfirmDialog
                trigger={<Button variant="ghost">Delete</Button>}
                title="Delete this recipe?"
                description={`"${recipe.name}" will be removed. The brews it came from are not touched.`}
                confirmLabel="Delete it"
                busy={isDeleting}
                onConfirm={() => {
                  void deleteRecipe(recipe.id);
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
