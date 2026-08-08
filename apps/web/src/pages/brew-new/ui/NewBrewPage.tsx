import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useCreateBrewMutation } from '@/entities/brew';
import { BrewForm } from '@/features/brew-form';
import { ErrorState } from '@/shared/ui';

import styles from './NewBrewPage.module.css';

export function NewBrewPage() {
  const [createBrew, { isLoading }] = useCreateBrewMutation();
  const [failed, setFailed] = useState(false);
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Log a brew</h1>

      {failed && (
        <ErrorState
          title="The brew was not saved"
          hint="The server rejected it or the connection dropped. Your input is still here — try submitting again."
        />
      )}

      <BrewForm
        submitLabel="Save this brew"
        busy={isLoading}
        onSubmit={(input) => {
          setFailed(false);

          void createBrew(input)
            .unwrap()
            .then((brew) => {
              void navigate(`/brews/${brew.id}`, { replace: true });
            })
            .catch(() => {
              setFailed(true);
            });
        }}
      />
    </div>
  );
}
