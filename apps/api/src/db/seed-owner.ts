import { eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

import type { Db } from './client.js';
import { brews, profile, recipes, users } from './schema.js';

/**
 * The address the migrated account starts with. It is a placeholder, not a mailbox: the owner
 * changes it in the account screen. Nothing is sent anywhere yet, so an unreachable address
 * costs nothing until password recovery exists.
 */
export const MIGRATED_OWNER_EMAIL = 'owner@brewlog.local';

interface SeedResult {
  created: boolean;
  adoptedBrews: number;
  adoptedRecipes: number;
}

/**
 * Turns the single-password installation into an account, once.
 *
 * Before this change the journal had no users at all: one password in the environment opened
 * everything. Rather than stranding that data behind a login nobody has, the first start after
 * the change lifts the existing password hash into a real account and gives it every row that
 * has no owner.
 *
 * Idempotent by construction: it does nothing once any account exists.
 */
export function seedOwnerFromLegacyHash(db: Db, legacyHash: string | undefined): SeedResult {
  const [existing] = db
    .select({ value: sql<number>`count(*)` })
    .from(users)
    .all();

  if ((existing?.value ?? 0) > 0 || legacyHash === undefined || legacyHash === '') {
    return { created: false, adoptedBrews: 0, adoptedRecipes: 0 };
  }

  const now = new Date().toISOString();
  const id = uuidv7();

  // The display name follows the owner from the old single-row profile table, which is left
  // in place: dropping it is a destructive migration and deserves its own decision.
  const [oldProfile] = db.select({ displayName: profile.displayName }).from(profile).limit(1).all();

  db.insert(users)
    .values({
      id,
      email: MIGRATED_OWNER_EMAIL,
      passwordHash: legacyHash,
      displayName: oldProfile?.displayName ?? null,
      tokenVersion: 1,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Rows added before accounts existed carry the empty default, which belongs to nobody.
  const adoptedBrews = db.update(brews).set({ userId: id }).where(eq(brews.userId, '')).run();
  const adoptedRecipes = db.update(recipes).set({ userId: id }).where(eq(recipes.userId, '')).run();

  return {
    created: true,
    adoptedBrews: adoptedBrews.changes,
    adoptedRecipes: adoptedRecipes.changes,
  };
}
