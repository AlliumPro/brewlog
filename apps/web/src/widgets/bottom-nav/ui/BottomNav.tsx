import type { CSSProperties } from 'react';
import { Link, useLocation } from 'react-router';

import styles from './BottomNav.module.css';

interface NavItem {
  to: string;
  label: string;
  /** Which paths belong to this section, nested routes included. */
  matches: (pathname: string) => boolean;
}

/**
 * A brew's own page belongs to the journal: it is reached from that list and returns to it.
 * The "Log" segment covers only the form, so opening an entry does not light up "Log".
 */
const ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Journal',
    matches: (path) => path === '/' || (path.startsWith('/brews/') && path !== '/brews/new'),
  },
  { to: '/brews/new', label: 'Log', matches: (path) => path === '/brews/new' },
  { to: '/recipes', label: 'Recipes', matches: (path) => path.startsWith('/recipes') },
  { to: '/stats', label: 'Stats', matches: (path) => path.startsWith('/stats') },
  { to: '/profile', label: 'You', matches: (path) => path.startsWith('/profile') },
];

/**
 * A segmented control fixed to the bottom, with the active segment carried by a pill that
 * slides between positions — the iOS pattern. Bottom rather than top because a thumb reaches
 * the bottom of a phone and does not reach the top.
 *
 * The active index is computed once and drives both the pill and the link styling. Letting
 * NavLink decide the styling while a separate calculation placed the pill meant the two could
 * disagree: on a brew's own page the pill sat under "Journal" while no link considered itself
 * active, leaving muted grey text on the bright gradient.
 */
export function BottomNav() {
  const { pathname } = useLocation();
  const activeIndex = ITEMS.findIndex((item) => item.matches(pathname));

  return (
    <nav className={styles.bar} aria-label="Sections">
      <div className={styles.track} style={{ '--count': ITEMS.length } as CSSProperties}>
        {/* No pill at all when nothing matches — better than one parked under an inactive
            label. Decorative either way: the state screen readers use is aria-current. */}
        {activeIndex >= 0 && (
          <span
            className={styles.pill}
            style={{ '--index': activeIndex } as CSSProperties}
            aria-hidden="true"
          />
        )}

        {ITEMS.map((item, index) => {
          const isActive = index === activeIndex;

          return (
            <Link
              key={item.to}
              to={item.to}
              className={isActive ? styles.itemActive : styles.item}
              aria-current={isActive ? 'page' : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
