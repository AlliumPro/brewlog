import styles from './HeroValue.module.css';

interface HeroValueProps {
  label: string;
  value: string;
  /** `lg` is for the details screen, `md` for cards. */
  size?: 'md' | 'lg';
}

/**
 * The editorial device the brief asks for: the number is the headline, the label is small
 * type underneath it. Serif, tabular figures so columns of numbers line up.
 */
export function HeroValue({ label, value, size = 'md' }: HeroValueProps) {
  return (
    <div className={[styles.hero, styles[size]].join(' ')}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
