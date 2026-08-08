import { LoginForm } from '@/features/auth';

import styles from './LoginPage.module.css';

export function LoginPage() {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>BrewLog</h1>
        <p className={styles.subtitle}>A private record of what you brewed and how it tasted.</p>
        <LoginForm />
      </div>
    </main>
  );
}
