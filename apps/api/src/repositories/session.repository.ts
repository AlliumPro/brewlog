import { eq, lt } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { sessions } from '../db/schema.js';

export function createSessionRepository(db: Db) {
  return {
    async create(id: string, expiresAt: string): Promise<void> {
      await db.insert(sessions).values({ id, createdAt: new Date().toISOString(), expiresAt });
    },

    async find(id: string): Promise<{ id: string; expiresAt: string } | undefined> {
      const [row] = await db
        .select({ id: sessions.id, expiresAt: sessions.expiresAt })
        .from(sessions)
        .where(eq(sessions.id, id))
        .limit(1);
      return row;
    },

    async touch(id: string, expiresAt: string): Promise<void> {
      await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
    },

    async remove(id: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.id, id));
    },

    /** Expired rows serve no purpose and would grow the file forever. */
    async pruneExpired(now: string): Promise<void> {
      await db.delete(sessions).where(lt(sessions.expiresAt, now));
    },
  };
}

export type SessionRepository = ReturnType<typeof createSessionRepository>;
