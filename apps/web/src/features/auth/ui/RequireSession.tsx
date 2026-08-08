import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { Skeleton } from '@/shared/ui';

import { useGetSessionQuery } from '../api/authApi';

interface RequireSessionProps {
  children: ReactNode;
}

/**
 * A client-side guard for navigation only. It is not the security boundary — the API rejects
 * every unauthenticated request on its own, and this just avoids rendering a screen that
 * would fill with 401s.
 */
export function RequireSession({ children }: RequireSessionProps) {
  const { isLoading, isError } = useGetSessionQuery();
  const location = useLocation();

  if (isLoading) {
    return <Skeleton count={2} />;
  }

  if (isError) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
