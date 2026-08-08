import { z } from 'zod';

/**
 * A closed list plus `other`. Free-text methods would fragment both the filter and the
 * distribution chart — "V60", "v60" and "V-60" would count as three methods.
 */
export const BREW_METHODS = [
  'v60',
  'aeropress',
  'espresso',
  'chemex',
  'french_press',
  'moka',
  'cold_brew',
  'other',
] as const;

export const brewMethodSchema = z.enum(BREW_METHODS);
export type BrewMethod = z.infer<typeof brewMethodSchema>;

/**
 * Field definitions without defaults. Defaults belong to the create schema only: `.partial()`
 * keeps a `.default()` alive, so a PATCH body would silently gain `methodOther: null` and
 * clear a field the caller never mentioned.
 */
const brewFields = {
  method: brewMethodSchema,
  methodOther: z.string().trim().min(1).max(40).nullable(),
  beanName: z.string().trim().min(1).max(120),
  roaster: z.string().trim().min(1).max(120).nullable(),
  roastDate: z.iso.date().nullable(),
  grindSize: z.string().trim().min(1).max(40),
  doseGrams: z.number().min(0.1).max(200),
  waterMl: z.number().min(1).max(5000),
  waterTempC: z.number().min(1).max(100),
  brewTimeSeconds: z.number().int().min(1).max(3600),
  notes: z.string().trim().max(2000).nullable(),
  rating: z.number().int().min(1).max(5),
  brewedAt: z.iso.datetime(),
};

/**
 * Cross-field invariants. Applied to a create payload and, after merging, to an update —
 * so a PATCH cannot reach a state that a POST would have rejected.
 */
function checkBrewInvariants(
  value: {
    method: BrewMethod;
    methodOther: string | null;
    roastDate: string | null;
    brewedAt: string;
  },
  ctx: z.RefinementCtx,
): void {
  if (value.method === 'other' && value.methodOther === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['methodOther'],
      message: 'methodOther is required when method is "other"',
    });
  }

  if (value.method !== 'other' && value.methodOther !== null) {
    ctx.addIssue({
      code: 'custom',
      path: ['methodOther'],
      message: 'methodOther is only allowed when method is "other"',
    });
  }

  if (value.roastDate !== null) {
    // A bean cannot be roasted after it was brewed, and not in the future at all.
    const roasted = Date.parse(`${value.roastDate}T00:00:00Z`);
    const brewed = Date.parse(value.brewedAt);

    if (roasted > brewed) {
      ctx.addIssue({
        code: 'custom',
        path: ['roastDate'],
        message: 'roastDate cannot be later than brewedAt',
      });
    }
  }
}

export const brewCreateSchema = z
  .object({
    ...brewFields,
    // Optional fields may be omitted entirely when logging a brew on a phone.
    methodOther: brewFields.methodOther.default(null),
    roaster: brewFields.roaster.default(null),
    roastDate: brewFields.roastDate.default(null),
    notes: brewFields.notes.default(null),
    // Defaults to "now", filled in after parsing so the invariants see a concrete value.
    brewedAt: brewFields.brewedAt.optional(),
  })
  .transform((value) => ({
    ...value,
    brewedAt: value.brewedAt ?? new Date().toISOString(),
  }))
  .superRefine(checkBrewInvariants)
  .describe('New brew');

/** Shape used to re-validate a merged record after PATCH. */
export const brewCompleteSchema = z.object(brewFields).superRefine(checkBrewInvariants);

export const brewUpdateSchema = z
  .object(brewFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    error: 'At least one field must be provided',
  })
  .describe('Partial brew update');

export const brewSchema = z
  .object({
    id: z.string(),
    method: brewMethodSchema,
    methodOther: z.string().nullable(),
    beanName: z.string(),
    roaster: z.string().nullable(),
    roastDate: z.string().nullable(),
    grindSize: z.string(),
    doseGrams: z.number(),
    waterMl: z.number(),
    waterTempC: z.number(),
    brewTimeSeconds: z.number().int(),
    notes: z.string().nullable(),
    rating: z.number().int(),
    ratio: z.number().describe('waterMl / doseGrams, computed — never stored'),
    daysAfterRoast: z
      .number()
      .int()
      .nullable()
      .describe('Whole days between roastDate and brewedAt, computed'),
    photoUrl: z.string().nullable().describe('Authenticated route, not a public path'),
    brewedAt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .describe('Brew');

export const brewListQuerySchema = z.object({
  method: z
    .union([brewMethodSchema, z.array(brewMethodSchema)])
    .optional()
    .describe('Repeat the parameter to filter by several methods'),
  bean: z.string().trim().min(1).max(120).optional(),
  q: z.string().trim().min(1).max(120).optional().describe('Free text over bean name and roaster'),
  sort: z.enum(['date', 'rating']).default('date'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const brewListSchema = z.object({
  items: z.array(brewSchema),
  total: z.number().int(),
});

export type BrewCreate = z.output<typeof brewCreateSchema>;
export type BrewUpdate = z.infer<typeof brewUpdateSchema>;
export type Brew = z.infer<typeof brewSchema>;
export type BrewListQuery = z.output<typeof brewListQuerySchema>;
