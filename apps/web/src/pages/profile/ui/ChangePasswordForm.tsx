import { useState } from 'react';

import { useChangePasswordMutation } from '@/features/auth';
import { Button, TextField } from '@/shared/ui';

import styles from './ChangePasswordForm.module.css';

export function ChangePasswordForm() {
  const [changePassword, { isLoading }] = useChangePasswordMutation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [done, setDone] = useState(false);

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        setError(undefined);
        setDone(false);

        void changePassword({ currentPassword, newPassword })
          .unwrap()
          .then(() => {
            setDone(true);
            setCurrentPassword('');
            setNewPassword('');
          })
          .catch((rejection: unknown) => {
            const status =
              typeof rejection === 'object' && rejection !== null && 'status' in rejection
                ? (rejection as { status?: number }).status
                : undefined;

            setError(
              status === 401
                ? 'That is not your current password.'
                : status === 422
                  ? 'Use at least 8 characters, and something other than the old password.'
                  : status === 429
                    ? 'Too many attempts. Wait a quarter of an hour and try again.'
                    : 'Could not change the password. Try again.',
            );
          });
      }}
    >
      <TextField
        label="Current password"
        type="password"
        autoComplete="current-password"
        required
        value={currentPassword}
        onChange={(event) => {
          setCurrentPassword(event.target.value);
        }}
      />

      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        required
        value={newPassword}
        onChange={(event) => {
          setNewPassword(event.target.value);
        }}
      />

      {error !== undefined && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <Button type="submit" disabled={isLoading || currentPassword === '' || newPassword === ''}>
          {isLoading ? 'Changing…' : 'Change password'}
        </Button>
        <span className={styles.done} role="status">
          {done ? 'Password changed.' : ''}
        </span>
      </div>
    </form>
  );
}
