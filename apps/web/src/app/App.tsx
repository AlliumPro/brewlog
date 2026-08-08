import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { Suspense } from 'react';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router';

import { baseApi } from '@/shared/api';
import { Skeleton } from '@/shared/ui';

import { router } from './router';

/**
 * The only global state this app has is server state, and RTK Query owns it. There is no
 * plain slice and no separate store module: a store with one reducer does not need a file of
 * its own, and inventing "session state" beside the session query would create two sources of
 * truth for the same fact.
 */
const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

// Refetch when the tab regains focus or the connection comes back.
setupListeners(store.dispatch);

export function App() {
  return (
    <Provider store={store}>
      <Suspense fallback={<Skeleton count={2} />}>
        <RouterProvider router={router} />
      </Suspense>
    </Provider>
  );
}
