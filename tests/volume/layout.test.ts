// tests/volume/layout.test.ts
import { describe, it, expect } from 'vitest';
import { layoutVolume, BOTTOM_Y, type TableItem } from '@/lib/volume/layout';
import { blankVolume } from '@/store/volumeStore';
import { generateVolumePdf } from '@/services/pdf/volumeGenerator';

function sampleDoc() {
  const d = blankVolume();
  d.order = { designator: 'MCO 5800.16', policyTitle: 'LEGAL SUPPORT AND ADMINISTRATION MANUAL', sponsorCode: 'JA' };
  d.volume = { ...d.volume, number: 6, title: 'INTERNATIONAL AND OPERATIONAL LAW', originalPublicationDate: '2018-02-20', lastUpdatedDate: '2018-02-20' };
  d.chapters = [{
    number: 1, title: 'INTERNATIONAL AND OPERATIONAL LAW', changeLog: [], figures: [],
    sections: [
      { seq: 1, title: 'PURPOSE', body: [{ runs: [{ text: 'This Volume promulgates policy.' }] }], paragraphs: [] },
    ],
  }];
  return d;
}

describe('layoutVolume', () => {
  it('produces front matter, then body pages', () => {
    const out = layoutVolume(sampleDoc());
    expect(out.pages.some(p => p.band === 'front')).toBe(true);
    expect(out.pages.some(p => p.band === 'body')).toBe(true);
  });
  it('emits a TOC entry for the section', () => {
    const out = layoutVolume(sampleDoc());
    expect(out.toc.find(e => e.label.includes('PURPOSE'))).toBeTruthy();
  });
  it('numbers a single-chapter body page sequentially', () => {
    const out = layoutVolume(sampleDoc());
    const body = out.pages.filter(p => p.band === 'body');
    expect(body[0].label).toMatch(/^\d+$/);
  });

  // Finding 1: `body` and `paragraphs` are not mutually exclusive in the
  // schema; a section carrying both used to render only one (an if/else
  // silently dropped the other), even though the editor lets an author add
  // both to the same section.
  it('renders both a section body block AND its numbered paragraph (finding 1)', () => {
    const d = sampleDoc();
    d.chapters[0].sections[0].paragraphs = [
      { seq: 1, title: '', body: [{ runs: [{ text: 'The paragraph text.' }] }], children: [] },
    ];
    const out = layoutVolume(d);
    const allText = out.pages
      .flatMap(p => p.items)
      .flatMap(i => ('segments' in i ? i.segments.map(s => s.text) : []))
      .join('');
    expect(allText).toContain('This Volume promulgates policy.');
    expect(allText).toContain('010101.');
    expect(allText).toContain('The paragraph text.');
  });

  // Finding 5: a change table used to emit one atomic, un-paginated
  // TableItem, so a long change log's bottom rows painted off the physical
  // page (negative/below-margin y) and could push out an otherwise-empty
  // page. A 60-row volume change log must now split across pages, with
  // every row staying on-page and no page left with zero items.
  it('paginates a 60-row change log so every row stays on-page (finding 5)', () => {
    const d = sampleDoc();
    d.changeLog = Array.from({ length: 60 }, (_, i) => ({
      version: `${i + 1}`,
      summary: `Change number ${i + 1} summary text.`,
      originationDate: '2020-01-01',
      dateOfChanges: '2020-01-02',
    }));
    const out = layoutVolume(d);

    // No page anywhere in the document has zero items.
    for (const page of out.pages) {
      expect(page.items.length, `page "${page.label}" has zero items`).toBeGreaterThan(0);
    }

    // Every table chunk's rows stay within the printable page area.
    const tableItems = out.pages
      .flatMap(p => p.items)
      .filter((i): i is TableItem => i.kind === 'table');
    expect(tableItems.length).toBeGreaterThan(1); // the 60-row log had to split
    for (const t of tableItems) {
      const bottomY = t.y - t.headerHeight - t.rowHeights.reduce((a, b) => a + b, 0);
      expect(bottomY).toBeGreaterThanOrEqual(BOTTOM_Y - 0.01);
    }
  });

  // Finding 13 (T8): a section heading's TOC entry must record the page
  // where the heading's DESIGNATOR (i.e. where it starts) lands, not the
  // page its wrapped continuation lines ended up on after pagination. Build
  // enough long headings that at least one is guaranteed to start near the
  // bottom margin and wrap onto the next page, then verify every heading
  // TOC entry's recorded page matches the page its designator item is
  // actually painted on.
  it("records a heading's TOC page as where its designator starts, not where its wrapped text ends (finding 13)", () => {
    const d = sampleDoc();
    d.chapters[0].sections = Array.from({ length: 20 }, (_, i) => ({
      seq: i + 1,
      title:
        `A very long section heading title number ${i + 1} repeated so it wraps across the ` +
        'full page width every single time without fail no matter which page it starts on',
      body: [{ runs: [{ text: 'Some short filler body text for this section.' }] }],
      paragraphs: [],
    }));
    const out = layoutVolume(d);
    const headingEntries = out.toc.filter(e => e.level === 1);
    expect(headingEntries.length).toBe(20);
    for (const entry of headingEntries) {
      const designator = entry.label.split(' ')[0];
      const page = out.pages.find(p =>
        p.items.some(
          item =>
            item.kind === 'heading' &&
            item.segments.length === 1 &&
            item.segments[0].text === designator,
        ),
      );
      expect(page, `page for designator ${designator} not found`).toBeTruthy();
      expect(entry.page).toBe(page!.label);
    }
  });

  // Finding 14 (T10): a chapter's TOC entry must record the chapter's
  // actual FIRST page, not whatever page the chapter divider's own change
  // table happened to spill onto after pagination (finding 5). A 60-row
  // chapter change log forces the divider table to split across pages, so
  // this exercises the same reordering as finding 13 but for the
  // chapter-level entry.
  it("records a chapter's TOC page as its first page, even when the divider's change table paginates (finding 14)", () => {
    const d = sampleDoc();
    d.chapters[0].changeLog = Array.from({ length: 60 }, (_, i) => ({
      version: `${i + 1}`,
      pageParagraph: '0101',
      summary: `Change number ${i + 1} summary text.`,
      dateOfChange: '2020-01-02',
    }));
    const out = layoutVolume(d);
    const chapterEntry = out.toc.find(e => e.label.startsWith('CHAPTER 1:'));
    expect(chapterEntry).toBeTruthy();
    const firstBodyPage = out.pages.find(p => p.band === 'body');
    expect(firstBodyPage).toBeTruthy();
    expect(chapterEntry!.page).toBe(firstBodyPage!.label);
  });

  // Finding 15 (T10): format spec §4.6 prints the chapter change-table
  // header as "PAGE / PARAGRAPH" (spaces around the slash), verbatim.
  it('prints the chapter change-table header as "PAGE / PARAGRAPH" (finding 15)', () => {
    const out = layoutVolume(sampleDoc());
    const tableItems = out.pages.flatMap(p => p.items).filter((i): i is TableItem => i.kind === 'table');
    const headerTexts = tableItems.flatMap(t => t.headerLines.flatMap(lines => lines.join(' ')));
    expect(headerTexts.some(h => h === 'PAGE / PARAGRAPH')).toBe(true);
    expect(headerTexts.some(h => h === 'PAGE/PARAGRAPH')).toBe(false);
  });

  // Finding 10: a single character outside the paint font's WinAnsi
  // encoding used to throw all the way out of generateVolumePdf and abort
  // the ENTIRE export. Body text containing '→' and '≥' (neither
  // WinAnsi-encodable) must still produce a PDF.
  it('still produces a PDF when body text contains non-WinAnsi characters (finding 10)', async () => {
    const d = sampleDoc();
    d.chapters[0].sections[0] = {
      seq: 1,
      title: 'PURPOSE',
      body: [{ runs: [{ text: 'Escalate when risk → unacceptable and confidence ≥ 90%.' }] }],
      paragraphs: [],
    };
    const blob = await generateVolumePdf(d);
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/pdf');
  });
});
