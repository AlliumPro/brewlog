import { Slider as RadixSlider } from 'radix-ui';

import { Field } from './Field';
import styles from './SliderField.module.css';

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  format: (value: number) => string;
  hint?: string;
  error?: string | undefined;
}

/**
 * A slider paired with the value shown large, and a number input beside it — the slider is
 * for adjusting on a phone, the input for typing an exact figure on a laptop.
 */
export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  hint,
  error,
}: SliderFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ inputId, describedBy }) => (
        <div className={styles.wrapper}>
          <output className={styles.value} htmlFor={inputId}>
            {format(value)}
          </output>

          <RadixSlider.Root
            id={inputId}
            className={styles.root}
            value={[value]}
            min={min}
            max={max}
            step={step}
            aria-label={label}
            aria-describedby={describedBy}
            onValueChange={(next) => {
              const [first] = next;

              if (first !== undefined) {
                onChange(first);
              }
            }}
          >
            <RadixSlider.Track className={styles.track}>
              <RadixSlider.Range className={styles.range} />
            </RadixSlider.Track>
            <RadixSlider.Thumb className={styles.thumb} />
          </RadixSlider.Root>
        </div>
      )}
    </Field>
  );
}
