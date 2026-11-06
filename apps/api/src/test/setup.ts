/**
 * Test environment. These are throwaway fixtures, not defaults for any real run —
 * loadEnv() has no fallbacks for secrets precisely so that production cannot start half-configured.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'memory://';
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough';
process.env.SWAGGER_USER = 'test';
process.env.SWAGGER_PASSWORD = 'test';
process.env.LOG_LEVEL = 'silent';
