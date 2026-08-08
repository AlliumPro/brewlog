import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Timestamps are stored as ISO-8601 strings. SQLite has no date type, and text keeps them
 * both sortable and readable when inspecting the file directly.
 * `ratio` and `daysAfterRoast` are deliberately absent — computed values that would drift.
 */
export const brews = sqliteTable(
  'brews',
  {
    id: text('id').primaryKey(),
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
    photoPath: text('photo_path'),
    brewedAt: text('brewed_at').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('brews_brewed_at_idx').on(table.brewedAt),
    index('brews_method_idx').on(table.method),
    index('brews_bean_name_idx').on(table.beanName),
  ],
);

export const recipes = sqliteTable('recipes', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
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
});

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
