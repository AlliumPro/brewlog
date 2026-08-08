import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

import styles from './Field.module.css';

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string | undefined;
  children: (ids: { inputId: string; describedBy: string | undefined }) => ReactNode;
}

/**
 * Every field is labelled and, when it fails validation, wired to its message through
 * aria-describedby with aria-invalid. Colour alone never carries the error.
 */
export function Field({ label, hint, error, children }: FieldShellProps) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy =
    [error !== undefined ? errorId : undefined, hint !== undefined ? hintId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>

      {children({ inputId, describedBy })}

      {hint !== undefined && (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      )}

      {error !== undefined && (
        <p className={styles.error} id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  hint?: string;
  error?: string | undefined;
};

export function TextField({ label, hint, error, className, ...rest }: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ inputId, describedBy }) => (
        <input
          {...rest}
          id={inputId}
          className={[styles.input, className].filter(Boolean).join(' ')}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
        />
      )}
    </Field>
  );
}

type TextAreaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: string;
  hint?: string;
  error?: string | undefined;
};

export function TextAreaField({ label, hint, error, className, ...rest }: TextAreaFieldProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      {({ inputId, describedBy }) => (
        <textarea
          {...rest}
          id={inputId}
          rows={rest.rows ?? 4}
          className={[styles.input, styles.textarea, className].filter(Boolean).join(' ')}
          aria-invalid={error !== undefined}
          aria-describedby={describedBy}
        />
      )}
    </Field>
  );
}
