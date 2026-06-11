/**
 * P3.7 — Reports Required rule (MCO 5216.20B par. 29b/29c; audit
 * line 142): up to 4 reports list in the heading block on the
 * promulgation page; 5 or more move to a dedicated Reports Required
 * page immediately after the signature page, with a referral line in
 * the heading block.
 */
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/pdf-fonts', () => import('./golden/pdf-fonts-mock'));

import { generateDocxBlob } from '@/lib/docx-generator';
import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { extractPdfTextLayout } from './golden/helpers';
import { FIXTURE_FORM_DATA } from './golden/fixture';

const report = (n: number) => ({
  id: String(n), title: `Report Number ${n}`, controlSymbol: `MC-${n}`, paragraphRef: `${n}a`,
});

function mcoForm(reportCount: number) {
  return {
    ...FIXTURE_FORM_DATA,
    documentType: 'mco', ssic: '5215.1K', orderPrefix: 'MCO', sig: 'I. M. MARINE',
    reports: Array.from({ length: reportCount }, (_, i) => report(i + 1)),
  } as never;
}

const BODY = [{ id: 1, level: 1, content: 'Situation. Body paragraph.' }] as never[];

async function docxTexts(form: never): Promise<string[]> {
  const blob = await generateDocxBlob(form, [], [], [], [], BODY, []);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml')!.async('string');
  return (xml.match(/<w:p\b.*?<\/w:p>/gs) ?? []).map((p) =>
    (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join(''));
}

describe('DOCX reports placement (MCO 5216.20B par. 29b/29c)', () => {
  it('4 reports list in the heading block BEFORE paragraph 1', async () => {
    const texts = await docxTexts(mcoForm(4));
    const firstReport = texts.findIndex((t) => t.includes('Reports Required:'));
    const body = texts.findIndex((t) => t.includes('Situation. Body'));
    const sig = texts.findIndex((t) => t === 'I. M. MARINE');
    expect(firstReport, 'reports in heading block').toBeGreaterThan(-1);
    expect(firstReport).toBeLessThan(body);
    expect(texts.filter((t) => t.includes('Report Number')).length).toBe(4);
    expect(sig).toBeGreaterThan(body);
  });

  it('a single report uses the singular label, no numerals', async () => {
    const texts = await docxTexts(mcoForm(1));
    const line = texts.find((t) => t.includes('Report Required:'));
    expect(line).toBeDefined();
    expect(line!.includes('I.')).toBe(false);
  });

  it('5 reports: heading referral + dedicated page after the signature', async () => {
    const form = mcoForm(5);
    const blob = await generateDocxBlob(form, [], [], [], [], BODY, []);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const xml = await zip.file('word/document.xml')!.async('string');
    const paras = xml.match(/<w:p\b.*?<\/w:p>/gs) ?? [];
    const texts = paras.map((p) =>
      (p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, '')).join(''));

    const referral = texts.findIndex((t) => t === 'Reports Required: See page following signature page.');
    const body = texts.findIndex((t) => t.includes('Situation. Body'));
    const sig = texts.findIndex((t) => t === 'I. M. MARINE');
    const pageTitle = texts.findIndex((t) => t === 'Reports Required');
    expect(referral, 'referral line in heading').toBeGreaterThan(-1);
    expect(referral).toBeLessThan(body);
    // No report list in the heading block.
    expect(texts.slice(0, body).some((t) => t.includes('Report Number'))).toBe(false);
    // Dedicated page comes after the signature, starts on a new page.
    expect(pageTitle).toBeGreaterThan(sig);
    expect(paras[pageTitle].includes('<w:pageBreakBefore/>'), 'page break before title').toBe(true);
    // All five rows present with column headers.
    expect(texts.slice(pageTitle).some((t) => t.includes('REPORT TITLE'))).toBe(true);
    expect(texts.slice(pageTitle).filter((t) => t.includes('Report Number')).length).toBe(5);
  });
});

describe('PDF reports page (MCO 5216.20B par. 29c)', () => {
  it('5 reports produce a final page with title, columns, and all rows', async () => {
    const blob = await generateBasePDFBlob(mcoForm(5), [], [], [], [], BODY, []);
    const layout = await extractPdfTextLayout(blob);
    const lastPage = Math.max(...layout.map((i) => i.page));
    const onLast = layout.filter((i) => i.page === lastPage);
    // pdfjs splits per word: reconstruct lines to find the signature.
    const lineItems = new Map<string, { x: number; text: string }[]>();
    for (const i of layout) {
      const k = `${i.page}:${i.y}`;
      (lineItems.get(k) ?? lineItems.set(k, []).get(k)!).push({ x: i.x, text: i.text });
    }
    const sigKey = [...lineItems.entries()]
      .find(([, items]) => items
        .sort((a, b) => a.x - b.x)
        .map((i) => i.text)
        .join('')
        .replace(/\s+/g, ' ')
        .includes('I. M. MARINE'))?.[0];
    expect(sigKey, 'signature line').toBeDefined();
    const sigPage = Number(sigKey!.split(':')[0]);
    expect(lastPage, 'reports page follows signature page').toBe(sigPage + 1);
    // pdfjs splits per word: assemble the page text per line (sorted
    // by y desc then x) and assert on the joined text.
    const pageText = [...lineItems.entries()]
      .filter(([k]) => Number(k.split(':')[0]) === lastPage)
      .map(([, items]) => items.sort((a, b) => a.x - b.x).map((i) => i.text).join(''))
      .join('\n')
      .replace(/[\u00A0 ]+/g, ' ');
    expect(pageText).toContain('Reports Required');
    expect(pageText).toContain('REPORT TITLE');
    expect(pageText).toContain('CONTROL SYMBOL');
    expect(pageText).toContain('PARAGRAPH');
    for (let n = 1; n <= 5; n++) {
      expect(pageText, `row ${n}`).toContain(`Report Number ${n}`);
    }
  });
});
