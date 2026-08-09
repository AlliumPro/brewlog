import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

import {
  METHOD_OPTIONS,
  useGetBeanSuggestionsQuery,
  useGetRoasterSuggestionsQuery,
} from '@/entities/brew';
import type { Brew, BrewCreateInput } from '@/shared/api';
import {
  extractionPreview,
  extractionVerdict,
  formatDose,
  formatExtraction,
  formatRatio,
  formatTemperature,
} from '@/shared/lib';
import {
  Button,
  HeroValue,
  RatingInput,
  SelectField,
  SliderField,
  TextAreaField,
  TextField,
} from '@/shared/ui';

import { brewFormSchema, emptyBrewForm, toApiInput } from '../model/schema';
import type { BrewFormValues } from '../model/schema';
import styles from './BrewForm.module.css';

interface BrewFormProps {
  initial?: Brew;
  submitLabel: string;
  busy?: boolean;
  onSubmit: (input: BrewCreateInput) => void;
}

const MS_PER_DAY = 86_400_000;

/** Said plainly, because "19.4%" means nothing without the band it sits in. */
const EXTRACTION_NOTE: Record<'under' | 'ideal' | 'over', string> = {
  under: 'Under 18% — often sour and thin. Grind finer or brew longer.',
  ideal: 'In the 18–22% band most brews taste balanced in.',
  over: 'Over 22% — often bitter and drying. Grind coarser or brew shorter.',
};

function daysSince(roastDate: string): number | null {
  if (roastDate === '') {
    return null;
  }

  const roasted = Date.parse(`${roastDate}T00:00:00Z`);

  if (Number.isNaN(roasted)) {
    return null;
  }

  return Math.floor((Date.now() - roasted) / MS_PER_DAY);
}

function toFormValues(brew: Brew): BrewFormValues {
  const minutes = Math.floor(brew.brewTimeSeconds / 60);
  const seconds = brew.brewTimeSeconds % 60;

  return {
    method: brew.method,
    methodOther: brew.methodOther ?? '',
    beanName: brew.beanName,
    roaster: brew.roaster ?? '',
    roastDate: brew.roastDate ?? '',
    grindSize: brew.grindSize,
    doseGrams: brew.doseGrams,
    waterMl: brew.waterMl,
    waterTempC: brew.waterTempC,
    brewTime: `${String(minutes)}:${String(seconds).padStart(2, '0')}`,
    notes: brew.notes ?? '',
    rating: brew.rating,
    tdsPercent: brew.tdsPercent,
  };
}

