/** Brew parameters are the hero content of this UI, so their formatting lives in one place. */

/** `16.7` → `1:16.7`, the way a ratio is written on a coffee bag. */
export function formatRatio(ratio: number): string {
  return `1:${ratio.toFixed(1)}`;
}

/** `165` → `2:45`. */
export function formatBrewTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`;
}

export function parseBrewTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(value.trim());

  if (match === null) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);

  if (seconds > 59) {
    return null;
  }

  return minutes * 60 + seconds;
}

/**
 * Live preview of extraction yield while the form is being filled.
 *
 * Deliberately mirrors computeExtraction in apps/api — the server stays authoritative and
 * recomputes on save, this only avoids a round trip per keystroke. The two are kept honest by
 * tests on both sides asserting the same worked examples; a shared contracts package would be
 * the real fix and is noted in the ADR.
 */
const RETAINED_WATER_PER_GRAM = 2;

export function extractionPreview(input: {
  tdsPercent: number | null;
  doseGrams: number;
  waterMl: number;
  isEspresso: boolean;
}): number | null {
  const { tdsPercent, doseGrams, waterMl, isEspresso } = input;

  if (tdsPercent === null || !Number.isFinite(tdsPercent) || doseGrams <= 0) {
    return null;
  }

  const beverageGrams = isEspresso ? waterMl : waterMl - doseGrams * RETAINED_WATER_PER_GRAM;

  if (!Number.isFinite(beverageGrams) || beverageGrams <= 0) {
    return null;
  }

  return Math.round(((tdsPercent * beverageGrams) / doseGrams) * 10) / 10;
}

export function formatExtraction(percent: number): string {
  return `${percent.toFixed(1)}%`;
}

/** 18–22% is the band most filter brews taste balanced in. */
export function extractionVerdict(percent: number): 'under' | 'ideal' | 'over' {
  if (percent < 18) {
    return 'under';
  }

  return percent > 22 ? 'over' : 'ideal';
}

export function formatTemperature(celsius: number): string {
  return `${String(Math.round(celsius))}°C`;
}

export function formatDose(grams: number): string {
  // Whole grams read cleaner; a decimal only shows when the owner actually used one.
  return Number.isInteger(grams) ? `${String(grams)} g` : `${grams.toFixed(1)} g`;
}

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatDate(iso: string): string {
  const parsed = new Date(iso);

  return Number.isNaN(parsed.getTime()) ? '—' : dateFormatter.format(parsed);
}

/** `8` → `8 days after roast`, and the singular case reads correctly too. */
export function formatDaysAfterRoast(days: number | null): string | null {
  if (days === null) {
    return null;
  }

  if (days === 0) {
    return 'roasted the same day';
  }

  return `${String(days)} ${days === 1 ? 'day' : 'days'} after roast`;
}

/** For a date input: today in YYYY-MM-DD, local time. */
export function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${String(now.getFullYear())}-${month}-${day}`;
}
