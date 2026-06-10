/**
 * Generates src/lib/font-metrics.ts from the Liberation TTFs in public/fonts.
 *
 * Liberation Serif is metric-compatible with Times New Roman and
 * Liberation Mono with Courier New, so advance widths extracted here
 * equal Word's own layout widths for the same glyphs at the same size.
 *
 * Run: node scripts/generate-font-metrics.mjs
 * Output is committed. Re-run only when the font files change.
 */
import * as fontkit from 'fontkit';
import { writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Every character a paragraph designator prefix uses:
// digits, lowercase letters, parens, period, space, nbsp.
const CHARS = '0123456789abcdefghijklmnopqrstuvwxyz().  ';

function extract(fontPath) {
  const font = fontkit.openSync(fontPath);
  const upm = font.unitsPerEm;
  const widths = {};
  for (const ch of CHARS) {
    const run = font.layout(ch);
    const adv = run.glyphs[0].advanceWidth;
    // Store as fraction of em, full precision.
    widths[ch] = adv / upm;
  }
  return widths;
}

const serif = extract(path.join(ROOT, 'public/fonts/LiberationSerif-Regular.ttf'));
const mono = extract(path.join(ROOT, 'public/fonts/LiberationMono-Regular.ttf'));

const banner = `/**
 * GENERATED FILE — do not edit by hand.
 * Source: scripts/generate-font-metrics.mjs reading public/fonts TTFs.
 * Liberation Serif == Times New Roman metrics, Liberation Mono == Courier New.
 * Values are advance widths as fractions of one em.
 */
`;

const body =
  banner +
  `export const SERIF_EM_WIDTHS: Record<string, number> = ${JSON.stringify(serif, null, 2)};\n\n` +
  `export const MONO_EM_WIDTHS: Record<string, number> = ${JSON.stringify(mono, null, 2)};\n`;

writeFileSync(path.join(ROOT, 'src/lib/font-metrics.ts'), body);
console.log('Wrote src/lib/font-metrics.ts');
console.log('Serif spot checks: 1=%s .=%s a=%s (=%s', serif['1'], serif['.'], serif['a'], serif['(']);
console.log('Mono spot check (equal expected): 1=%s m=%s', mono['1'], mono['m']);
