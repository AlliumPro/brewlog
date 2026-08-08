import type { ReactNode } from 'react';

import { Button } from './Button';
import styles from './States.module.css';

/**
 * The four states every data screen owes the user. Kept together because they are one
 * decision, not four unrelated components.
 */

interface SkeletonProps {
  /** How many placeholder rows to draw, matched to the shape being loaded. */
  count?: number;
}

export function Skeleton({ count = 3 }: SkeletonProps) {
  return (
    <div className={styles.skeletonList} aria-busy="true" aria-live="polite">
      <span className={styles.srOnly}>Loading…</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.skeletonCard} aria-hidden="true">
          <div className={styles.skeletonLineWide} />
          <div className={styles.skeletonLineNarrow} />
        </div>
      ))}
    </div>
  );
}

interface EmptyStateProps {
  title: string;
  /** Always says what to do next; a blank screen is not an answer. */
  hint: string;
  action?: ReactNode;
}

export function EmptyState({ title, hint, action }: EmptyStateProps) {
  return (
    <div className={styles.panel}>
      <p className={styles.panelTitle}>{title}</p>
      <p className={styles.panelHint}>{hint}</p>
      {action !== undefined && <div className={styles.panelAction}>{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  hint?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Could not load that',
  hint = 'The request failed. It may be a hiccup — try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className={[styles.panel, styles.panelError].join(' ')} role="alert">
      <p className={styles.panelTitle}>{title}</p>
      <p className={styles.panelHint}>{hint}</p>
      {onRetry !== undefined && (
        <div className={styles.panelAction}>
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
