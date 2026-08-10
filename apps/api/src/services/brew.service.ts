import { v7 as uuidv7 } from 'uuid';

import type { BrewRow } from '../db/schema.js';
import { brewCompleteSchema, brewMethodSchema } from '../domain/brew.js';
import type { Brew, BrewCreate, BrewListQuery, BrewUpdate } from '../domain/brew.js';
import { notFound, unprocessable } from '../lib/errors.js';
import type { BrewRepository } from '../repositories/brew.repository.js';
import type { PhotoService } from './photo.service.js';

const MS_PER_DAY = 86_400_000;

/** Rendered as `1:N` with one decimal, so one decimal is all that is kept. */
function computeRatio(waterMl: number, doseGrams: number): number {
  return Math.round((waterMl / doseGrams) * 10) / 10;
}

/**
 * Water a wet coffee bed keeps, in grams per gram of dry coffee. The usual working figure for
 * anything brewed through a bed; it is an approximation, and the extraction figure inherits
 * that. Measuring the beverage on a scale would be exact, but that is a second field and a
 * second thing to remember at the bar.
 */
const RETAINED_WATER_PER_GRAM = 2;

/**
 * Extraction yield: the share of the dry coffee that ended up dissolved in the cup.
 *
 *   EY% = TDS% × beverage mass / dose
 *
 * The beverage is not the water poured — the bed keeps roughly two grams per gram of coffee.
 * Espresso is the exception: its recorded millilitres are the shot itself, not the water that
 * went in, so nothing is subtracted. Filter lands near 18–22% when it tastes right.
 */
function computeExtraction(row: BrewRow): number | null {
  if (row.tdsPercent === null || row.doseGrams <= 0) {
    return null;
  }

  const beverageGrams =
    row.method === 'espresso' ? row.waterMl : row.waterMl - row.doseGrams * RETAINED_WATER_PER_GRAM;

  if (beverageGrams <= 0) {
    // More coffee than water: the numbers cannot describe a real brew, so no figure is better
    // than a confident wrong one.
    return null;
  }

  return Math.round(((row.tdsPercent * beverageGrams) / row.doseGrams) * 10) / 10;
}

function computeDaysAfterRoast(roastDate: string | null, brewedAt: string): number | null {
  if (roastDate === null) {
    return null;
  }

  const roasted = Date.parse(`${roastDate}T00:00:00Z`);
  const brewed = Date.parse(brewedAt);

  if (Number.isNaN(roasted) || Number.isNaN(brewed)) {
    return null;
  }

  return Math.floor((brewed - roasted) / MS_PER_DAY);
}

