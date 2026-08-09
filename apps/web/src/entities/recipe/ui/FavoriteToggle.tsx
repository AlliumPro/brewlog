import styles from './FavoriteToggle.module.css';

interface FavoriteToggleProps {
  isFavorite: boolean;
  name: string;
  onChange: (next: boolean) => void;
}

/**
 * A real toggle button rather than a clickable icon: `aria-pressed` is what tells a screen
 * reader whether the recipe is already a favourite. The filled shape alone says nothing to
 * anyone who cannot see it, and colour alone says nothing to anyone who cannot separate it.
 */
export function FavoriteToggle({ isFavorite, name, onChange }: FavoriteToggleProps) {
  return (
    <button
      type="button"
      className={isFavorite ? styles.buttonActive : styles.button}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
      onClick={() => {
        onChange(!isFavorite);
      }}
    >
      <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true">
        <path
          d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.6 9.7l5.8-.8z"
          fill={isFavorite ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
