import { NavLink, useNavigate } from 'react-router';

import { useLogoutMutation } from '@/features/auth';
import { Button } from '@/shared/ui';

import styles from './AppHeader.module.css';
import { ThemeSwitcher } from './ThemeSwitcher';

/**
 * Brand, theme and lock only. Section navigation moved to the bottom bar, where a thumb can
 * reach it — duplicating it here would give two controls for one decision.
 */
export function AppHeader() {
  const [logout, { isLoading }] = useLogoutMutation();
  const navigate = useNavigate();

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <NavLink to="/" className={styles.brand}>
          BrewLog
        </NavLink>

        <div className={styles.actions}>
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
      </div>
    </header>
  );
}
