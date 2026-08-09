import { Button } from '@/shared/ui';

import styles from './UpdateBanner.module.css';

interface UpdateBannerProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

/**
 * Presentation only, so it can be tested without a service worker. The wiring lives in
 * UpdatePrompt.
 *
 * A service worker keeps serving the old version until every tab is closed, and a journal on
 * a home screen is never closed — so without this the app quietly stays weeks behind. It is
 * still an offer, not a reload: an unannounced refresh in the middle of the brew form throws
 * away what was typed.
 */
export function UpdateBanner({ onUpdate, onDismiss }: UpdateBannerProps) {
  return (
    <div className={styles.banner} role="status">
      <p className={styles.text}>A new version is ready.</p>
      <div className={styles.actions}>
        <Button onClick={onUpdate}>Update</Button>
        <Button variant="ghost" onClick={onDismiss}>
          Later
        </Button>
      </div>
    </div>
  );
}
