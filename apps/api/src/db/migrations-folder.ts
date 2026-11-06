import { fileURLToPath } from 'node:url';

/** The same folder from src/ under tsx and from dist/ once built. */
export const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
