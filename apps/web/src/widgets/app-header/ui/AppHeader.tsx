import { NavLink } from 'react-router';

import styles from './AppHeader.module.css';

/**
 * Brand only. Navigation moved to the bottom bar, where a thumb reaches it, and locking moved
 * into the account screen — it is a deliberate, rare action and does not belong one stray tap
 * away from the title.
 */
export function AppHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <NavLink to="/" className={styles.brand}>
          BrewLog
        </NavLink>
      </div>
    </header>
  );
}
