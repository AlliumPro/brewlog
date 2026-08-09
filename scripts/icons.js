/**
 * Generates the app icons from the brand tokens. Run with `npm run icons` after changing the
 * accents; the output is committed so the build never depends on this script.
 *
 * Three shapes, because platforms crop differently:
 *   - any:      rounded square, artwork fills it — used by browsers and desktop
 *   - maskable: full bleed, artwork inside the middle 80% — Android crops to a circle and
 *               would otherwise slice the glyph
 *   - apple:    square with no transparency — iOS puts its own rounding on top and renders
 *               transparent pixels black
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const OUT = fileURLToPath(new URL('../apps/web/public/icons/', import.meta.url));

const MINT = '#BFF1E1';
const ORCHID = '#DA8FDD';
const INK = '#141018';

/** `inset` is the share of the canvas left empty around the glyph. */
function svg(size, { radius, inset }) {
  const glyph = size * (1 - inset * 2);
  const offset = size * inset;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${MINT}"/>
      <stop offset="100%" stop-color="${ORCHID}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${offset} ${offset})">
    <!-- Handle first, so the cup wall is drawn over the point where the arc meets it -->
    <path d="M ${glyph * 0.66} ${glyph * 0.34}
             a ${glyph * 0.15} ${glyph * 0.15} 0 0 1 0 ${glyph * 0.26}"
          fill="none" stroke="${INK}" stroke-width="${glyph * 0.07}" stroke-linecap="round"/>
    <path d="M ${glyph * 0.14} ${glyph * 0.22}
             L ${glyph * 0.14} ${glyph * 0.56}
             a ${glyph * 0.27} ${glyph * 0.27} 0 0 0 ${glyph * 0.54} 0
             L ${glyph * 0.68} ${glyph * 0.22} Z"
          fill="url(#g)" stroke="${INK}" stroke-width="${glyph * 0.07}" stroke-linejoin="round"/>
    <line x1="${glyph * 0.06}" y1="${glyph * 0.92}" x2="${glyph * 0.76}" y2="${glyph * 0.92}"
          stroke="${INK}" stroke-width="${glyph * 0.07}" stroke-linecap="round"/>
  </g>
</svg>`;
}

const TARGETS = [
  { file: '192.png', size: 192, radius: 40, inset: 0.16 },
  { file: '512.png', size: 512, radius: 106, inset: 0.16 },
  // Android's safe zone is the middle 80%, so the glyph sits further in and the gradient
  // runs to the edges.
  { file: 'maskable-512.png', size: 512, radius: 0, inset: 0.26 },
  { file: 'apple-touch-icon.png', size: 180, radius: 0, inset: 0.16 },
];

await mkdir(OUT, { recursive: true });

for (const { file, size, radius, inset } of TARGETS) {
  const png = await sharp(Buffer.from(svg(size, { radius, inset })))
    .png({ compressionLevel: 9 })
    .toBuffer();

  await writeFile(new URL(file, `file://${OUT.replaceAll('\\', '/')}`), png);
  console.log(
    `${file.padEnd(24)} ${size}×${size}  ${String(Math.round(png.length / 102.4) / 10)} KB`,
  );
}
