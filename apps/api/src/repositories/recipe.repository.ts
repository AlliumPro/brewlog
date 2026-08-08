import { asc, eq } from 'drizzle-orm';

import type { Db } from '../db/client.js';
import { recipes } from '../db/schema.js';
import type { RecipeInsert, RecipeRow } from '../db/schema.js';

export function createRecipeRepository(db: Db) {
  return {
    async list(): Promise<RecipeRow[]> {
      return db.select().from(recipes).orderBy(asc(recipes.name));
    },

    async findById(id: string): Promise<RecipeRow | undefined> {
      const [row] = await db.select().from(recipes).where(eq(recipes.id, id)).limit(1);
      return row;
    },

    async findByName(name: string): Promise<RecipeRow | undefined> {
      const [row] = await db.select().from(recipes).where(eq(recipes.name, name)).limit(1);
      return row;
    },

    async insert(row: RecipeInsert): Promise<RecipeRow> {
      const [inserted] = await db.insert(recipes).values(row).returning();

      if (inserted === undefined) {
        throw new Error('insert returned no row');
      }

      return inserted;
    },

    async update(id: string, patch: Partial<RecipeInsert>): Promise<RecipeRow | undefined> {
      const [updated] = await db.update(recipes).set(patch).where(eq(recipes.id, id)).returning();
      return updated;
    },

    async remove(id: string): Promise<boolean> {
      const removed = await db
        .delete(recipes)
        .where(eq(recipes.id, id))
        .returning({ id: recipes.id });
      return removed.length > 0;
    },
  };
}

export type RecipeRepository = ReturnType<typeof createRecipeRepository>;
