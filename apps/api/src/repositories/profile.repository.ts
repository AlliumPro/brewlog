import { eq } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { profile } from '../db/schema.js';

/** There is one owner, so there is one row. Its id is a constant rather than a lookup. */
const SINGLETON_ID = 'owner';

export function createProfileRepository(db: Db) {
  return {
    async read(): Promise<{ displayName: string | null }> {
      const [row] = await db
        .select({ displayName: profile.displayName })
        .from(profile)
        .where(eq(profile.id, SINGLETON_ID))
        .limit(1);

      // Absent row and empty name are the same thing to a caller: nobody has set one.
      return { displayName: row?.displayName ?? null };
    },

    async write(displayName: string | null): Promise<{ displayName: string | null }> {
      const now = new Date().toISOString();

      await db
        .insert(profile)
        .values({ id: SINGLETON_ID, displayName, updatedAt: now })
        // Upsert, so the first save does not need a separate "create profile" step.
        .onConflictDoUpdate({ target: profile.id, set: { displayName, updatedAt: now } });

      return { displayName };
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
