import { Select as RadixSelect } from 'radix-ui';

import { Field } from './Field';
import styles from './SelectField.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string | undefined;
}

/**
 * Radix Select rather than a hand-rolled dropdown: focus trapping, typeahead, arrow-key
 * navigation and the aria wiring are the hard part, and reimplementing them badly is worse
 * than a native select.
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder = 'Choose…',
  hint,
  error,
}: SelectFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ inputId, describedBy }) => (
        <RadixSelect.Root value={value} onValueChange={onChange}>
          <RadixSelect.Trigger
            id={inputId}
            className={styles.trigger}
            aria-invalid={error !== undefined}
            aria-describedby={describedBy}
          >
            <RadixSelect.Value placeholder={placeholder} />
            <RadixSelect.Icon className={styles.icon} aria-hidden="true">
              ▾
            </RadixSelect.Icon>
          </RadixSelect.Trigger>

          <RadixSelect.Portal>
            <RadixSelect.Content className={styles.content} position="popper" sideOffset={4}>
              <RadixSelect.Viewport className={styles.viewport}>
                {options.map((option) => (
                  <RadixSelect.Item key={option.value} value={option.value} className={styles.item}>
                    <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                  </RadixSelect.Item>
                ))}
              </RadixSelect.Viewport>
            </RadixSelect.Content>
          </RadixSelect.Portal>
        </RadixSelect.Root>
      )}
    </Field>
  );
}
