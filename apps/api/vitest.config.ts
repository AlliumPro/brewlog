import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    // Every suite hashes a password with argon2 in beforeAll — 19 MiB of memory-hard work.
    // On a cold machine, right after an install, that has twice exceeded the 5s default and
    // produced a failure that does not reproduce on a rerun. The work is legitimately slow;
    // the deadline was the wrong part.
    hookTimeout: 30_000,
  },
});
