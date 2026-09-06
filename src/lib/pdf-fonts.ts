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

  // Liberation Mono (Courier New equivalent)
  Font.register({
    family: 'Liberation Mono',
    fonts: [
      { src: getFullFontUrl('/fonts/LiberationMono-Regular.ttf'), fontWeight: 'normal' },
      // Fallback for missing Bold/Italic fonts
      { src: getFullFontUrl('/fonts/LiberationMono-Regular.ttf'), fontWeight: 'bold' },
      { src: getFullFontUrl('/fonts/LiberationMono-Regular.ttf'), fontWeight: 'normal', fontStyle: 'italic' },
      { src: getFullFontUrl('/fonts/LiberationMono-Regular.ttf'), fontWeight: 'bold', fontStyle: 'italic' },
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
