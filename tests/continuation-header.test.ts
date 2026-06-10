/**
 * S3 — continuation-page header geometry (audit gap G3 companion).
 *
 * M-5216.5 (audit line 46): continuation pages repeat the Subj line
 * starting on the 6th line from the page top; body text resumes on the
 * 2nd line below it. At 6 lines per inch on a LETTER page:
 *   Subj top   = 5/6 in = 60pt from the page top edge
 *   body top   = 7/6 in = 84pt from the page top edge
 * pdfjs reports baseline-origin y from the BOTTOM edge (792pt page).
 */
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/pdf-fonts', () => import('./golden/pdf-fonts-mock'));

import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { generateDocxBlob } from '@/lib/docx-generator';
import { extractPdfTextLayout } from './golden/helpers';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
  PARITY_PARAGRAPHS,
} from './golden/fixture';

describe('PDF continuation header (page 2+)', () => {
  it('Subj sits on the 6th line and body resumes on the 8th', async () => {
    const blob = await generateBasePDFBlob(
      FIXTURE_FORM_DATA, FIXTURE_VIAS, FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES, FIXTURE_COPY_TOS, PARITY_PARAGRAPHS, [],
    );
    const layout = await extractPdfTextLayout(blob);
    const page2 = layout.filter((i) => i.page === 2);
    expect(page2.length).toBeGreaterThan(0);

    const subj = page2.find((i) => i.text.startsWith('Subj'));
    expect(subj, 'Subj label must repeat on page 2').toBeDefined();
    // Top-edge distance = 792 - y - ascent; with 12pt type the baseline
    // sits ~9.4pt below the line top. Line 6 top = 60pt → y ≈ 722.6.
    const subjTopDistance = 792 - subj!.y;
    expect(subjTopDistance).toBeGreaterThanOrEqual(60);
    expect(subjTopDistance).toBeLessThanOrEqual(72); // within line 6

    // First body item below the subj group: highest y below subj line.
    const body = page2
      .filter((i) => !i.text.startsWith('Subj') && i.y < subj!.y - 6)
      .sort((a, b) => b.y - a.y)[0];
    expect(body, 'body text must exist on page 2').toBeDefined();
    const bodyTopDistance = 792 - body!.y;
    expect(bodyTopDistance).toBeGreaterThanOrEqual(84);
    expect(bodyTopDistance).toBeLessThanOrEqual(96); // within line 8
  }, 60000);
});

describe('DOCX continuation header (default header part)', () => {
  it('carries two spacer lines before Subj and one after; header at 720 twips', async () => {
    const blob = await generateDocxBlob(
      FIXTURE_FORM_DATA, FIXTURE_VIAS, FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES, FIXTURE_COPY_TOS, PARITY_PARAGRAPHS, [],
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());

    const docXml = await zip.file('word/document.xml')!.async('string');
    expect(docXml.includes('w:header="720"')).toBe(true);

    // Find the header part containing the Subj line.
    const headerNames = Object.keys(zip.files).filter((n) => /^word\/header\d+\.xml$/.test(n));
    let subjHeader: string | null = null;
    for (const name of headerNames) {
      const xml = await zip.file(name)!.async('string');
      if (xml.includes('Subj:')) { subjHeader = xml; break; }
    }
    expect(subjHeader, 'a header part must contain the Subj line').toBeTruthy();

    const paras = subjHeader!.match(/<w:p\b.*?<\/w:p>|<w:p\b[^>]*\/>/gs) ?? [];
    const subjIdx = paras.findIndex((p) => p.includes('Subj:'));
    expect(subjIdx, 'two full blank lines precede Subj (6th-line rule)').toBe(2);
    for (let i = 0; i < 2; i++) {
      expect(/<w:t[ >]/.test(paras[i]), `spacer ${i} must be empty`).toBe(false);
      expect(/<w:sz w:val="24"\/>/.test(paras[i]), `spacer ${i} must be a 12pt line`).toBe(true);
    }
    // One blank line after the subject group (text resumes 2nd line below).
    const after = paras.slice(subjIdx + 1);
    expect(after.length).toBeGreaterThanOrEqual(1);
    expect(/<w:t[ >]/.test(after[after.length - 1])).toBe(false);
  }, 60000);
});
