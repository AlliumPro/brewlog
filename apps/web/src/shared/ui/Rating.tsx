import { RadioGroup } from 'radix-ui';

import { Field } from './Field';
import styles from './Rating.module.css';

const SCALE = [1, 2, 3, 4, 5] as const;

interface RatingProps {
  value: number;
  /** Small enough for a card, large for the details hero. */
  size?: 'sm' | 'lg';
}

/**
 * Filled discs rather than star emoji: emoji render differently on every platform and read
 * as decoration. The numeric value is always exposed as text to assistive technology, so the
 * rating is never conveyed by colour alone.
 */
export function Rating({ value, size = 'sm' }: RatingProps) {
  return (
    <div className={[styles.display, styles[size]].join(' ')}>
      <span className={styles.visual} aria-hidden="true">
        {SCALE.map((step) => (
          <span key={step} className={step <= value ? styles.dotFilled : styles.dotEmpty} />
        ))}
      </span>
      <span className={styles.srOnly}>{`Rated ${String(value)} out of 5`}</span>
    </div>
  );
}

interface RatingInputProps {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  error?: string | undefined;
}

/**
 * A radio group, so arrow keys move between values and the current value is announced —
 * behaviour a row of clickable divs would not have.
 */
export function RatingInput({ label, value, onChange, error }: RatingInputProps) {
  return (
    <Field label={label} error={error}>
      {({ describedBy }) => (
        <RadioGroup.Root
          className={styles.input}
          value={value === null ? '' : String(value)}
          aria-label={label}
          aria-describedby={describedBy}
          onValueChange={(next) => {
            onChange(Number(next));
          }}
        >
          {SCALE.map((step) => (
            <RadioGroup.Item
              key={step}
              value={String(step)}
              className={styles.option}
              aria-label={`${String(step)} out of 5`}
            >
              <span className={styles.optionNumber}>{step}</span>
            </RadioGroup.Item>
          ))}
        </RadioGroup.Root>
      )}
    </Field>
  );
}
