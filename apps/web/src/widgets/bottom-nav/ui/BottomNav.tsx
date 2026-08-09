import { NavLink, useLocation } from 'react-router';

import styles from './BottomNav.module.css';

interface NavItem {
  to: string;
  label: string;
  /** `end` keeps the index route from matching every nested path. */
  end?: boolean;
}

const ITEMS: NavItem[] = [
  { to: '/', label: 'Journal', end: true },
  { to: '/brews/new', label: 'Log' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/stats', label: 'Stats' },
  { to: '/profile', label: 'You' },
];

/**
 * A segmented control fixed to the bottom of the screen, with the active segment carried by a
 * pill that slides between positions — the iOS pattern.
 *
 * Bottom rather than top because a thumb reaches the bottom of a phone and does not reach the
 * top. The pill is one element that moves, not a background on each segment: sliding is what
 * makes the control read as a single switch instead of three separate buttons.
 */
export function BottomNav() {
  const { pathname } = useLocation();

  const activeIndex = ITEMS.reduce((found, item, index) => {
    const matches = item.end === true ? pathname === item.to : pathname.startsWith(item.to);
    return matches ? index : found;
  }, 0);

  return (
    <nav className={styles.bar} aria-label="Sections">
      <div className={styles.track} style={{ '--count': ITEMS.length } as React.CSSProperties}>
        {/* Decorative: the accessible state lives on the links themselves */}
        <span
          className={styles.pill}
          style={{ '--index': activeIndex } as React.CSSProperties}
          aria-hidden="true"
        />

        {ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => (isActive ? styles.itemActive : styles.item)}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
