import { useState } from 'react';

import { Button, TextField } from '@/shared/ui';

import styles from './CredentialsForm.module.css';

interface CredentialsFormProps {
  mode: 'signIn' | 'register';
  busy: boolean;
  error?: string | undefined;
  onSubmit: (credentials: { email: string; password: string }) => void;
}

/**
 * One form for both screens. Signing in and signing up ask for the same two things, and two
 * near-identical components would drift apart at the first change.
 */
export function CredentialsForm({ mode, busy, error, onSubmit }: CredentialsFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const registering = mode === 'register';

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ email: email.trim(), password });
      }}
    >
      <TextField
        label="Email"
        type="email"
        // Tells a password manager which field is which, and gives phones the right keyboard.
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        required
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
        }}
      />

      <TextField
        label="Password"
        type="password"
        autoComplete={registering ? 'new-password' : 'current-password'}
        hint={registering ? 'At least 8 characters. Length beats punctuation.' : undefined}
        required
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
        }}
      />

      {error !== undefined && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={busy || email === '' || password === ''}>
        {busy ? 'One moment…' : registering ? 'Create the account' : 'Open the journal'}
      </Button>
    </form>
  );
}
