import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Timestamps are stored as ISO-8601 strings. SQLite has no date type, and text keeps them
 * both sortable and readable when inspecting the file directly.
 * `ratio` and `daysAfterRoast` are deliberately absent — computed values that would drift.
 */
/**
 * One row per account. Email is the login: unique without a second rule, and the address a
 * future "share this recipe with someone" feature will need.
 */
export const users = sqliteTable('users', {
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

export const brews = sqliteTable(
  'brews',
  {
    id: text('id').primaryKey(),
    /**
     * NOT NULL with an empty default so the column could be added to existing rows. A row
     * that never gets a real owner belongs to nobody and is returned to nobody — failing
     * closed is deliberate.
     */
    userId: text('user_id').notNull().default(''),
    method: text('method').notNull(),
    methodOther: text('method_other'),
    beanName: text('bean_name').notNull(),
    roaster: text('roaster'),
    roastDate: text('roast_date'),
    grindSize: text('grind_size').notNull(),
    doseGrams: real('dose_grams').notNull(),
    waterMl: real('water_ml').notNull(),
    waterTempC: real('water_temp_c').notNull(),
    brewTimeSeconds: integer('brew_time_seconds').notNull(),
    notes: text('notes'),
    rating: integer('rating').notNull(),
    /** Measured with a refractometer, in percent. Optional — not everyone owns one. */
    tdsPercent: real('tds_percent'),
    photoPath: text('photo_path'),
    brewedAt: text('brewed_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    // Every list is scoped to one owner, so the owner leads every index.
    index('brews_user_brewed_at_idx').on(table.userId, table.brewedAt),
    index('brews_brewed_at_idx').on(table.brewedAt),
    index('brews_method_idx').on(table.method),
    index('brews_bean_name_idx').on(table.beanName),
  ],
);

export const recipes = sqliteTable(
  'recipes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull().default(''),
    // Not globally unique any more: two people may each have a "Morning V60".
    name: text('name').notNull(),
    /**
     * Unused. Favourites were dropped from the interface: the recipes screen is already the
     * short list a favourite would have produced. The column stays because removing it is a
     * destructive migration, and it costs one byte a row.
     */
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    method: text('method').notNull(),
    methodOther: text('method_other'),
    beanName: text('bean_name'),
    roaster: text('roaster'),
    grindSize: text('grind_size'),
    doseGrams: real('dose_grams'),
    waterMl: real('water_ml'),
    waterTempC: real('water_temp_c'),
    brewTimeSeconds: integer('brew_time_seconds'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    // Unique per owner, not globally: two people may each keep a "Morning V60".
    uniqueIndex('recipes_user_name_idx').on(table.userId, table.name),
  ],
);

/**
 * Server-side sessions rather than stateless tokens: with one user and one server there is
 * nothing to gain from statelessness, and logout must actually revoke.
 */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    createdAt: text('created_at').notNull(),
    expiresAt: text('expires_at').notNull(),
  },
  (table) => [index('sessions_expires_at_idx').on(table.expiresAt)],
);

export type BrewRow = typeof brews.$inferSelect;
export type BrewInsert = typeof brews.$inferInsert;
export type RecipeRow = typeof recipes.$inferSelect;
export type RecipeInsert = typeof recipes.$inferInsert;

/**
 * One row, always. Keeps the display name without inventing a user table for an application
 * that has exactly one person in it — and leaves an obvious place for whatever the owner
 * wants to store about themselves next.
 */
export const profile = sqliteTable('profile', {
  id: text('id').primaryKey(),
  displayName: text('display_name'),
  updatedAt: text('updated_at').notNull(),
});

export type ProfileRow = typeof profile.$inferSelect;
