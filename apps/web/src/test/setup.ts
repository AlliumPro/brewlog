import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs without injected globals, so Testing Library's automatic cleanup does not
// register itself. Without this, each test renders into the document left by the previous one.
afterEach(cleanup);
