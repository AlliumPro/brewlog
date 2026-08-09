/**
 * Verifies every text/background pair in both themes against WCAG 2.2.
 *
 * The eye cannot tell 4.3:1 from 4.5:1, and the boundary is exactly there — so this runs in
 * `npm run verify` rather than being left to review. Values are read out of tokens.css, so a
 * token edited without rechecking its contrast fails the build.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { wcagContrast } from 'culori';

const TOKENS = fileURLToPath(new URL('../apps/web/src/app/styles/tokens.css', import.meta.url));

/** [foreground, background, minimum ratio, why] */
const PAIRS = [
  ['--color-text', '--color-bg', 4.5, 'body text on the page'],
  ['--color-text', '--color-surface', 4.5, 'body text on a card'],
  ['--color-text-muted', '--color-bg', 4.5, 'secondary text on the page'],
  ['--color-text-muted', '--color-surface', 4.5, 'secondary text on a card'],
  ['--color-text-faint', '--color-bg', 4.5, 'labels under hero numbers'],
  ['--color-text-faint', '--color-surface', 4.5, 'hints inside cards'],
  ['--color-accent-text', '--color-bg', 4.5, 'links'],
  ['--color-accent-contrast', '--color-accent-from', 4.5, 'text on the mint end'],
  ['--color-accent-contrast', '--color-accent-to', 4.5, 'text on the orchid end'],
  ['--color-accent-contrast', '--color-accent', 4.5, 'text on the solid accent'],
  ['--color-danger', '--color-bg', 4.5, 'error text'],
  // --color-border is decorative and deliberately unchecked: WCAG 1.4.11 covers the boundary
  // of interactive components, which is --color-border-strong.
  ['--color-border-strong', '--color-bg', 3, 'control outlines on the page'],
  ['--color-border-strong', '--color-surface', 3, 'control outlines on a card'],
  ['--color-accent-alt', '--color-surface', 3, 'chart marks'],
];

/**
 * Last declaration wins, matching the cascade: tokens.css deliberately declares a plain
 * fallback immediately before each light-dark() pair.
 */
function readTokens() {
  const css = readFileSync(TOKENS, 'utf8');
  const light = new Map();
  const dark = new Map();

  for (const match of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const [, name, raw] = match;
    const value = raw.trim();
    const pair = /^light-dark\(\s*(.+?)\s*,\s*(.+?)\s*\)$/s.exec(value);

    if (pair) {
      light.set(name, pair[1]);
      dark.set(name, pair[2]);
    } else if (value.startsWith('oklch(') || value.startsWith('#')) {
      light.set(name, value);
      dark.set(name, value);
    }
  }

  return { light, dark };
}

const themes = readTokens();
let failures = 0;

for (const [themeName, tokens] of Object.entries(themes)) {
  console.log(`\n${themeName}`);

  for (const [fg, bg, minimum, why] of PAIRS) {
    const fgValue = tokens.get(fg);
    const bgValue = tokens.get(bg);

    if (fgValue === undefined || bgValue === undefined) {
      console.log(`  MISSING ${fg} or ${bg}`);
      failures += 1;
      continue;
    }

    const ratio = wcagContrast(fgValue, bgValue);
    const ok = ratio >= minimum;

    if (!ok) {
      failures += 1;
    }

    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${ratio.toFixed(2)} (need ${String(minimum)})  ${fg} on ${bg} — ${why}`,
    );
  }
}

console.log(
  failures === 0 ? '\ncontrast: all pairs pass' : `\ncontrast: ${String(failures)} failing`,
);
process.exit(failures === 0 ? 0 : 1);
