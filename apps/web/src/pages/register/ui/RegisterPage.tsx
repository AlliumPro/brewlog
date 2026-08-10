import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { CredentialsForm, useRegisterMutation } from '@/features/auth';

import styles from './RegisterPage.module.css';

export function RegisterPage() {
  const [register, { isLoading }] = useRegisterMutation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | undefined>(undefined);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Start a journal</h1>
        <p className={styles.subtitle}>
          Your brews are yours alone. Nobody else can see them, and nothing is shared until you
          choose to share it.
        </p>

        <CredentialsForm
          mode="register"
          busy={isLoading}
          error={error}
          onSubmit={(credentials) => {
            setError(undefined);

            void register(credentials)
              .unwrap()
              .then(() => {
                // Registering signs you in; asking for the password again would be theatre.
                void navigate('/', { replace: true });
              })
              .catch((rejection: unknown) => {
                const status =
                  typeof rejection === 'object' && rejection !== null && 'status' in rejection
                    ? (rejection as { status?: number }).status
                    : undefined;

                setError(
                  status === 409
                    ? 'There is already an account with that email.'
                    : status === 422
                      ? 'Check the email, and use at least 8 characters for the password.'
                      : status === 429
                        ? 'Too many attempts. Wait a quarter of an hour and try again.'
                        : 'Could not create the account. Try again.',
                );
              });
          }}
        />

        <p className={styles.alternative}>
          {'Already have one? '}
          <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
