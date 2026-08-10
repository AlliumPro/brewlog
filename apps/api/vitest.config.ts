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
    // The same reason applies inside a test body: every login verifies an argon2 hash, which
    // is 19 MiB of memory-hard work by design. Raising only the hook timeout left the login
    // tests on the 5s default, and they failed on a busy machine and passed on every rerun.
    testTimeout: 30_000,
  },
});
