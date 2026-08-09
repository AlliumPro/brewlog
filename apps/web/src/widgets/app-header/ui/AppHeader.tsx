import { NavLink, useNavigate } from 'react-router';

import { useLogoutMutation } from '@/features/auth';
import { Button } from '@/shared/ui';

import styles from './AppHeader.module.css';
import { ThemeSwitcher } from './ThemeSwitcher';

export function AppHeader() {
  const [logout, { isLoading }] = useLogoutMutation();
  const navigate = useNavigate();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <NavLink to="/" className={styles.brand}>
          BrewLog
        </NavLink>

        <nav className={styles.nav} aria-label="Main">
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}
          >
            History
          </NavLink>
          <NavLink
            to="/stats"
            className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}
          >
            Statistics
          </NavLink>
          <NavLink
            to="/brews/new"
            className={({ isActive }) => (isActive ? styles.linkActive : styles.link)}
          >
            Log a brew
          </NavLink>
        </nav>

        <ThemeSwitcher />

        <Button
          variant="ghost"
          disabled={isLoading}
          onClick={() => {
            void logout()
              .unwrap()
              .then(() => {
                void navigate('/login', { replace: true });
              });
          }}
        >
          Lock
        </Button>
      </div>
    </header>
  );
}
