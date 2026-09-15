import { Font } from '@react-pdf/renderer';
import { resolveAssetPath } from '@/lib/assets';

/**
 * Where @react-pdf reads a font from: the absolute URL in the browser,
 * or a file path under a registered asset path resolver (tests, the
 * headless companion). See src/lib/assets.ts.
 */
export function getFullFontUrl(fontPath: string): string {
  return resolveAssetPath(fontPath);
}

/**
 * Register Liberation fonts for PDF generation
 * Liberation fonts are metrically compatible with Times New Roman and Courier New
 *
 * - Liberation Serif → Times New Roman equivalent
 * - Liberation Mono → Courier New equivalent
 */
export function registerPDFFonts() {
  // Liberation Serif (Times New Roman equivalent)
  Font.register({
    family: 'Liberation Serif',
    fonts: [
      { src: getFullFontUrl('/fonts/LiberationSerif-Regular.ttf'), fontWeight: 'normal' },
      { src: getFullFontUrl('/fonts/LiberationSerif-Bold.ttf'), fontWeight: 'bold' },
      // Fallback for missing Italic fonts to prevent runtime errors
      { src: getFullFontUrl('/fonts/LiberationSerif-Regular.ttf'), fontWeight: 'normal', fontStyle: 'italic' },
      { src: getFullFontUrl('/fonts/LiberationSerif-Bold.ttf'), fontWeight: 'bold', fontStyle: 'italic' },
    ],
  });

  // Liberation Mono (Courier New equivalent).
  //
  // The bold face is a REAL bold. It used to point at the Regular file,
  // because only three Liberation files shipped (docs/pdf-export-plan.md
  // lists them), so every `fontWeight: 'bold'` in a Courier document -
  // the letterhead department line M-5216.5 App C requires in bold, the
  // classification banner, any bold heading - rendered at normal weight
  // in the preview while Word, which has the real Courier New Bold, set
  // them bold. The two surfaces disagreed and only the preview was
  // wrong. Italics are still the Regular file: Liberation ships italic
  // faces, but M-5216.5 2-2.20 admits italics for occasional emphasis
  // only and nothing in the emitters asks for one yet.
  Font.register({
    family: 'Liberation Mono',
    fonts: [
      { src: getFullFontUrl('/fonts/LiberationMono-Regular.ttf'), fontWeight: 'normal' },
      { src: getFullFontUrl('/fonts/LiberationMono-Bold.ttf'), fontWeight: 'bold' },
      // Fallback for the italic faces, which are not shipped.
      { src: getFullFontUrl('/fonts/LiberationMono-Regular.ttf'), fontWeight: 'normal', fontStyle: 'italic' },
      { src: getFullFontUrl('/fonts/LiberationMono-Bold.ttf'), fontWeight: 'bold', fontStyle: 'italic' },
    ],
  });

  // Disable hyphenation to match Word behavior
  Font.registerHyphenationCallback((word) => [word]);
}

/**
 * Get the PDF font family name based on the body font setting
 */
export function getPDFBodyFont(bodyFont: 'times' | 'courier'): string {
  return bodyFont === 'courier' ? 'Liberation Mono' : 'Liberation Serif';
}

/**
 * PDF font family constants
 */
export const PDF_FONTS = {
  SERIF: 'Liberation Serif',
  MONO: 'Liberation Mono',
} as const;
