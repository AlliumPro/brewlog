import { describe, expect, it } from 'vitest';

import {
  extractionPreview,
  extractionVerdict,
  formatBrewTime,
  formatDaysAfterRoast,
  formatDose,
  formatRatio,
} from './format';

describe('formatRatio', () => {
  it('writes a ratio the way it appears on a coffee bag', () => {
    expect(formatRatio(16.666)).toBe('1:16.7');
    expect(formatRatio(20)).toBe('1:20.0');
  });
});

describe('brew time', () => {
  it('formats seconds as mm:ss with a padded seconds field', () => {
    expect(formatBrewTime(165)).toBe('2:45');
    expect(formatBrewTime(65)).toBe('1:05');
    expect(formatBrewTime(600)).toBe('10:00');
  });
});

describe('formatDose', () => {
  it('drops the decimal when the dose is a whole number of grams', () => {
    expect(formatDose(15)).toBe('15 g');
    expect(formatDose(15.5)).toBe('15.5 g');
  });
});

describe('extractionPreview', () => {
  /**
   * The same worked examples the API asserts on. The formula exists on both sides — the
   * server to store it, the client to show it live — and these numbers are what keep the two
   * from drifting apart.
   */
  it('allows for the water the coffee bed keeps', () => {
    expect(
      extractionPreview({ tdsPercent: 1.35, doseGrams: 15, waterMl: 250, isEspresso: false }),
    ).toBe(19.8);
  });

  it('treats espresso millilitres as the shot itself', () => {
    expect(extractionPreview({ tdsPercent: 9, doseGrams: 18, waterMl: 36, isEspresso: true })).toBe(
      18,
    );
  });

  it('says nothing when TDS was not measured', () => {
    expect(
      extractionPreview({ tdsPercent: null, doseGrams: 15, waterMl: 250, isEspresso: false }),
    ).toBeNull();
  });

  it('says nothing when the coffee would hold more water than was poured', () => {
    expect(
      extractionPreview({ tdsPercent: 1.4, doseGrams: 20, waterMl: 30, isEspresso: false }),
    ).toBeNull();
  });

  it('survives the half-typed values a live form produces', () => {
    expect(
      extractionPreview({ tdsPercent: Number.NaN, doseGrams: 15, waterMl: 250, isEspresso: false }),
    ).toBeNull();
    expect(
      extractionPreview({ tdsPercent: 1.4, doseGrams: 0, waterMl: 250, isEspresso: false }),
    ).toBeNull();
  });
});

describe('extractionVerdict', () => {
  it('names the band a figure falls in', () => {
    expect(extractionVerdict(16.5)).toBe('under');
    expect(extractionVerdict(19.8)).toBe('ideal');
    expect(extractionVerdict(23.4)).toBe('over');
  });

  it('treats the edges of 18 and 22 as inside the band', () => {
    expect(extractionVerdict(18)).toBe('ideal');
    expect(extractionVerdict(22)).toBe('ideal');
  });
});

describe('formatDaysAfterRoast', () => {
  it('reads correctly in the singular, the plural and on roast day', () => {
    expect(formatDaysAfterRoast(8)).toBe('8 days after roast');
    expect(formatDaysAfterRoast(1)).toBe('1 day after roast');
    expect(formatDaysAfterRoast(0)).toBe('roasted the same day');
  });

  it('says nothing when the roast date is unknown', () => {
    expect(formatDaysAfterRoast(null)).toBeNull();
  });
});
