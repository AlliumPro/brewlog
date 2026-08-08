import type { BrewMethod } from '@/shared/api';

/** Display names for the closed method list the API accepts. */
export const METHOD_LABELS: Record<BrewMethod, string> = {
  v60: 'V60',
  aeropress: 'Aeropress',
  espresso: 'Espresso',
  chemex: 'Chemex',
  french_press: 'French press',
  moka: 'Moka',
  cold_brew: 'Cold brew',
  other: 'Other',
};

export const METHOD_OPTIONS = (Object.keys(METHOD_LABELS) as BrewMethod[]).map((value) => ({
  value,
  label: METHOD_LABELS[value],
}));

/** URL parameters are untrusted input; this keeps an unknown value out of the API query. */
export function isBrewMethod(value: string): value is BrewMethod {
  return Object.hasOwn(METHOD_LABELS, value);
}

export function methodLabel(method: BrewMethod, methodOther: string | null): string {
  return method === 'other' && methodOther !== null ? methodOther : METHOD_LABELS[method];
}
