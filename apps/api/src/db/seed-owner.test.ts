import { hash } from '@node-rs/argon2';
import { describe, expect, it } from 'vitest';

import { createDb } from './client.js';
import { runMigrations } from './migrate.js';
import { brews, recipes, users } from './schema.js';
import { MIGRATED_OWNER_EMAIL, seedOwnerFromLegacyHash } from './seed-owner.js';

function freshDb() {
  const db = createDb(':memory:');
  runMigrations(db);
  return db;
}

const sampleBrewRow = {
  method: 'v60',
  beanName: 'Before accounts',
  grindSize: 'medium',
  doseGrams: 15,
  waterMl: 250,
  waterTempC: 94,
  brewTimeSeconds: 165,
  rating: 4,
  brewedAt: '2026-07-28T07:30:00.000Z',
  createdAt: '2026-07-28T07:30:00.000Z',
  updatedAt: '2026-07-28T07:30:00.000Z',
};

describe('migrating the single-password owner into an account', () => {
  it('adopts rows that were written before accounts existed', async () => {
    const db = freshDb();
    const legacyHash = await hash('the old site password', {
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    // Rows from before the change carry the empty owner default.
    db.insert(brews)
      .values({ id: 'brew-1', ...sampleBrewRow })
      .run();
    db.insert(recipes)
      .values({
        id: 'recipe-1',
        name: 'Old recipe',
        method: 'v60',
        createdAt: sampleBrewRow.createdAt,
      })
      .run();

    const result = seedOwnerFromLegacyHash(db, legacyHash);

    expect(result).toEqual({ created: true, adoptedBrews: 1, adoptedRecipes: 1 });

    const [owner] = db.select().from(users).all();

    expect(owner?.email).toBe(MIGRATED_OWNER_EMAIL);
    // The password is carried over untouched, so the owner signs in with what they already know.
    expect(owner?.passwordHash).toBe(legacyHash);

    const [brew] = db.select().from(brews).all();

    expect(brew?.userId).toBe(owner?.id);
  });

  it('does nothing once an account exists', async () => {
    const db = freshDb();
    const legacyHash = await hash('the old site password', {
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    seedOwnerFromLegacyHash(db, legacyHash);
    const second = seedOwnerFromLegacyHash(db, legacyHash);

    // Idempotent: a restart must not create a second owner.
    expect(second.created).toBe(false);
    expect(db.select().from(users).all()).toHaveLength(1);
  });

  it('does nothing when there is no legacy password to migrate', () => {
    const db = freshDb();

    expect(seedOwnerFromLegacyHash(db, undefined).created).toBe(false);
    expect(db.select().from(users).all()).toHaveLength(0);
  });
});
