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
  const buildFilters = (query: BrewListQuery) => {
    const conditions = [];

    if (query.method !== undefined) {
      const methods = Array.isArray(query.method) ? query.method : [query.method];
      conditions.push(inArray(brews.method, methods));
    }

    if (query.bean !== undefined) {
      conditions.push(eq(brews.beanName, query.bean));
    }

    if (query.q !== undefined) {
      const pattern = `%${query.q}%`;
      conditions.push(or(like(brews.beanName, pattern), like(brews.roaster, pattern)));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  };

  return {
    async list(query: BrewListQuery): Promise<{ rows: BrewRow[]; total: number }> {
      const where = buildFilters(query);
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

    async findById(id: string): Promise<BrewRow | undefined> {
      const [row] = await db.select().from(brews).where(eq(brews.id, id)).limit(1);
      return row;
    },

    async insert(row: BrewInsert): Promise<BrewRow> {
      const [inserted] = await db.insert(brews).values(row).returning();

      if (inserted === undefined) {
        throw new Error('insert returned no row');
      }

      return inserted;
    },

    async update(id: string, patch: Partial<BrewInsert>): Promise<BrewRow | undefined> {
      const [updated] = await db.update(brews).set(patch).where(eq(brews.id, id)).returning();
      return updated;
    },

    async remove(id: string): Promise<boolean> {
      const removed = await db.delete(brews).where(eq(brews.id, id)).returning({ id: brews.id });
      return removed.length > 0;
    },

    /** Distinct previously used values, for the autocomplete on the new-brew form. */
    async suggest(field: 'beanName' | 'roaster', q: string | undefined, limit: number) {
      const column = field === 'beanName' ? brews.beanName : brews.roaster;
      const conditions = [sql`${column} is not null`];

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
