import { Suspense } from 'react';
import { Outlet } from 'react-router';

import { RequireSession } from '@/features/auth';
import { Skeleton } from '@/shared/ui';
import { AppHeader } from '@/widgets/app-header';

import styles from './RootLayout.module.css';

export function RootLayout() {
  return (
    <RequireSession>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <AppHeader />
      <main id="main" className={styles.main}>
        <Suspense fallback={<Skeleton count={2} />}>
          <Outlet />
        </Suspense>
      </main>
    </RequireSession>
  );
}
