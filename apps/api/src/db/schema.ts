import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Timestamps are stored as ISO-8601 strings, not as `timestamptz`. The API speaks ISO strings
 * in both directions, so a native type would only add a conversion on each side — and the
 * strings stay sortable and readable when inspecting the table directly.
 * `ratio` and `daysAfterRoast` are deliberately absent — computed values that would drift.
 */

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

/**
 * One row per account. Email is the login: unique without a second rule, and the address a
 * future "share this recipe with someone" feature will need.
 */
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  // Stored lowercased and trimmed, so Ivan@x.com and ivan@x.com cannot both exist.
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name'),
  /**
   * Bumped whenever every token already issued has to stop working — changing a password,
   * for instance. A JWT cannot be recalled, so this number is what withdraws it.
   */
  tokenVersion: integer('token_version').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export type UserRow = typeof users.$inferSelect;

export const brews = pgTable(
  'brews',
  {
    id: text('id').primaryKey(),
    // Deleting an account takes its journal with it; nothing may point at a missing owner.
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    method: text('method').notNull(),
    methodOther: text('method_other'),
    beanName: text('bean_name').notNull(),
    roaster: text('roaster'),
    roastDate: text('roast_date'),
    grindSize: text('grind_size').notNull(),
    // double precision, not real: a float4 turns 15.3 into 15.300000381 on the way back out.
    doseGrams: doublePrecision('dose_grams').notNull(),
    waterMl: doublePrecision('water_ml').notNull(),
    waterTempC: doublePrecision('water_temp_c').notNull(),
    brewTimeSeconds: integer('brew_time_seconds').notNull(),
    notes: text('notes'),
    rating: integer('rating').notNull(),
    /** Measured with a refractometer, in percent. Optional — not everyone owns one. */
    tdsPercent: doublePrecision('tds_percent'),
    /** The bytes live in `brew_photos`; this flag spares every list query a join. */
    hasPhoto: boolean('has_photo').notNull().default(false),
    brewedAt: text('brewed_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    // Every list is scoped to one owner, so the owner leads every index.
    index('brews_user_brewed_at_idx').on(table.userId, table.brewedAt),
    index('brews_method_idx').on(table.method),
    index('brews_bean_name_idx').on(table.beanName),
  ],
);

/**
 * Photos live in the database because the host has no persistent disk: a serverless function
 * can write a file, but the next invocation will not see it. A photo is re-encoded to WebP at
 * most 1600 px on its long side, so a row is a few hundred kilobytes.
 */
export const brewPhotos = pgTable('brew_photos', {
  brewId: text('brew_id')
    .primaryKey()
    .references(() => brews.id, { onDelete: 'cascade' }),
  data: bytea('data').notNull(),
});

export const recipes = pgTable(
  'recipes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    method: text('method').notNull(),
    methodOther: text('method_other'),
    beanName: text('bean_name'),
    roaster: text('roaster'),
    grindSize: text('grind_size'),
    doseGrams: doublePrecision('dose_grams'),
    waterMl: doublePrecision('water_ml'),
    waterTempC: doublePrecision('water_temp_c'),
    brewTimeSeconds: integer('brew_time_seconds'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    // Unique per owner, not globally: two people may each keep a "Morning V60".
    uniqueIndex('recipes_user_name_idx').on(table.userId, table.name),
  ],
);

/**
 * Counters for the credential endpoints. A serverless function has no memory that outlives a
 * request, so an in-process limiter would hand every cold start a fresh five attempts.
 */
export const rateLimits = pgTable('rate_limits', {
  key: text('key').primaryKey(),
  hits: integer('hits').notNull(),
  /** Epoch milliseconds at which the window closes. */
  resetsAt: doublePrecision('resets_at').notNull(),
});

export type BrewRow = typeof brews.$inferSelect;
export type BrewInsert = typeof brews.$inferInsert;
export type RecipeRow = typeof recipes.$inferSelect;
export type RecipeInsert = typeof recipes.$inferInsert;
