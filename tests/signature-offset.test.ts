/**
 * Signature placement — 4th line below the last line of text
 * (SECNAV M-5216.5 7-2.16: three blank lines, signature on the fourth).
 * Regression for the defect where a trailing body spacer plus the
 * signature block's three blank lines put the signature on the 5th line.
 */
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/pdf-fonts', () => import('./golden/pdf-fonts-mock'));

import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { generateDocxBlob } from '@/lib/docx-generator';
import { extractPdfTextLayout } from './golden/helpers';
import { LINE_HEIGHT_12PT } from '@/lib/pdf-settings';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_PARAGRAPHS,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
} from './golden/fixture';

const args = [
  FIXTURE_FORM_DATA, FIXTURE_VIAS, FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES, FIXTURE_COPY_TOS, FIXTURE_PARAGRAPHS, [],
] satisfies Parameters<typeof generateDocxBlob>;

describe('DOCX signature offset', () => {
  it('exactly three blank lines between last body text and the signature', async () => {
    const blob = await generateDocxBlob(...args);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');

    const paras = xml.match(/<w:p\b.*?<\/w:p>|<w:p\b[^>]*\/>/gs) ?? [];
    const sigIdx = paras.findIndex((p) => p.includes('I. M. MARINE'));
    expect(sigIdx).toBeGreaterThan(0);
    // Walk back from the signature: the three immediately preceding
    // paragraphs are blank, the fourth carries text.
    for (let k = 1; k <= 3; k++) {
      expect(/<w:t[ >]/.test(paras[sigIdx - k]), `paragraph ${k} above sig must be blank`).toBe(false);
    }
    expect(/<w:t[ >]/.test(paras[sigIdx - 4]), '4th paragraph above sig must be text').toBe(true);
  });
});

describe('PDF signature offset', () => {
  it('signature baseline sits four lines below the last body baseline', async () => {
    const blob = await generateBasePDFBlob(...args);
    const layout = await extractPdfTextLayout(blob);
    const page1 = layout.filter((i) => i.page === 1);
    const sig = page1.find((i) => i.text.includes('I. M. MARINE'));
    expect(sig).toBeDefined();
    // Last body line: lowest-y text item above the signature.
    const above = page1.filter((i) => i.y > sig!.y && !i.text.includes('I. M. MARINE'));
    const lastBody = above.sort((a, b) => a.y - b.y)[0];
    const gap = lastBody.y - sig!.y;
    expect(gap).toBeGreaterThanOrEqual(4 * LINE_HEIGHT_12PT - 2);
    expect(gap).toBeLessThanOrEqual(4 * LINE_HEIGHT_12PT + 2);
  }, 30000);
});