export function toBrew(row: BrewRow): Brew {
  return {
    id: row.id,
    // The column is plain text, so the enum is asserted on the way out rather than assumed.
    method: brewMethodSchema.parse(row.method),
    methodOther: row.methodOther,
    beanName: row.beanName,
    roaster: row.roaster,
    roastDate: row.roastDate,
    grindSize: row.grindSize,
    doseGrams: row.doseGrams,
    waterMl: row.waterMl,
    waterTempC: row.waterTempC,
    brewTimeSeconds: row.brewTimeSeconds,
    notes: row.notes,
    rating: row.rating,
    tdsPercent: row.tdsPercent,
    extractionPercent: computeExtraction(row),
    ratio: computeRatio(row.waterMl, row.doseGrams),
    daysAfterRoast: computeDaysAfterRoast(row.roastDate, row.brewedAt),
    photoUrl: row.photoPath === null ? null : `/api/brews/${row.id}/photo`,
    brewedAt: row.brewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createBrewService(repository: BrewRepository, photos: PhotoService) {
  return {
    async list(userId: string, query: BrewListQuery): Promise<{ items: Brew[]; total: number }> {
      const { rows, total } = await repository.list(userId, query);
      return { items: rows.map(toBrew), total };
    },

    async get(userId: string, id: string): Promise<Brew> {
      const row = await repository.findById(userId, id);

      if (row === undefined) {
        throw notFound('Brew');
      }

      return toBrew(row);
    },

    async create(userId: string, input: BrewCreate): Promise<Brew> {
      const now = new Date().toISOString();

      const row = await repository.insert({
        id: uuidv7(),
        userId,
        ...input,
        photoPath: null,
        createdAt: now,
        updatedAt: now,
      });

      return toBrew(row);
    },

    async update(userId: string, id: string, patch: BrewUpdate): Promise<Brew> {
      const existing = await repository.findById(userId, id);

      if (existing === undefined) {
        throw notFound('Brew');
      }

      // The merged record is re-validated against the full schema, so a PATCH cannot reach
      // a state that a POST would have rejected — for example method 'v60' with methodOther set.
      const merged = {
        method: patch.method ?? existing.method,
        methodOther: patch.methodOther === undefined ? existing.methodOther : patch.methodOther,
        beanName: patch.beanName ?? existing.beanName,
        roaster: patch.roaster === undefined ? existing.roaster : patch.roaster,
        roastDate: patch.roastDate === undefined ? existing.roastDate : patch.roastDate,
        grindSize: patch.grindSize ?? existing.grindSize,
        doseGrams: patch.doseGrams ?? existing.doseGrams,
        waterMl: patch.waterMl ?? existing.waterMl,
        waterTempC: patch.waterTempC ?? existing.waterTempC,
        brewTimeSeconds: patch.brewTimeSeconds ?? existing.brewTimeSeconds,
        notes: patch.notes === undefined ? existing.notes : patch.notes,
        rating: patch.rating ?? existing.rating,
        tdsPercent: patch.tdsPercent === undefined ? existing.tdsPercent : patch.tdsPercent,
        brewedAt: patch.brewedAt ?? existing.brewedAt,
      };

      const validated = brewCompleteSchema.safeParse(merged);

      if (!validated.success) {
        const first = validated.error.issues[0];
        throw unprocessable(first?.message ?? 'Resulting brew is not valid');
      }

      const row = await repository.update(userId, id, {
        ...validated.data,
        updatedAt: new Date().toISOString(),
      });

      if (row === undefined) {
        throw notFound('Brew');
      }

      return toBrew(row);
    },

    async remove(userId: string, id: string): Promise<void> {
      const removed = await repository.remove(userId, id);

      if (!removed) {
        throw notFound('Brew');
      }

      // The row is gone, so the file has nothing left pointing at it.
      await photos.remove(id);
    },

    async attachPhoto(userId: string, id: string, file: Buffer): Promise<Brew> {
      const existing = await repository.findById(userId, id);

      if (existing === undefined) {
        throw notFound('Brew');
      }

      const photoPath = await photos.store(id, file);
      const row = await repository.update(userId, id, {
        photoPath,
        updatedAt: new Date().toISOString(),
      });

      if (row === undefined) {
        throw notFound('Brew');
      }

      return toBrew(row);
    },

    /** Resolves the on-disk path only for a brew that actually has a photo. */
    async photoPath(userId: string, id: string): Promise<string> {
      const row = await repository.findById(userId, id);

      if (row === undefined) {
        throw notFound('Brew');
      }

      if (row.photoPath === null) {
        throw notFound('Photo');
      }

      return row.photoPath;
    },

    async detachPhoto(userId: string, id: string): Promise<void> {
      const row = await repository.findById(userId, id);

      if (row === undefined) {
        throw notFound('Brew');
      }

      if (row.photoPath === null) {
        throw notFound('Photo');
      }

      await photos.remove(id);
      await repository.update(userId, id, { photoPath: null, updatedAt: new Date().toISOString() });
    },

    async suggestBeans(userId: string, q: string | undefined, limit: number): Promise<string[]> {
      return repository.suggest(userId, 'beanName', q, limit);
    },

    async suggestRoasters(userId: string, q: string | undefined, limit: number): Promise<string[]> {
      return repository.suggest(userId, 'roaster', q, limit);
    },
  };
}

export type BrewService = ReturnType<typeof createBrewService>;
