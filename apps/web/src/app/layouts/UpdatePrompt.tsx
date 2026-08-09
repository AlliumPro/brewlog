import { useRegisterSW } from 'virtual:pwa-register/react';

import { UpdateBanner } from './UpdateBanner';

/** Wiring only — the visible part is UpdateBanner, which is testable on its own. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) {
    return null;
  }

  return (
    <UpdateBanner
      onUpdate={() => {
        // true: activate the waiting worker and reload once it has taken over
        void updateServiceWorker(true);
      }}
      onDismiss={() => {
        setNeedRefresh(false);
      }}
    />
  );
}
