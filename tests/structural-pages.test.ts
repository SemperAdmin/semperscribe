/**
 * P4.1 — directive structural pages and roman-numeral cascade
 * (MCO 5215.1K para 48; plan Phase 4 item 1).
 *
 * Locator Sheet / Record of Changes / Table of Contents render as
 * separate pages with roman footers i, ii, iii; the numbering
 * CASCADES over the pages actually enabled (no gaps when one is
 * absent). The PDF carried these since baseline; P4.1 builds the
 * DOCX sections to parity (sectPr per page, static roman footer).
 */
import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';

vi.mock('@/lib/pdf-fonts', () => import('./golden/pdf-fonts-mock'));

import { generateDocxBlob } from '@/lib/docx-generator';
import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { extractPdfTextLayout } from './golden/helpers';
import { FIXTURE_FORM_DATA } from './golden/fixture';

const BODY = [
  { id: 1, level: 1, title: 'Situation', content: 'Body paragraph one.' },
  { id: 2, level: 1, title: 'Mission', content: 'Body paragraph two.' },
] as never[];

function mcoForm(extra: Record<string, unknown> = {}) {
  return {
    ...FIXTURE_FORM_DATA,
    documentType: 'mco', ssic: '5215.1K', orderPrefix: 'MCO',
    date: '10 Feb 26', sig: 'I. M. MARINE', subj: 'FIXTURE ORDER SUBJECT',
    showLocatorSheet: true, showRecordOfChanges: true, showStructuralPages: true,
    ...extra,
  } as never;
}

describe('PDF structural pages (pre-existing, pinned)', () => {
  it('all three pages carry cascading roman footers i, ii, iii', async () => {
    const blob = await generateBasePDFBlob(mcoForm(), [], [], ['Procedural Guidance'], [], BODY, []);
    const layout = await extractPdfTextLayout(blob);
    const footer = (page: number) =>
      layout.find((i) => i.page === page && i.y < 60 && /^(i|ii|iii|iv|v)$/.test(i.text.trim()))?.text.trim();
    const locatorPage = layout.find((i) => i.text.includes('LOCATOR'))!.page;
    const rocPage = layout.find((i) => i.text.includes('RECORD'))!.page;
    const tocPage = layout.find((i) => i.text.includes('CONTENTS'))!.page;
    expect(footer(locatorPage), 'locator').toBe('i');
    expect(footer(rocPage), 'record of changes').toBe('ii');
    expect(footer(tocPage), 'toc').toBe('iii');
  });

  it('cascade renumbers when the locator sheet is absent', async () => {
    const blob = await generateBasePDFBlob(
      mcoForm({ showLocatorSheet: false }), [], [], [], [], BODY, []);
    const layout = await extractPdfTextLayout(blob);
    expect(layout.some((i) => i.text.includes('LOCATOR'))).toBe(false);
    const rocPage = layout.find((i) => i.text.includes('RECORD'))!.page;
    const footer = layout.find((i) => i.page === rocPage && i.y < 60 && /^(i|ii)$/.test(i.text.trim()));
    expect(footer?.text.trim(), 'RoC takes i when locator absent').toBe('i');
  });
});

describe('DOCX structural pages (P4.1 parity build)', () => {
  async function unzip(form: never) {
    const blob = await generateDocxBlob(form, [], [], ['Procedural Guidance'], [], BODY, []);
    return JSZip.loadAsync(await blob.arrayBuffer());
  }

  it('emits four sections: main + locator + RoC + TOC', async () => {
    const zip = await unzip(mcoForm());
    const doc = await zip.file('word/document.xml')!.async('string');
    const sects = doc.match(/<w:sectPr/g) ?? [];
    expect(sects.length).toBe(4);
    expect(doc).toContain('LOCATOR SHEET');
    expect(doc).toContain('RECORD OF CHANGES');
    expect(doc).toContain('TABLE OF CONTENTS');
  });

  it('structural footers carry static romans i, ii, iii', async () => {
    const zip = await unzip(mcoForm());
    const footers = await Promise.all(
      zip.file(/word\/footer\d+\.xml/).map((f) => f.async('string')));
    const text = (x: string) => (x.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
      .map((t) => t.replace(/<[^>]+>/g, '')).join('');
    const labels = footers.map(text);
    for (const roman of ['i', 'ii', 'iii']) {
      expect(labels.some((l) => l === roman), `footer ${roman}`).toBe(true);
    }
  });

  it('cascade renumbers in DOCX when the locator sheet is absent', async () => {
    const zip = await unzip(mcoForm({ showLocatorSheet: false }));
    const doc = await zip.file('word/document.xml')!.async('string');
    expect(doc.includes('LOCATOR SHEET')).toBe(false);
    const footers = await Promise.all(
      zip.file(/word\/footer\d+\.xml/).map((f) => f.async('string')));
    const text = (x: string) => (x.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? [])
      .map((t) => t.replace(/<[^>]+>/g, '')).join('');
    const labels = footers.map(text);
    expect(labels.some((l) => l === 'i'), 'RoC takes i').toBe(true);
    expect(labels.some((l) => l === 'iii'), 'no iii with two pages').toBe(false);
  });

  it('locator content mirrors the PDF: designation, date, Subj, Location line', async () => {
    const zip = await unzip(mcoForm());
    const doc = await zip.file('word/document.xml')!.async('string');
    const locator = doc.slice(doc.indexOf('LOCATOR SHEET') - 2000, doc.indexOf('Location:'));
    expect(locator).toContain('MCO 5215.1K');
    expect(locator).toContain('10 Feb 26');
    expect(doc).toContain('FIXTURE ORDER SUBJECT');
    expect(doc).toContain('(Indicate the location(s) of the copy(ies) of this Order.)');
    // No literal escape leak from the template strings.
    expect(doc.includes('\\u00A0')).toBe(false);
  });

  it('TOC lists numbered level-1 titles and enclosures', async () => {
    const zip = await unzip(mcoForm());
    const doc = await zip.file('word/document.xml')!.async('string');
    const toc = doc.slice(doc.indexOf('TABLE OF CONTENTS'));
    expect(toc).toContain('Situation');
    expect(toc).toContain('Mission');
    expect(toc).toContain('Procedural Guidance');
  });
});
