import { configureStore } from '@reduxjs/toolkit';
import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';

import { baseApi } from '@/shared/api';

/**
 * A fresh store per test so RTK Query's cache cannot leak between cases.
 */
export function renderWithProviders(ui: ReactElement, route = '/'): RenderResult {
  const store = configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  });

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </Provider>,
  );
}
