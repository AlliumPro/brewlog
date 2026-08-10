import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { CredentialsForm, useLoginMutation } from '@/features/auth';

import styles from './LoginPage.module.css';

export function LoginPage() {
  const [login, { isLoading }] = useLoginMutation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | undefined>(undefined);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>BrewLog</h1>
        <p className={styles.subtitle}>A record of what you brewed and how it tasted.</p>

        <CredentialsForm
          mode="signIn"
          busy={isLoading}
          error={error}
          onSubmit={(credentials) => {
            setError(undefined);

            void login(credentials)
              .unwrap()
              .then(() => {
                void navigate('/', { replace: true });
              })
              .catch((rejection: unknown) => {
                const status =
                  typeof rejection === 'object' && rejection !== null && 'status' in rejection
                    ? (rejection as { status?: number }).status
                    : undefined;

                // The server refuses to say which of the two was wrong, and neither does this:
                // a friendlier message here would undo that.
                setError(
                  status === 401
                    ? 'Wrong email or password.'
                    : status === 429
                      ? 'Too many attempts. Wait a quarter of an hour and try again.'
                      : 'Could not sign in. Check the connection and try again.',
                );
              });
          }}
        />

        <p className={styles.alternative}>
          {'No account yet? '}
          <Link to="/register">Create one</Link>
        </p>
      </div>
    </main>
  );
}
