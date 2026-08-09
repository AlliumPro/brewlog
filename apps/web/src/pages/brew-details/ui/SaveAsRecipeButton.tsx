import { useState } from 'react';

import { useCreateRecipeMutation } from '@/entities/recipe';
import type { Brew } from '@/shared/api';
import { Button, TextField } from '@/shared/ui';

import styles from './SaveAsRecipeButton.module.css';

interface SaveAsRecipeButtonProps {
  brew: Brew;
}

/**
 * Turns a brew that worked into a starting point for the next one. Only the parameters are
 * copied — not the rating, the notes or the TDS, which describe that particular cup and would
 * be wrong on every later one.
 */
export function SaveAsRecipeButton({ brew }: SaveAsRecipeButtonProps) {
  const [createRecipe, { isLoading }] = useCreateRecipeMutation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${brew.beanName} — ${brew.grindSize}`);
  const [error, setError] = useState<string | undefined>(undefined);
  const [savedAs, setSavedAs] = useState<string | undefined>(undefined);

  if (savedAs !== undefined) {
    return <p className={styles.done} role="status">{`Saved as "${savedAs}".`}</p>;
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
        }}
      >
        Save as recipe
      </Button>
    );
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        setError(undefined);

        void createRecipe({
          name: name.trim(),
          method: brew.method,
          methodOther: brew.methodOther,
          beanName: brew.beanName,
          roaster: brew.roaster,
          grindSize: brew.grindSize,
          doseGrams: brew.doseGrams,
          waterMl: brew.waterMl,
          waterTempC: brew.waterTempC,
          brewTimeSeconds: brew.brewTimeSeconds,
        })
          .unwrap()
          .then(() => {
            setSavedAs(name.trim());
          })
          .catch((rejection: unknown) => {
            const status =
              typeof rejection === 'object' && rejection !== null && 'status' in rejection
                ? (rejection as { status?: number }).status
                : undefined;

            setError(
              status === 409
                ? 'A recipe with that name already exists.'
                : 'Could not save the recipe. Try again.',
            );
          });
      }}
    >
      <TextField
        label="Recipe name"
        value={name}
        error={error}
        autoFocus
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
      />

      <div className={styles.actions}>
        <Button type="submit" disabled={isLoading || name.trim() === ''}>
          {isLoading ? 'Saving…' : 'Save recipe'}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
