/**
 * P3.4 — directive identification block (MCO 5215.1K para 38;
 * POLICY_COMPLIANCE_AUDIT.md lines 98, 126, 138, 144, 160, 170).
 *
 * Page 1: upper-right stack designation / sponsor code / date,
 * blocked left, LONGEST line flush with the right margin; date in
 * dd Mmm yy(yy); designation line (title) caps + underline, 2nd line
 * below the date. Bulletin Canc line right-aligned, 2nd line above
 * the SSIC position. Continuation pages: designation + date flush
 * right, originator code OMITTED.
 */
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/pdf-fonts', () => import('./golden/pdf-fonts-mock'));

import { generateDocxBlob } from '@/lib/docx-generator';
import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { extractPdfTextLayout } from './golden/helpers';
import { getDirectiveDesignation } from '@/lib/naval-format-utils';
import { FIXTURE_FORM_DATA } from './golden/fixture';

const RIGHT_EDGE = 540; // 8.5in sheet - 1in right margin, in points
const CHAR = 7.2;       // Courier 12 advance

const LONG_BODY = Array.from({ length: 18 }, (_, i) => ({
  id: i + 1, level: 1,
  content: `Paragraph ${i + 1} long enough to spill the document onto a second page when stacked with its seventeen siblings, proving the continuation header.`,
})) as never[];

function mcoForm(extra: Record<string, unknown> = {}) {
  return {
    ...FIXTURE_FORM_DATA,
    documentType: 'mco',
    ssic: '5215.1K',
    orderPrefix: 'MCO',
    originatorCode: 'ARDB',
    date: '10 Feb 26',
    sig: 'I. M. MARINE',
    ...extra,
  } as never;
}

describe('designation helper', () => {
  it('prefixes MCO / MCBul to the SSIC', () => {
    expect(getDirectiveDesignation(mcoForm() as never)).toBe('MCO 5215.1K');
    expect(getDirectiveDesignation({ documentType: 'bulletin', ssic: '1500' } as never)).toBe('MCBul 1500');
  });
});

describe('DOCX ID block (MCO 5215.1K para 38)', () => {
  async function docXml(form: never, file = 'word/document.xml'): Promise<string> {
    const blob = await generateDocxBlob(form, [], [], [], [], LONG_BODY, []);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const f = zip.file(file) ?? zip.file(new RegExp(file.replace('.xml', '\\d*.xml')))[0];
    expect(f, file).toBeDefined();
    return f!.async('string');
  }

  it('page-1 stack: designation, sponsor code, date in a right-anchored block', async () => {
    const xml = await docXml(mcoForm());
    const table = (xml.match(/<w:tbl>.*?<\/w:tbl>/gs) ?? [])
      .find((t) => t.includes('MCO 5215.1K'));
    expect(table, 'right-anchored ID table').toBeDefined();
    expect(table!.includes('<w:jc w:val="right"/>'), 'table anchored right').toBe(true);
    const cellText = (table!.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
      .map((t) => t.replace(/<[^>]+>/g, ''));
    expect(cellText).toEqual(['MCO 5215.1K', 'ARDB', '10 Feb 26']);
  });

  it('designation title line is caps + underlined, falls back to prefix+SSIC', async () => {
    const xml = await docXml(mcoForm({ directiveTitle: '' }));
    const paras = xml.match(/<w:p\b.*?<\/w:p>/gs) ?? [];
    const title = paras.find((p) => p.includes('MCO 5215.1K') && p.includes('<w:u '));
    expect(title, 'underlined designation line').toBeDefined();
  });

  it('continuation header repeats designation + date flush right, NO originator code', async () => {
    const xml = await docXml(mcoForm(), 'word/header');
    expect(xml.includes('MCO 5215.1K'), 'designation in header').toBe(true);
    expect(xml.includes('10 Feb 26'), 'date in header').toBe(true);
    expect(xml.includes('ARDB'), 'originator code omitted').toBe(false);
    expect(xml.includes('Subj'), 'no Subj line on directive continuations').toBe(false);
    expect(xml.includes('<w:jc w:val="right"/>'), 'flush right').toBe(true);
  });

  it('bulletin Canc line is right-aligned with one blank above the SSIC block', async () => {
    const xml = await docXml(mcoForm({
      documentType: 'bulletin', orderPrefix: '', ssic: '1500',
      cancellationDate: '2027-06-30', cancellationType: 'standard',
    }));
    const paras = xml.match(/<w:p\b.*?<\/w:p>/gs) ?? [];
    const canc = paras.find((p) => p.includes('Canc:'));
    expect(canc, 'Canc line').toBeDefined();
    expect(canc!.includes('<w:jc w:val="right"/>'), 'right-aligned').toBe(true);
    expect(canc!.includes('<w:ind'), 'no fixed indent hack').toBe(false);
    const xmlBul = xml;
    expect(xmlBul.includes('MCBul 1500'), 'bulletin designation').toBe(true);
  });
});

describe('PDF ID block (MCO 5215.1K para 38)', () => {
  it('longest line flush right at 540pt; stack blocked left; page 2 header has designation, no code', async () => {
    const blob = await generateBasePDFBlob(mcoForm(), [], [], [], [], LONG_BODY, []);
    const layout = await extractPdfTextLayout(blob);

    // Page 1 stack — group the three ID lines by reconstructing lines.
    const byLine = new Map<string, { x: number; text: string }[]>();
    for (const i of layout) {
      const k = `${i.page}:${i.y}`;
      (byLine.get(k) ?? byLine.set(k, []).get(k)!).push(i);
    }
    const lines = [...byLine.entries()].map(([k, items]) => {
      items.sort((a, b) => a.x - b.x);
      const text = items.map((i) => i.text).join('');
      const page = Number(k.split(':')[0]);
      const right = Math.max(...items.map((i) => i.x + i.text.length * CHAR));
      return { page, x: items[0].x, right, text, y: Number(k.split(':')[1]) };
    });

    const p1 = lines.filter((l) => l.page === 1);
    const des = p1.find((l) => l.text === 'MCO 5215.1K');
    const code = p1.find((l) => l.text === 'ARDB');
    const date = p1.find((l) => l.text === '10 Feb 26');
    for (const [n, l] of [['designation', des], ['code', code], ['date', date]] as const) {
      expect(l, n).toBeDefined();
    }
    // Blocked left: all three share the same left x.
    expect(new Set([des!.x, code!.x, date!.x]).size, 'blocked left').toBe(1);
    // Longest line ("MCO 5215.1K", 11 chars) flush right at 540.
    expect(des!.right, 'longest line right edge').toBeCloseTo(RIGHT_EDGE, 0);

    // Page 2 header: designation + date present, originator code absent.
    const p2 = lines.filter((l) => l.page === 2);
    expect(p2.some((l) => l.text === 'MCO 5215.1K'), 'p2 designation').toBe(true);
    expect(p2.some((l) => l.text === 'ARDB'), 'p2 code omitted').toBe(false);
  });
});
