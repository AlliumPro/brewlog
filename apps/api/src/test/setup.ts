/**
 * Test environment. These are throwaway fixtures, not defaults for any real run —
 * loadEnv() has no fallbacks for secrets precisely so that production cannot start half-configured.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = ':memory:';
process.env.AUTH_PASSWORD_HASH = '$argon2id$v=19$m=19456,t=2,p=1$dGVzdHNhbHR0ZXN0c2E$dGVzdGhhc2g';
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough';
process.env.UPLOAD_DIR = './data/test-uploads';
process.env.SWAGGER_USER = 'test';
process.env.SWAGGER_PASSWORD = 'test';
process.env.LOG_LEVEL = 'silent';
