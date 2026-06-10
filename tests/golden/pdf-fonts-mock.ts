/**
 * Test-only replacement for src/lib/pdf-fonts.ts.
 *
 * The production module builds font URLs from window.location, which does
 * not resolve under vitest/jsdom. This mock registers the same Liberation
 * font families from local files in public/fonts so the PDF pipeline
 * produces identical metrics to the browser. All other exports mirror the
 * production module exactly.
 */
import path from 'path';
import { Font } from '@react-pdf/renderer';

const FONT_DIR = path.resolve(__dirname, '../../public/fonts');
const f = (name: string) => path.join(FONT_DIR, name);

export function getFullFontUrl(fontPath: string): string {
  return f(path.basename(fontPath));
}

export function registerPDFFonts() {
  Font.register({
    family: 'Liberation Serif',
    fonts: [
      { src: f('LiberationSerif-Regular.ttf'), fontWeight: 'normal' },
      { src: f('LiberationSerif-Bold.ttf'), fontWeight: 'bold' },
      { src: f('LiberationSerif-Regular.ttf'), fontWeight: 'normal', fontStyle: 'italic' },
      { src: f('LiberationSerif-Bold.ttf'), fontWeight: 'bold', fontStyle: 'italic' },
    ],
  });
  Font.register({
    family: 'Liberation Mono',
    fonts: [
      { src: f('LiberationMono-Regular.ttf'), fontWeight: 'normal' },
      { src: f('LiberationMono-Regular.ttf'), fontWeight: 'bold' },
      { src: f('LiberationMono-Regular.ttf'), fontWeight: 'normal', fontStyle: 'italic' },
      { src: f('LiberationMono-Regular.ttf'), fontWeight: 'bold', fontStyle: 'italic' },
    ],
  });

  // Disable hyphenation to match Word behavior (mirrors production)
  Font.registerHyphenationCallback((word: string) => [word]);
}

export function getPDFBodyFont(bodyFont: 'times' | 'courier'): string {
  return bodyFont === 'courier' ? 'Liberation Mono' : 'Liberation Serif';
}

export const PDF_FONTS = {
  SERIF: 'Liberation Serif',
  MONO: 'Liberation Mono',
} as const;
