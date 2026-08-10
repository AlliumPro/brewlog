import { eq, sql } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { users } from '../db/schema.js';
import type { UserRow } from '../db/schema.js';

export function createUserRepository(db: Db) {
  return {
    async findByEmail(email: string): Promise<UserRow | undefined> {
      const [row] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      return row;
    },

    async findById(id: string): Promise<UserRow | undefined> {
      const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
      return row;
    },

    async insert(row: typeof users.$inferInsert): Promise<UserRow> {
      const [created] = await db.insert(users).values(row).returning();

      if (created === undefined) {
        throw new Error('insert returned no row');
      }

      return created;
    },

    async updateDisplayName(id: string, displayName: string | null): Promise<UserRow | undefined> {
      const [row] = await db
        .update(users)
        .set({ displayName, updatedAt: new Date().toISOString() })
        .where(eq(users.id, id))
        .returning();

      return row;
    },

    /**
     * The version bump is what makes every token already issued stop working. A JWT cannot be
     * recalled, so a password change has to invalidate them through the row they are checked
     * against — otherwise a token taken before the change keeps working for a fortnight.
     */
    async setPassword(id: string, passwordHash: string): Promise<void> {
      await db
        .update(users)
        .set({
          passwordHash,
          tokenVersion: sql`${users.tokenVersion} + 1`,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.id, id));
    },

    async count(): Promise<number> {
      const [row] = await db.select({ value: sql<number>`count(*)` }).from(users);
      return row?.value ?? 0;
    },
  };
}

export type UserRepository = ReturnType<typeof createUserRepository>;
