/**
 * The pdfjs worker vendored in public/ must be byte-identical to the
 * worker shipped by the installed pdfjs-dist — a version drift would
 * break PDF import/preview at runtime with an API-mismatch error.
 * If this fails after a pdfjs-dist bump, re-copy the file:
 *   cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import path from 'path';

const sha256 = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');

describe('vendored pdfjs worker', () => {
  it('matches the installed pdfjs-dist worker byte-for-byte', () => {
    const vendored = path.join(__dirname, '..', 'public', 'pdf.worker.min.mjs');
    const installed = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
    expect(sha256(vendored)).toBe(sha256(installed));
  });
});
