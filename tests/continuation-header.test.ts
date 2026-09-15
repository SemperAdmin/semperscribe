// @vitest-environment node
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
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';

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

/**
 * Directive continuation pages (MCO 5215.1K para 38; user report
 * 2026-09-15).
 *
 * The ID stack repeats flush right one inch from the page top,
 * designation then date, originator code omitted. Body text resumes on
 * the 2nd line below the date, the same rule the naval Subj header
 * above follows and the same thing the DOCX header's trailing blank
 * paragraph produces in Word.
 *
 * The reported symptom was the date printing THROUGH the first body
 * line on every page past the first. The body spacer was a flat 48pt
 * inherited from the civilian branch, which put body text 92pt from the
 * page top while the two Courier header lines run to 72 + 2 x 13.59 =
 * 99.18pt. Absolute grid position on one side, a different line metric
 * on the other, and they met about 7pt short.
 */
describe('PDF directive continuation header (page 2+)', () => {
  const LINE_COURIER = 13.59;

  /** One row per baseline: Courier output emits a run per word. */
  function rows(items: Awaited<ReturnType<typeof extractPdfTextLayout>>, page: number) {
    const byY = new Map<number, string>();
    for (const i of items.filter((x) => x.page === page)) {
      byY.set(i.y, (byY.get(i.y) ?? '') + i.text);
    }
    return [...byY.entries()].sort((a, b) => b[0] - a[0]);
  }

  it('body resumes on the 2nd line below the date, never on top of it', async () => {
    const LONG = Array.from({ length: 22 }, (_, i) => ({
      id: i + 1, level: 1, title: '', content: `Body paragraph ${i + 1}. ` + 'Filler to paginate. '.repeat(6),
    }));
    const blob = await generateBasePDFBlob(
      {
        ...FIXTURE_FORM_DATA, documentType: 'mco', orderPrefix: 'MCO',
        ssic: '5215.1K', date: '15 Sep 26', sig: 'I. M. MARINE',
        subj: 'CONTINUATION GEOMETRY FIXTURE',
      } as never,
      [], [], [], [], LONG as never[], [],
    );
    const layout = await extractPdfTextLayout(blob);
    expect(Math.max(...layout.map((i) => i.page)), 'fixture must paginate').toBeGreaterThan(1);

    const page2 = rows(layout, 2);
    // The stack sits 1 inch from the page top: first baseline one
    // ascent below 72pt (Liberation Mono ascent at 12pt = 9.99pt).
    const [designationY, designationText] = page2[0];
    const [dateY, dateText] = page2[1];
    expect(designationText, 'designation repeats').toContain('5215.1K');
    expect(dateText.replace(/ /g, ' '), 'date repeats').toContain('15 Sep 26');
    expect(792 - designationY, 'stack top at 1 inch').toBeCloseTo(72 + 9.99, 0);
    expect(designationY - dateY, 'date on the next line').toBeCloseTo(LINE_COURIER, 1);

    const [bodyY, bodyText] = page2[2];
    expect(bodyText, 'body follows the header').toMatch(/Body paragraph/);
    // Two lines, to within a point. The exact sub-point lands a little
    // differently depending on whether the break falls between
    // paragraphs or inside a wrapped one, so this is deliberately not
    // pinned tighter than the rule it is testing.
    const gap = dateY - bodyY;
    expect(gap, 'body on the 2nd line below the date')
      .toBeGreaterThan(2 * LINE_COURIER - 1);
    expect(gap, 'body no further than the 2nd line below')
      .toBeLessThan(2 * LINE_COURIER + 1);
    // The reported defect, stated plainly: the date line is clear of the
    // body by a full line. At the old 48pt spacer this measured 6.4pt
    // and the two printed over each other.
    expect(gap, 'date line not overprinted by body text').toBeGreaterThan(LINE_COURIER);
  }, 60000);
});
