import { useState } from 'react';
import { useParams } from 'react-router';

import { methodLabel, useGetBrewQuery, useUpdateBrewMutation } from '@/entities/brew';
import { BrewForm } from '@/features/brew-form';
import {
  formatBrewTime,
  formatDate,
  formatDaysAfterRoast,
  formatDose,
  formatExtraction,
  formatRatio,
  formatTemperature,
} from '@/shared/lib';
import { Button, ErrorState, HeroValue, Rating, Skeleton } from '@/shared/ui';

import styles from './BrewDetailsPage.module.css';
import { DeleteBrewButton } from './DeleteBrewButton';
import { SaveAsRecipeButton } from './SaveAsRecipeButton';

export function BrewDetailsPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { data: brew, isLoading, isError, refetch } = useGetBrewQuery(id, { skip: id === '' });
  const [updateBrew, { isLoading: isSaving }] = useUpdateBrewMutation();
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return <Skeleton count={2} />;
  }

  if (isError || brew === undefined) {
    return (
      <ErrorState
        title="That brew is not here"
        hint="It may have been deleted, or the link is wrong."
        onRetry={() => void refetch()}
      />
    );
  }

  const age = formatDaysAfterRoast(brew.daysAfterRoast);

  if (editing) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Edit brew</h1>

        <BrewForm
          initial={brew}
          submitLabel="Save changes"
          busy={isSaving}
          onSubmit={(input) => {
            void updateBrew({ id: brew.id, patch: input })
              .unwrap()
              .then(() => {
                setEditing(false);
              });
          }}
        />

        <Button
          variant="ghost"
          onClick={() => {
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{brew.beanName}</h1>
          <p className={styles.meta}>
            {methodLabel(brew.method, brew.methodOther)}
            {brew.roaster !== null && ` · ${brew.roaster}`}
            {` · ${formatDate(brew.brewedAt)}`}
          </p>
          {age !== null && <p className={styles.age}>{age}</p>}
        </div>
        <Rating value={brew.rating} size="lg" />
      </header>

      <section className={styles.heroes} aria-label="Key parameters">
        <HeroValue label="ratio" value={formatRatio(brew.ratio)} size="lg" />
        <HeroValue label="time" value={formatBrewTime(brew.brewTimeSeconds)} size="lg" />
        <HeroValue label="temperature" value={formatTemperature(brew.waterTempC)} size="lg" />
        {brew.extractionPercent !== null && (
          <HeroValue
            label="extraction"
            value={formatExtraction(brew.extractionPercent)}
            size="lg"
          />
        )}
      </section>

      <dl className={styles.details}>
        <div className={styles.detail}>
          <dt className={styles.detailLabel}>Dose</dt>
          <dd className={styles.detailValue}>{formatDose(brew.doseGrams)}</dd>
        </div>
        <div className={styles.detail}>
          <dt className={styles.detailLabel}>Water</dt>
          <dd className={styles.detailValue}>{`${String(brew.waterMl)} ml`}</dd>
        </div>
        <div className={styles.detail}>
          <dt className={styles.detailLabel}>Grind</dt>
          <dd className={styles.detailValue}>{brew.grindSize}</dd>
        </div>
        <div className={styles.detail}>
          <dt className={styles.detailLabel}>Roast date</dt>
          <dd className={styles.detailValue}>
            {brew.roastDate === null ? 'not noted' : formatDate(brew.roastDate)}
          </dd>
        </div>
      </dl>

      {brew.photoUrl !== null && (
        <img
          className={styles.photo}
          src={brew.photoUrl}
          alt={`The cup of ${brew.beanName}`}
          loading="lazy"
          width={1600}
          height={1200}
        />
      )}

      {brew.notes !== null && (
        <section className={styles.notes}>
          <h2 className={styles.notesTitle}>Tasting notes</h2>
          <p className={styles.notesBody}>{brew.notes}</p>
        </section>
      )}

      <div className={styles.actions}>
        <Button
          variant="secondary"
          onClick={() => {
            setEditing(true);
          }}
        >
          Edit
        </Button>
        <SaveAsRecipeButton brew={brew} />
        <DeleteBrewButton id={brew.id} beanName={brew.beanName} />
      </div>
    </article>
  );
}
