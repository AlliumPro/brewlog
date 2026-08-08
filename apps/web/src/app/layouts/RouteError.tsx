import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router';

import { ErrorState } from '@/shared/ui';

/**
 * React Router's errorElement gives us an error boundary without writing a class component,
 * which this project does not allow. Attached to the root and to every page route, so one
 * broken screen never takes down the whole app.
 */
export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();

  const isNotFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <ErrorState
      title={isNotFound ? 'That page does not exist' : 'Something broke on this screen'}
      hint={
        isNotFound
          ? 'The link may be stale. The journal itself is fine.'
          : 'The rest of the journal still works. Reloading this screen usually clears it.'
      }
      onRetry={() => {
        void navigate(0);
      }}
    />
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <ErrorState
      title="That page does not exist"
      hint="The link may be stale. The journal itself is fine."
      onRetry={() => {
        void navigate('/');
      }}
    />
  );
}
