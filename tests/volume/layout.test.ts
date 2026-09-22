// tests/volume/layout.test.ts
import { describe, it, expect } from 'vitest';
import { layoutVolume, runningHeadParts, BOTTOM_Y, type BoxItem, type LineItem, type TableItem } from '@/lib/volume/layout';
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

  // Finding 8: `Block.ladder === 'correspondence'` was accepted by the
  // schema but had no consumer - a sequence of correspondence-flagged
  // blocks must now render its own a./b./c. designators (format spec §2's
  // "Embedded-content ladder"), separate from the surrounding structural
  // CCSSPP designators.
  it('renders a correspondence block sequence with a./b. designators (finding 8)', () => {
    const d = sampleDoc();
    d.chapters[0].sections[0] = {
      seq: 1,
      title: 'PURPOSE',
      paragraphs: [
        {
          seq: 1,
          title: '',
          body: [
            { runs: [{ text: 'Intro line before the embedded sample.' }] },
            { ladder: 'correspondence', runs: [{ text: 'First embedded item.' }] },
            { ladder: 'correspondence', runs: [{ text: 'Second embedded item.' }] },
          ],
          children: [],
        },
      ],
    };
    const out = layoutVolume(d);
    const items = out.pages.flatMap(p => p.items);
    // The designator is its own standalone segment/item (addDesignatedLines
    // pushes it separately from the body text it shares a line with), so
    // this looks for an exact "a."/"b." designator item, not a substring
    // match against arbitrary body prose.
    const hasDesignator = (label: string) =>
      items.some(i => 'segments' in i && i.segments.some(s => s.text === label));
    expect(hasDesignator('a.')).toBe(true);
    expect(hasDesignator('b.')).toBe(true);

    const allText = items.flatMap(i => ('segments' in i ? i.segments.map(s => s.text) : [])).join('');
    expect(allText).toContain('First embedded item.');
    expect(allText).toContain('Second embedded item.');
  });

  // Task 20, fix round 1 (reviewer finding, CRITICAL): `addBox` used to run
  // AFTER `addTable`, so a change table long enough to paginate (Finding
  // 5's identical pagination) left the box attached to whatever page
  // `addTable` happened to finish on - a stray rectangle on the WRONG page,
  // with no box at all around the actual "VOLUME {n} .. CANCELLATION" text.
  // Reviewer reproduced with a 15-entry title-page changeLog (box lands on
  // page index 1 instead of 0) and a 20-entry chapter changeLog (same bug
  // on the divider). Fixed by capturing the box immediately after
  // `boxBottomY`, before `addTable` runs, at both call sites.
  it('keeps the title-page box on the title page even when its change table paginates (fix round 1)', () => {
    const d = sampleDoc();
    // Long summaries force multi-line wrapped rows, so 15 rows comfortably
    // overflow one page below the title block and force addTable to
    // paginate (mirrors the reviewer's repro).
    d.changeLog = Array.from({ length: 15 }, (_, i) => ({
      version: `${i + 1}`,
      summary:
        `Change number ${i + 1}: a summary long enough to wrap across several lines within its own ` +
        'column, so this table needs enough rows and enough height per row to force pagination.',
      originationDate: '2020-01-01',
      dateOfChanges: '2020-01-02',
    }));
    const out = layoutVolume(d);

    // The table really did paginate (otherwise this test isn't exercising
    // the bug at all).
    const tableItems = out.pages.flatMap(p => p.items).filter((i): i is TableItem => i.kind === 'table');
    expect(tableItems.length, 'expected the 15-row change table to paginate').toBeGreaterThan(1);

    // One box for the title page, one for the chapter divider (the divider
    // always gets its own box too - layoutChapterDivider - regardless of
    // whether the title page's OWN change table paginates).
    const boxItems = out.pages.flatMap(p => p.items).filter((i): i is BoxItem => i.kind === 'box');
    expect(boxItems.length).toBe(2);

    const titlePage = out.pages.find(p =>
      p.items.some(i => 'segments' in i && i.segments.some(s => s.text === `VOLUME ${d.volume.number}`)),
    );
    expect(titlePage, `"VOLUME ${d.volume.number}" heading page not found`).toBeTruthy();
    expect(boxItems.some(b => titlePage!.items.includes(b))).toBe(true);
  });

  it('keeps the chapter-divider box on the divider page even when its change table paginates (fix round 1)', () => {
    const d = sampleDoc();
    d.chapters[0].changeLog = Array.from({ length: 20 }, (_, i) => ({
      version: `${i + 1}`,
      pageParagraph: '0101',
      summary:
        `Change number ${i + 1}: a summary long enough to wrap across several lines within its own ` +
        'column, so this table needs enough rows and enough height per row to force pagination.',
      dateOfChange: '2020-01-02',
    }));
    const out = layoutVolume(d);

    const tableItems = out.pages.flatMap(p => p.items).filter((i): i is TableItem => i.kind === 'table');
    expect(tableItems.length, 'expected the 20-row chapter change table to paginate').toBeGreaterThan(1);

    // One box for the (changeLog-free) title page, one for the divider.
    const boxItems = out.pages.flatMap(p => p.items).filter((i): i is BoxItem => i.kind === 'box');
    expect(boxItems.length).toBe(2);

    const dividerPage = out.pages.find(
      p => p.items.some(i => 'segments' in i && i.segments.some(s => s.text === 'SUMMARY OF SUBSTANTIVE CHANGES')),
    );
    expect(dividerPage, 'chapter divider page not found').toBeTruthy();
    expect(boxItems.some(b => dividerPage!.items.includes(b))).toBe(true);
  });

  // Task 21 finding 5 (regression hunt): the real Vol 17 PDF's OWN
  // changeLog has exactly one recorded row (the "ORIGINAL VOLUME" seed
  // itself, stored as real data) and STILL prints the 3 blank/gray-shaded
  // template rows below it - `titlePageChangeRows` used to drop them
  // entirely once `doc.changeLog` had any real entries (see its doc comment
  // in lib/volume/layout.ts). The vol17.json fixture stores its seed row
  // this way, so this reproduces the user's reported regression: the title
  // page's change table silently lost its blank rows in both the PDF and
  // DOCX exports (this test covers the PDF path via the shared layout data;
  // tests/volume/docx.test.ts's identical test covers the DOCX path).
  it('keeps the 3 blank/shaded template rows even when the changeLog already has real entries (finding 5 regression)', () => {
    const d = sampleDoc();
    d.changeLog = [{ version: 'ORIGINAL VOLUME', summary: 'N/A', originationDate: '10 Feb 2021', dateOfChanges: 'N/A' }];
    const out = layoutVolume(d);

    const titleTable = out.pages
      .flatMap(p => p.items)
      .find((i): i is TableItem => i.kind === 'table' && i.headerLines.flat().join(' ').includes('VOLUME'));
    expect(titleTable, 'title-page change table not found').toBeTruthy();
    expect(titleTable!.rows.length).toBe(4); // 1 real row + 3 blank template rows
    expect(titleTable!.rowShading, 'expected shading flags on the trailing blank rows').toBeTruthy();
    const shading = titleTable!.rowShading!;
    // Row 0 (the real "ORIGINAL VOLUME" entry) is unshaded; rows 1-3 (the
    // blank template rows) shade their ORIGINATION DATE column (index 2).
    expect(shading[0]?.some(Boolean)).toBe(false);
    for (const row of shading.slice(1)) {
      expect(row?.[2]).toBe(true);
    }
    // The 3 trailing rows are genuinely blank (no authored text).
    for (const row of titleTable!.rows.slice(1)) {
      expect(row.every(cell => cell.join('') === '')).toBe(true);
    }
  });

  // Task 22: appendix support - divider page (band "A-1"), content page(s)
  // ("A-2", ...), a TOC "APPENDICES" header + per-appendix entry pointing at
  // the CONTENT page, and the running head's "Volume {n}, Appendix {L}"
  // left label.
  describe('appendices', () => {
    function withAppendix() {
      const d = sampleDoc();
      d.appendices = [
        {
          letter: 'A',
          title: 'GLOSSARY OF ACRONYMS AND ABBREVIATIONS',
          changeLog: [],
          blocks: [],
          glossary: [
            { term: 'ABA', definition: 'American Bar Association' },
            { term: 'TSO', definition: 'Trial Services Organization' },
          ],
        },
      ];
      return d;
    }

    it('lays out a divider page banded "A-1" and content page(s) banded "A-2", ...', () => {
      const out = layoutVolume(withAppendix());
      const appendixPages = out.pages.filter(p => p.band === 'appendix');
      expect(appendixPages.map(p => p.label)).toEqual(['A-1', 'A-2']);
      expect(appendixPages.every(p => p.appendix === 'A')).toBe(true);
    });

    it('restarts the page-band counter at 1 for each appendix letter', () => {
      const d = withAppendix();
      d.appendices.push({ letter: 'B', title: 'SAMPLE FORM', changeLog: [], blocks: [{ runs: [{ text: 'Body.' }] }] });
      const out = layoutVolume(d);
      const labels = out.pages.filter(p => p.band === 'appendix').map(p => p.label);
      expect(labels).toEqual(['A-1', 'A-2', 'B-1', 'B-2']);
    });

    it('emits an "APPENDICES" TOC header entry and a per-appendix entry pointing at the CONTENT page', () => {
      const out = layoutVolume(withAppendix());
      const header = out.toc.find(e => e.header);
      expect(header?.label).toBe('APPENDICES');
      const entry = out.toc.find(e => e.appendix);
      expect(entry).toBeTruthy();
      expect(entry!.label).toContain('A');
      expect(entry!.label).toContain('GLOSSARY OF ACRONYMS AND ABBREVIATIONS');
      // Content page ("A-2"), not the divider ("A-1").
      expect(entry!.page).toBe('A-2');
    });

    it('prints the divider heading "VOLUME {n}:  APPENDIX {L}" and the content page\'s "APPENDIX {L}" title', () => {
      const out = layoutVolume(withAppendix());
      const items = out.pages.flatMap(p => p.items);
      const allText = items.flatMap(i => ('segments' in i ? i.segments.map(s => s.text) : [])).join('');
      expect(allText).toContain('VOLUME 6:  APPENDIX A');
      expect(allText).toContain('APPENDIX A');
      expect(allText).toContain('GLOSSARY OF ACRONYMS AND ABBREVIATIONS');
    });

    it('renders the glossary as two columns (term at x=77.4, definition at x=185.3)', () => {
      const out = layoutVolume(withAppendix());
      const lineItems = out.pages
        .flatMap(p => p.items)
        .filter((i): i is LineItem => i.kind === 'line');
      const lineText = (i: LineItem) => i.segments.map(s => s.text).join('');
      const termItem = lineItems.find(i => i.segments.some(s => s.text === 'ABA'));
      const defItem = lineItems.find(i => lineText(i).includes('American Bar Association'));
      expect(termItem, 'glossary term "ABA" not found').toBeTruthy();
      expect(defItem, 'glossary definition not found').toBeTruthy();
      expect(termItem!.x).toBeCloseTo(77.4, 1);
      expect(defItem!.x).toBeCloseTo(185.3, 1);
    });

    it("uses the appendix running-head left label \"Volume {n}, Appendix {L}\"", () => {
      const out = layoutVolume(withAppendix());
      const appendixPage = out.pages.find(p => p.band === 'appendix');
      expect(appendixPage).toBeTruthy();
      expect(runningHeadParts(withAppendix(), 'appendix', undefined, 'A').left).toBe('Volume 6, Appendix A');
    });
  });
});
