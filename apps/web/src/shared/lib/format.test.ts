import { describe, expect, it } from 'vitest';

import {
  formatBrewTime,
  formatDaysAfterRoast,
  formatDose,
  formatRatio,
  parseBrewTime,
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

  it('parses mm:ss back to seconds', () => {
    expect(parseBrewTime('2:45')).toBe(165);
    expect(parseBrewTime(' 1:05 ')).toBe(65);
  });

  it('rejects input that is not a time', () => {
    expect(parseBrewTime('165')).toBeNull();
    expect(parseBrewTime('2:75')).toBeNull();
    expect(parseBrewTime('')).toBeNull();
  });
});

describe('formatDose', () => {
  it('drops the decimal when the dose is a whole number of grams', () => {
    expect(formatDose(15)).toBe('15 g');
    expect(formatDose(15.5)).toBe('15.5 g');
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
