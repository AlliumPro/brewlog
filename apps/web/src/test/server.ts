import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/**
 * Component tests talk to a mock API rather than to a stub of our own query hooks: the point
 * is to exercise the same request/response path the app uses in the browser.
 */
export const handlers = [
  http.get('/api/suggestions/beans', () => HttpResponse.json(['Kieni AA'])),
  http.get('/api/suggestions/roasters', () => HttpResponse.json(['Nomad'])),
  http.get('/api/auth/session', () => HttpResponse.json({ authenticated: true })),
];

export const server = setupServer(...handlers);
