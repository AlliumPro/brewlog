import { useState } from 'react';
import { useNavigate } from 'react-router';

import { Button, TextField } from '@/shared/ui';

import { useLoginMutation } from '../api/authApi';
import styles from './LoginForm.module.css';

/** Maps the API's answer to something a human can act on, without leaking detail. */
function messageForStatus(status: number | undefined): string {
  if (status === 429) {
    return 'Too many attempts. Wait a quarter of an hour and try again.';
  }

  if (status === 401) {
    return 'That is not the password.';
  }

  return 'Could not sign in. Check the connection and try again.';
}

export function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [login, { isLoading }] = useLoginMutation();
  const navigate = useNavigate();

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        setError(undefined);

        void login({ password })
          .unwrap()
          .then(() => {
            void navigate('/', { replace: true });
          })
          .catch((rejection: unknown) => {
            const status =
              typeof rejection === 'object' && rejection !== null && 'status' in rejection
                ? (rejection as { status?: number }).status
                : undefined;

            setError(messageForStatus(status));
            setPassword('');
          });
      }}
    >
      <TextField
        label="Password"
        type="password"
        value={password}
        autoComplete="current-password"
        autoFocus
        required
        error={error}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
      />

      <Button type="submit" fullWidth disabled={isLoading || password === ''}>
        {isLoading ? 'Checking…' : 'Open the journal'}
      </Button>
    </form>
  );
}
