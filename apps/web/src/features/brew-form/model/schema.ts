import { z } from 'zod';

import type { BrewCreateInput } from '@/shared/api';

const METHODS = [
  'v60',
  'aeropress',
  'espresso',
  'chemex',
  'french_press',
  'moka',
  'cold_brew',
  'other',
] as const;

/**
 * Mirrors the API contract deliberately rather than importing it: the backend schema lives in
 * a Node workspace and pulling it into the bundle would drag server code with it. The two are
 * kept honest by the server re-validating everything — a divergence surfaces as a 422, never
 * as bad data.
 *
 * A shared `packages/contracts` workspace would remove the duplication; noted as future work.
 *
 * Optional text fields use '' rather than null here, because that is what an empty input
 * produces. The conversion to null happens once, in toApiInput.
 */
export const brewFormSchema = z
  .object({
    method: z.enum(METHODS),
    methodOther: z.string().trim().max(40),
    beanName: z.string().trim().min(1, 'Which bean was it?').max(120),
    roaster: z.string().trim().max(120),
    roastDate: z.string(),
    grindSize: z.string().trim().min(1, 'Note the grind, even roughly').max(40),
    doseGrams: z.number().min(0.1, 'At least 0.1 g').max(200),
    waterMl: z.number().min(1, 'At least 1 ml').max(5000),
    waterTempC: z.number().min(1).max(100),
    /**
     * Two fields rather than one "mm:ss" string. A numeric keypad has no colon, so on a phone
     * the combined field was impossible to fill; asking for a text keyboard to type one
     * separator is the wrong trade. Splitting removes the separator instead of working around
     * the keyboard.
     */
    brewMinutes: z.number().int().min(0).max(59),
    brewSeconds: z.number().int().min(0, 'Seconds run 0 to 59').max(59, 'Seconds run 0 to 59'),
    notes: z.string().trim().max(2000),
    rating: z.number().int().min(1, 'Give it a score').max(5),
    // Optional: not everyone has a refractometer on the bar. Empty input becomes null.
    tdsPercent: z
      .number()
      .min(0.01, 'TDS is a percentage, around 1.4 for filter')
      .max(20, 'That reads like a misplaced decimal')
      .nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.brewMinutes * 60 + value.brewSeconds < 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['brewSeconds'],
        message: 'A brew takes longer than nothing',
      });
    }

    if (value.method === 'other' && value.methodOther === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['methodOther'],
        message: 'Name the method',
      });
    }
  });

export type BrewFormValues = z.infer<typeof brewFormSchema>;

export function toApiInput(values: BrewFormValues): BrewCreateInput {
  return {
    method: values.method,
    methodOther: values.method === 'other' ? values.methodOther : null,
    beanName: values.beanName,
    roaster: values.roaster === '' ? null : values.roaster,
    roastDate: values.roastDate === '' ? null : values.roastDate,
    grindSize: values.grindSize,
    doseGrams: values.doseGrams,
    waterMl: values.waterMl,
    waterTempC: values.waterTempC,
    brewTimeSeconds: values.brewMinutes * 60 + values.brewSeconds,
    notes: values.notes === '' ? null : values.notes,
    rating: values.rating,
    tdsPercent: values.tdsPercent,
  };
}

export const emptyBrewForm: BrewFormValues = {
  method: 'v60',
  methodOther: '',
  beanName: '',
  roaster: '',
  roastDate: '',
  grindSize: '',
  doseGrams: 15,
  waterMl: 250,
  waterTempC: 94,
  brewMinutes: 2,
  brewSeconds: 45,
  notes: '',
  rating: 3,
  tdsPercent: null,
};
