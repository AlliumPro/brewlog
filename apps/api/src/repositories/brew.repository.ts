import { and, count, desc, eq, inArray, like, or, sql } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { brews } from '../db/schema.js';
import type { BrewInsert, BrewRow } from '../db/schema.js';
import type { BrewListQuery } from '../domain/brew.js';

/**
 * SQL only. Computed fields, mapping and invariants belong to the service layer.
 *
 * Note on search: SQLite's LIKE is case-insensitive for ASCII only, so a Cyrillic bean name
 * matches case-sensitively. Acceptable for a single-user journal; fixing it would mean an
 * FTS5 table or a normalised search column.
 */
export function createBrewRepository(db: Db) {
  /**
   * The owner is the first condition and is not optional. Filtering in the handlers instead
   * would mean one forgotten line exposes somebody else's journal.
   */
  const buildFilters = (userId: string, query: BrewListQuery) => {
    const conditions = [eq(brews.userId, userId)];

    if (query.method !== undefined) {
      const methods = Array.isArray(query.method) ? query.method : [query.method];
      conditions.push(inArray(brews.method, methods));
    }

    if (query.bean !== undefined) {
      conditions.push(eq(brews.beanName, query.bean));
    }

    if (query.q !== undefined) {
      const pattern = `%${query.q}%`;
      // or() is typed as possibly undefined because it accepts an empty list; with two
      // arguments it never is.
      const search = or(like(brews.beanName, pattern), like(brews.roaster, pattern));

      if (search !== undefined) {
        conditions.push(search);
      }
    }

    // `and()` is typed as possibly undefined because it accepts an empty list. This one never
    // is — the owner condition is always present — and starting from it keeps the type honest.
    return conditions.reduce((left, right) => and(left, right) ?? left);
  };

  return {
    async list(userId: string, query: BrewListQuery): Promise<{ rows: BrewRow[]; total: number }> {
      const where = buildFilters(userId, query);
      // Secondary key keeps paging stable when several brews share a timestamp or rating.
      const order =
        query.sort === 'rating'
          ? [desc(brews.rating), desc(brews.brewedAt), desc(brews.id)]
          : [desc(brews.brewedAt), desc(brews.id)];

      const rows = await db
        .select()
        .from(brews)
        .where(where)
        .orderBy(...order)
        .limit(query.limit)
        .offset(query.offset);

      const [totals] = await db.select({ value: count() }).from(brews).where(where);

      return { rows, total: totals?.value ?? 0 };
    },

    async findById(userId: string, id: string): Promise<BrewRow | undefined> {
      const [row] = await db
        .select()
        .from(brews)
        .where(and(eq(brews.id, id), eq(brews.userId, userId)))
        .limit(1);
      return row;
    },

    async insert(row: BrewInsert): Promise<BrewRow> {
      const [inserted] = await db.insert(brews).values(row).returning();

      if (inserted === undefined) {
        throw new Error('insert returned no row');
      }

      return inserted;
    },

    async update(
      userId: string,
      id: string,
      patch: Partial<BrewInsert>,
    ): Promise<BrewRow | undefined> {
      const [updated] = await db
        .update(brews)
        .set(patch)
        .where(and(eq(brews.id, id), eq(brews.userId, userId)))
        .returning();
      return updated;
    },

    async remove(userId: string, id: string): Promise<boolean> {
      const removed = await db
        .delete(brews)
        .where(and(eq(brews.id, id), eq(brews.userId, userId)))
        .returning({ id: brews.id });
      return removed.length > 0;
    },

    /** Distinct previously used values, for the autocomplete on the new-brew form. */
    async suggest(
      userId: string,
      field: 'beanName' | 'roaster',
      q: string | undefined,
      limit: number,
    ) {
      const column = field === 'beanName' ? brews.beanName : brews.roaster;
      // Scoped to the owner: which beans someone buys is their business, and an unscoped
      // autocomplete would quietly read them out of other people's journals.
      const conditions = [eq(brews.userId, userId), sql`${column} is not null`];

      if (q !== undefined) {
        conditions.push(like(column, `%${q}%`));
      }

      const rows = await db
        .selectDistinct({ value: column })
        .from(brews)
        .where(and(...conditions))
        .orderBy(column)
        .limit(limit);

      return rows.flatMap((row) => (row.value === null ? [] : [row.value]));
    },
  };
}

export type BrewRepository = ReturnType<typeof createBrewRepository>;
