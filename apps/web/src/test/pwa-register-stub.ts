import { useState } from 'react';

/**
 * Stands in for virtual:pwa-register/react, which only exists after the PWA plugin has run.
 * Reports "nothing to update", so a test that renders the layout gets the ordinary case;
 * the banner itself is tested directly, without a service worker.
 */
export function useRegisterSW() {
  const needRefresh = useState(false);
  const offlineReady = useState(false);

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: async () => {
      // no worker in jsdom
    },
  };
}
