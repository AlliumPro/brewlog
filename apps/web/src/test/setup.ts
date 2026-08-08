import '@testing-library/jest-dom/vitest';
import './polyfills';

import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from './server';

// Vitest runs without injected globals, so Testing Library's automatic cleanup does not
// register itself. Without this, each test renders into the document left by the previous one.
afterEach(cleanup);

// An unhandled request is a test writing to a real network by accident, so it fails loudly.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
