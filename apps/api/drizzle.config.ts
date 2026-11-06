import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  // Only `generate` is used, and it reads the schema file, never the database. Migrations are
  // applied by the application itself, so no credentials live in this config.
  strict: true,
  verbose: true,
});
