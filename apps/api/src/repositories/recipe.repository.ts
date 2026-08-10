import { and, asc, eq } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { recipes } from '../db/schema.js';
import type { RecipeInsert, RecipeRow } from '../db/schema.js';

export function createRecipeRepository(db: Db) {
  return {
    async list(userId: string): Promise<RecipeRow[]> {
      return db.select().from(recipes).where(eq(recipes.userId, userId)).orderBy(asc(recipes.name));
    },

    async findById(userId: string, id: string): Promise<RecipeRow | undefined> {
      const [row] = await db
        .select()
        .from(recipes)
        .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
        .limit(1);
      return row;
    },

    async findByName(userId: string, name: string): Promise<RecipeRow | undefined> {
      const [row] = await db
        .select()
        .from(recipes)
        .where(and(eq(recipes.name, name), eq(recipes.userId, userId)))
        .limit(1);
      return row;
    },

    async insert(row: RecipeInsert): Promise<RecipeRow> {
      const [inserted] = await db.insert(recipes).values(row).returning();

      if (inserted === undefined) {
        throw new Error('insert returned no row');
      }

      return inserted;
    },

    async update(
      userId: string,
      id: string,
      patch: Partial<RecipeInsert>,
    ): Promise<RecipeRow | undefined> {
      const [updated] = await db
        .update(recipes)
        .set(patch)
        .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
        .returning();
      return updated;
    },

    async remove(userId: string, id: string): Promise<boolean> {
      const removed = await db
        .delete(recipes)
        .where(and(eq(recipes.id, id), eq(recipes.userId, userId)))
        .returning({ id: recipes.id });
      return removed.length > 0;
    },
  };
}

export type RecipeRepository = ReturnType<typeof createRecipeRepository>;