export function BrewForm({ initial, submitLabel, busy = false, onSubmit }: BrewFormProps) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BrewFormValues>({
    resolver: zodResolver(brewFormSchema),
    defaultValues: initial === undefined ? emptyBrewForm : toFormValues(initial),
    mode: 'onBlur',
  });

  const method = watch('method');
  const dose = watch('doseGrams');
  const water = watch('waterMl');
  const roastDate = watch('roastDate');
  const tds = watch('tdsPercent');

  // Recomputed as the user types: the ratio is the reason to fill this form at all.
  const ratio = dose > 0 ? water / dose : null;
  const age = daysSince(roastDate);
  const extraction = extractionPreview({
    tdsPercent: tds,
    doseGrams: dose,
    waterMl: water,
    isEspresso: method === 'espresso',
  });

  const { data: beanSuggestions = [] } = useGetBeanSuggestionsQuery(undefined);
  const { data: roasterSuggestions = [] } = useGetRoasterSuggestionsQuery(undefined);

  return (
    <form
      className={styles.form}
      noValidate
      onSubmit={(event) => {
        void handleSubmit((values) => {
          onSubmit(toApiInput(values));
        })(event);
      }}
    >
      <fieldset className={styles.group}>
        <legend className={styles.legend}>Bean</legend>

        <Controller
          control={control}
          name="method"
          render={({ field }) => (
            <SelectField
              label="Method"
              value={field.value}
              options={METHOD_OPTIONS}
              error={errors.method?.message}
              onChange={field.onChange}
            />
          )}
        />

        {method === 'other' && (
          <TextField
            label="Which method?"
            placeholder="Siphon, Turkish, …"
            error={errors.methodOther?.message}
            {...register('methodOther')}
          />
        )}

        <TextField
          label="Bean"
          list="bean-suggestions"
          placeholder="Kieni AA"
          error={errors.beanName?.message}
          {...register('beanName')}
        />
        <datalist id="bean-suggestions">
          {beanSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <TextField
          label="Roaster"
          list="roaster-suggestions"
          error={errors.roaster?.message}
          {...register('roaster')}
        />
        <datalist id="roaster-suggestions">
          {roasterSuggestions.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        <TextField
          label="Roast date"
          type="date"
          hint={age === null ? 'Optional' : `${String(age)} days ago`}
          error={errors.roastDate?.message}
          {...register('roastDate')}
        />
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Parameters</legend>

        <TextField
          label="Grind"
          placeholder="medium-fine, or a number"
          error={errors.grindSize?.message}
          {...register('grindSize')}
        />

        <div className={styles.pair}>
          <TextField
            label="Dose (g)"
            type="number"
            step="0.1"
            inputMode="decimal"
            error={errors.doseGrams?.message}
            {...register('doseGrams', { valueAsNumber: true })}
          />
          <TextField
            label="Water (ml)"
            type="number"
            step="1"
            inputMode="numeric"
            error={errors.waterMl?.message}
            {...register('waterMl', { valueAsNumber: true })}
          />
        </div>

        <div className={styles.ratio} aria-live="polite">
          <HeroValue
            label="ratio"
            value={ratio === null || Number.isNaN(ratio) ? '—' : formatRatio(ratio)}
            size="lg"
          />
          <p className={styles.ratioNote}>
            {Number.isNaN(dose) ? 'Enter a dose' : formatDose(dose)} of coffee
          </p>
        </div>

        <Controller
          control={control}
          name="waterTempC"
          render={({ field }) => (
            <SliderField
              label="Water temperature"
              value={field.value}
              min={60}
              max={100}
              format={formatTemperature}
              error={errors.waterTempC?.message}
              onChange={field.onChange}
            />
          )}
        />

        <TextField
          label="Brew time"
          placeholder="2:45"
          inputMode="numeric"
          hint="Minutes and seconds"
          error={errors.brewTime?.message}
          {...register('brewTime')}
        />

        <TextField
          label="TDS (%)"
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="1.38"
          hint="From the refractometer. Leave empty if you did not measure."
          error={errors.tdsPercent?.message}
          {...register('tdsPercent', {
            // "Not measured" is null, not zero. Both the empty input ('') and the untouched
            // default (null) arrive here, and Number(null) is 0 — which would silently record
            // a TDS of zero for everyone who never took a reading.
            setValueAs: (value: unknown) =>
              value === '' || value === null || value === undefined ? null : Number(value),
          })}
        />

        {extraction !== null && (
          <div className={styles.extraction} aria-live="polite">
            <HeroValue label="extraction" value={formatExtraction(extraction)} size="lg" />
            <p className={styles.extractionNote}>
              {EXTRACTION_NOTE[extractionVerdict(extraction)]}
            </p>
          </div>
        )}
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Result</legend>

        <TextAreaField
          label="Tasting notes"
          placeholder="Acidity, sweetness, body, finish…"
          error={errors.notes?.message}
          {...register('notes')}
        />

        <Controller
          control={control}
          name="rating"
          render={({ field }) => (
            <RatingInput
              label="Rating"
              value={field.value}
              error={errors.rating?.message}
              onChange={field.onChange}
            />
          )}
        />
      </fieldset>

      <Button type="submit" fullWidth disabled={busy}>
        {busy ? 'Saving…' : submitLabel}
      </Button>
    </form>
  );
}
