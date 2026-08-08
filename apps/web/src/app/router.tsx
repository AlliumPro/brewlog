import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';

import { RootLayout } from './layouts/RootLayout';
import { NotFoundPage, RouteError } from './layouts/RouteError';

/**
 * Every page is a separate chunk. The login screen is eager on purpose — it is the first
 * thing an unauthenticated visitor sees, and a spinner before a password box is silly.
 */
const LoginPage = lazy(() =>
  import('@/pages/login').then((module) => ({ default: module.LoginPage })),
);
const HistoryPage = lazy(() =>
  import('@/pages/history').then((module) => ({ default: module.HistoryPage })),
);
const NewBrewPage = lazy(() =>
  import('@/pages/brew-new').then((module) => ({ default: module.NewBrewPage })),
);
const BrewDetailsPage = lazy(() =>
  import('@/pages/brew-details').then((module) => ({ default: module.BrewDetailsPage })),
);
const StatsPage = lazy(() =>
  import('@/pages/stats').then((module) => ({ default: module.StatsPage })),
);

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
    errorElement: <RouteError />,
  },
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HistoryPage />, errorElement: <RouteError /> },
      { path: 'brews/new', element: <NewBrewPage />, errorElement: <RouteError /> },
      { path: 'brews/:id', element: <BrewDetailsPage />, errorElement: <RouteError /> },
      { path: 'stats', element: <StatsPage />, errorElement: <RouteError /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
