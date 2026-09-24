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

// Every character volume documents actually render: digits, upper- and
// lowercase letters (headings/designators are upper-cased; body prose is
// mixed case), common ASCII punctuation seen across the volume fixtures
// (quotes, dashes, brackets, etc.), space, nbsp, and the handful of
// non-ASCII marks used in real MCO text (section sign, en/em dash, curly
// quotes).
//
// Task 18 finding C: the old charset omitted uppercase letters entirely, so
// measureText/wrapRuns fell back to a uniform 0.5em per uppercase
// character. Since every section/paragraph heading is upper-cased, that
// silently under-measured heading width against the real Times New Roman
// metrics pdf-lib paints with - long headings (e.g. Vol 17 section 0107,
// "...AWARD (CPOY-A)") were never wrapped and ran off the physical page
// edge instead.
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const PUNCT = '().,-:;!?"\'/[]{}\\|<>=+*&%$#@^_~`';
const SPACES = '  ';
const EXTRA = '§–—‘’“”'; // § – — ‘ ’ “ ”
const CHARS = DIGITS + LOWER + UPPER + PUNCT + SPACES + EXTRA;

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

// Finding 9: hyperlink runs are PAINTED bold-italic (pdf-lib's
// StandardFonts.TimesRomanBoldItalic - see volumeGenerator.ts's `fonts.link`)
// per the format standard (LEGEND_TEXT: "Hyperlinks are denoted by bold,
// italic, blue and underlined font"), but were MEASURED with the regular
// table, so any text after a link segment on the same line could be
// positioned wrong (typically too far left, since bold glyphs usually run
// wider than regular) and, in the worst case, overrun the right margin.
//
// public/fonts ships Liberation Serif Regular and Bold, but no Bold Italic
// TTF (verified: `ls public/fonts` lists only *-Regular.ttf and *-Bold.ttf
// for both Serif and Mono). Per the task brief ("if absent use closest
// available and note"), SERIF_BOLD_ITALIC_EM_WIDTHS is extracted from
// LiberationSerif-Bold.ttf instead: weight (regular vs bold) drives advance
// width far more than an italic/oblique slant does for this font, so Bold's
// widths are a much closer match to pdf-lib's TimesRomanBoldItalic paint
// widths than Regular's are. If a true Bold Italic TTF is added to
// public/fonts later, point this at it and regenerate.
const serifBoldItalic = extract(path.join(ROOT, 'public/fonts/LiberationSerif-Bold.ttf'));

const banner = `/**
 * GENERATED FILE — do not edit by hand.
 * Source: scripts/generate-font-metrics.mjs reading public/fonts TTFs.
 * Liberation Serif == Times New Roman metrics, Liberation Mono == Courier New.
 * Values are advance widths as fractions of one em.
 *
 * SERIF_BOLD_ITALIC_EM_WIDTHS: no Liberation Serif Bold Italic TTF ships in
 * public/fonts, so this is extracted from LiberationSerif-Bold.ttf (the
 * closest available metrics to pdf-lib's TimesRomanBoldItalic paint font -
 * see generate-font-metrics.mjs's comment for why weight matters more than
 * slant here). Point this at a true Bold Italic TTF and regenerate if one is
 * added.
 */
`;

const body =
  banner +
  `export const SERIF_EM_WIDTHS: Record<string, number> = ${JSON.stringify(serif, null, 2)};\n\n` +
  `export const SERIF_BOLD_ITALIC_EM_WIDTHS: Record<string, number> = ${JSON.stringify(serifBoldItalic, null, 2)};\n\n` +
  `export const MONO_EM_WIDTHS: Record<string, number> = ${JSON.stringify(mono, null, 2)};\n`;

writeFileSync(path.join(ROOT, 'src/lib/font-metrics.ts'), body);
console.log('Wrote src/lib/font-metrics.ts');
console.log('Serif spot checks: 1=%s .=%s a=%s (=%s A=%s M=%s', serif['1'], serif['.'], serif['a'], serif['('], serif['A'], serif['M']);
console.log('Serif bold-italic spot checks: 1=%s a=%s A=%s M=%s', serifBoldItalic['1'], serifBoldItalic['a'], serifBoldItalic['A'], serifBoldItalic['M']);
console.log('Mono spot check (equal expected): 1=%s m=%s', mono['1'], mono['m']);
