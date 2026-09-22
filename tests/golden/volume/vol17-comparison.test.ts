// tests/golden/volume/vol17-comparison.test.ts
//
// Task 17, Part C: one-to-one placement comparison between our rendered
// Vol 17 (JUDGE ADVOCATE DIVISION AWARDS PROGRAM) and the real, published
// MCO 5800.16 Vol 17 PDF. The real PDF lives outside the repo (a drafter's
// local download), so the comparison block is guarded by existsSync and
// skips cleanly when it is absent (e.g. in CI) - the render-side
// assertions always run regardless.
import { describe, it, expect } from 'vitest';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { VolumeSchema } from '@/lib/schemas/volume-schema';
import { generateVolumePdf } from '@/services/pdf/volumeGenerator';
import { layoutVolume, LEADING } from '@/lib/volume/layout';

const REAL_PDF = 'C:\\Users\\barbc\\Downloads\\01_USMC_OFFICIAL\\MCO_Orders\\MCO 5800.16 Vol.17.pdf';

// Task 20: `font` is an ADDITIVE field on measure-pdf.py's output (the
// embedded font's BaseFont, subset-tag stripped) - every existing
// field/consumer is unchanged; it lets the weight-fidelity assertions below
// tell Bold/BoldItalic/regular apart without changing anything that already
// worked off x/y/size/text.
interface MeasuredRow { page: number; x: number; y: number; size: number; text: string; font: string }

function measureFile(pdfPath: string): MeasuredRow[] {
  const out = execFileSync('python', [join(__dirname, 'measure-pdf.py'), pdfPath]).toString();
  return JSON.parse(out) as MeasuredRow[];
}

/**
 * Task 23: reconstructs one physical line of extracted text by joining every
 * row on the same PAGE within `tolerance`pt of `y`, left to right - the same
 * "same y, join by x" pattern `footerLabels` below already uses, needed here
 * because both renderers split a styled/kerned line (e.g. the first
 * boilerplate paragraph's underlined/regular runs) into several
 * text-showing operations that individually extract as separate rows
 * sharing one y. Filtering by page too matters: the divider/appendix-divider
 * pages repeat lines at the SAME y as the title page (all built from the
 * same box template), so an unfiltered y-only match would splice text from
 * unrelated pages together.
 */
function lineTextAtY(rows: MeasuredRow[], page: number, y: number, tolerance = 0.5): string {
  return rows
    .filter(r => r.page === page && Math.abs(r.y - y) <= tolerance)
    .sort((a, b) => a.x - b.x)
    .map(r => r.text)
    .join('');
}

/** Our own title page's laid-out items (box + lines), straight from the
 * layout function - not the exported PDF's text extraction, since a filled/
 * stroked box has no extractable text for measure-pdf.py to see. */
function ourTitlePageItems() {
  const doc = VolumeSchema.parse(JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vol17.json'), 'utf8')));
  return layoutVolume(doc).pages[0].items;
}

/**
 * Task 20: our render embeds pdf-lib's StandardFonts ("Times-Bold",
 * "Times-BoldItalic", ...) while the real PDF embeds actual Times New Roman
 * ("TimesNewRomanPS-BoldMT", ...) - different BaseFont naming schemes, but
 * both spell out "Bold"/"Italic" in the weight/style the row was painted
 * with, so a case-insensitive substring check is font-family-agnostic and
 * works for either document.
 */
function isBoldFont(font: string): boolean {
  return /bold/i.test(font);
}
function isItalicFont(font: string): boolean {
  return /italic/i.test(font);
}

/** Renders our own Vol 17 fixture to a temp PDF file and returns its path. */
async function ourPdfPath(): Promise<string> {
  const doc = VolumeSchema.parse(JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vol17.json'), 'utf8')));
  const blob = await generateVolumePdf(doc);
  const dir = mkdtempSync(join(tmpdir(), 'vol17-'));
  const pdf = join(dir, 'v.pdf');
  writeFileSync(pdf, Buffer.from(await blob.arrayBuffer()));
  return pdf;
}

async function ourRows(): Promise<MeasuredRow[]> {
  return measureFile(await ourPdfPath());
}

/**
 * Task 25 fix 4: counts a table's horizontal row-boundary lines on a given
 * PDF page within [yLow, yHigh] - see measure-table-rows.py's module doc
 * comment for why this works across both renderers (our own pdf-lib stroked
 * lines vs. the real PDF's thin filled rects) despite the different drawing
 * primitives.
 */
function countRowBoundaries(pdfPath: string, page: number, yLow: number, yHigh: number): number {
  const out = execFileSync('python', [
    join(__dirname, 'measure-table-rows.py'), pdfPath, String(page), String(yLow), String(yHigh),
  ]).toString();
  return Number(out.trim());
}

/** First row on any page whose text starts with `prefix`. */
function findStartsWith(rows: MeasuredRow[], prefix: string): MeasuredRow | undefined {
  return rows.find(r => r.text.startsWith(prefix));
}

/** First row on any page whose text contains `needle` as a substring - used
 * where the two renderers split the same line into a different number of
 * text-showing operations (kerning pairs, kept-together runs, etc.) so an
 * exact-string match would be brittle without being any more meaningful. */
function findIncludes(rows: MeasuredRow[], needle: string): MeasuredRow | undefined {
  return rows.find(r => r.text.includes(needle));
}

/**
 * Reconstructs footer labels (y < 45) by joining same-page chunks left to
 * right. Both renderers put the whole footer on one line, but pypdf can
 * split a chunk like "1-2" into "1"/"-"/"2" (kerning pairs) where our own
 * `drawText` call keeps it as one piece - joining by page makes the two
 * comparable regardless of how many text-showing operations either PDF
 * used.
 */
function footerLabels(rows: MeasuredRow[]): string[] {
  const byPage = new Map<number, MeasuredRow[]>();
  for (const r of rows) {
    if (r.y >= 45) continue;
    if (!byPage.has(r.page)) byPage.set(r.page, []);
    byPage.get(r.page)!.push(r);
  }
  return [...byPage.values()].map(chunks =>
    [...chunks].sort((a, b) => a.x - b.x).map(c => c.text).join(''));
}

describe('volume Vol 17 render (no real PDF required)', () => {
  it('places section designators at x=72', async () => {
    const rows = await ourRows();
    for (const d of ['0101', '0102', '0103', '0104', '0105', '0106', '0107', '0108', '0109', '0110']) {
      const row = findStartsWith(rows, d);
      expect(row, `designator ${d} not found`).toBeTruthy();
      expect(row!.x).toBeCloseTo(72, 0);
    }
  });

  it('places body text at the x=72 left margin', async () => {
    const rows = await ourRows();
    const body = findIncludes(rows, 'To establish and provide guidance');
    expect(body?.x).toBeCloseTo(72, 0);
  });

  it('prints the running-head right block (designator, volume, date)', async () => {
    const rows = await ourRows();
    const designatorRow = findIncludes(rows, 'MCO 5800.16');
    expect(designatorRow).toBeTruthy();
    expect(designatorRow!.text).toContain('V17');
    // Task 17 fix: the last-updated date now formats through the shared
    // DD-Mon-YYYY formatter instead of printing the raw ISO string.
    const dateRow = findIncludes(rows, '10 Feb 2021');
    expect(dateRow).toBeTruthy();
  });

  // Task 21 finding 2: the designator/volume separator is an EN DASH
  // (U+2013), re-measured directly against the real PDF's content stream
  // (the glyph's ToUnicode CMap resolves it to <2013>, not a middot
  // <00B7>) - naive text extraction shows a replacement character for
  // either, so the codepoint itself, not the extracted glyph, is what this
  // asserts.
  it('finding 2: uses an en dash (U+2013), not a middot, between the designator and volume tag', async () => {
    const rows = await ourRows();
    const designatorRow = findIncludes(rows, 'MCO 5800.16');
    expect(designatorRow).toBeTruthy();
    expect(designatorRow!.text).toContain('–');
    expect(designatorRow!.text).not.toContain('·');
  });

  it('prints the center running head (policy title)', async () => {
    const rows = await ourRows();
    expect(findIncludes(rows, 'LEGAL SUPPORT AND ADMINISTRATION MANUAL')).toBeTruthy();
  });

  it('uses chapter-page footer labels ("1-1".."1-4"), per pageBand: chapter-page', async () => {
    const rows = await ourRows();
    // Title page: roman numeral.
    expect(rows.some(r => r.y < 45 && r.text.trim() === 'i')).toBe(true);
    // Body pages: "1-N" chapter-page style. Fix round 1: the brief's
    // controller ruling set volume.pageBand explicitly to 'chapter-page'
    // for Vol 17 (the real source volumes are genuinely inconsistent here -
    // Vol 6 prints bare sequential numbers and stays on 'auto' - so this is
    // a per-volume data choice, not a change to the 'auto' heuristic itself;
    // see layoutBody in lib/volume/layout.ts, unchanged).
    const labels = footerLabels(rows).filter(l => /^\d+-\d+$/.test(l));
    expect(labels.sort()).toEqual(['1-1', '1-2', '1-3', '1-4']);
    expect(rows.some(r => r.y < 45 && /^\d+$/.test(r.text.trim()))).toBe(false);
  });

  it('inserts a visible paragraph break between two Blocks in the same section body', async () => {
    const rows = await ourRows();
    // Section 0102's two paragraphs: near the end of the first ("...and
    // renames this award the Brigadier General Michael E. Rich...") and the
    // start of the second ("Each Regional Trial Counsel (RTC) will
    // nominate..."). This substring (not the paragraph's literal last
    // words) is the anchor because the real PDF splits "...Trial Counsel of
    // the Year Award." across a word-kerning boundary ("...Awa" + "rd."),
    // which would make an exact-tail match brittle across the two PDFs.
    const endOfFirst = findIncludes(rows, 'and renames this award the Brigadier General Michael E. Rich');
    const startOfSecond = findIncludes(rows, 'Each Regional Trial Counsel (RTC) will nominate');
    expect(endOfFirst, 'end of 0102 paragraph 1 not found').toBeTruthy();
    expect(startOfSecond, 'start of 0102 paragraph 2 not found').toBeTruthy();
    const gap = endOfFirst!.y - startOfSecond!.y;
    // One ordinary line step (LEADING ~12.6) plus the inter-paragraph gap
    // (also ~12.6, see INTER_PARAGRAPH_GAP) - i.e. roughly 2x LEADING, not 1x.
    expect(gap).toBeGreaterThan(20);
  });

  it('prints the title-page summary block', async () => {
    const rows = await ourRows();
    expect(findIncludes(rows, 'VOLUME 17')).toBeTruthy();
    expect(findIncludes(rows, 'SUMMARY OF VOLUME 17 CHANGES')).toBeTruthy();
    expect(findIncludes(rows, 'CANCELLATION')).toBeTruthy();
    expect(findIncludes(rows, 'MCO 1650.62')).toBeTruthy();
    expect(findIncludes(rows, 'DISTRIBUTION')).toBeTruthy();
    expect(findIncludes(rows, 'PCN 10209190801')).toBeTruthy();
  });

  // Task 18 finding A: the change-table painter used to draw every cell's
  // full text at a fixed x with no wrapping, so a wide header like "VOLUME
  // VERSION" ran straight across the column boundary into "SUMMARY OF
  // CHANGE" (they extracted, garbled together, as
  // "VOLUME VERSIONSUMMARY OF CHANGE"). Cells now word-wrap within their
  // own column (lib/volume/layout.ts's `addTable`), so the two header
  // cells extract as separate text rows whose x-ranges never intersect.
  it('finding A: change-table header cells wrap within their own column and never overlap', async () => {
    const rows = await ourRows();
    // No row is the old garbled merge of the two header cells.
    expect(rows.some(r => r.text.includes('VOLUME VERSIONSUMMARY'))).toBe(false);
    const volCol = rows.find(r => r.text === 'VOLUME' || r.text === 'VOLUME VERSION');
    const summaryCol = rows.find(r => r.text.startsWith('SUMMARY OF CHANGE'));
    expect(volCol, '"VOLUME"/"VOLUME VERSION" header cell not found').toBeTruthy();
    expect(summaryCol, '"SUMMARY OF CHANGE" header cell not found').toBeTruthy();
    // Different columns of the same table row: "SUMMARY OF CHANGE" must
    // start well to the right of where "VOLUME"/"VOLUME VERSION" sits,
    // never sharing x-space with it.
    expect(summaryCol!.x).toBeGreaterThan(volCol!.x + 50);
  });

  // Task 18 finding B: dot leaders used to start before a long TOC label
  // finished measuring (the old font metrics under-measured every
  // uppercase character - see finding C's fix in font-metrics.ts), so
  // leaders painted on top of the label's own tail characters
  // ("PURPOS.E....", "TH.E...Y...E...A..R"). The label's first line must
  // now extract as a contiguous, un-garbled run, and any leader dots on
  // its final line must start strictly after the label text ends.
  it('finding B: TOC leader starts after the label, never overlapping it', async () => {
    const rows = await ourRows();
    // The TOC's "0101. PURPOSE" entry (section 0101 is titled "PURPOSE").
    const purpose = rows.find(r => r.text.includes('PURPOSE') && r.text.startsWith('0101'));
    expect(purpose, 'TOC "0101. PURPOSE" entry not found').toBeTruthy();
    expect(purpose!.text).toBe('0101. PURPOSE'); // contiguous, not garbled by an overlapping leader
    const leaderRow = rows.find(r => r.y === purpose!.y && /^\s*\.+$/.test(r.text));
    expect(leaderRow, 'dot leader for the "0101. PURPOSE" TOC row not found').toBeTruthy();
    // The leader must start to the right of the whole label, not somewhere
    // inside it (a real overlap would put the leader's x under 100).
    expect(leaderRow!.x).toBeGreaterThan(purpose!.x + 60);
  });

  // Task 21 finding 6: TOC entries are double-spaced (a blank line between
  // consecutive entries), while a single entry's own wrapped continuation
  // line stays single-spaced - re-measured on the real PDF (~29pt
  // entry-to-entry vs. ~14.5pt within one wrapped entry, roughly double).
  // 0104 ("DEFENSE COUNSEL OF THE YEAR AWARD") is one line; 0105 wraps.
  it('finding 6: TOC entries are double-spaced, wrapped continuation lines stay single-spaced', async () => {
    const rows = await ourRows();
    const entry0104 = findStartsWith(rows, '0104');
    const entry0105 = findStartsWith(rows, '0105');
    expect(entry0104, 'TOC "0104" entry not found').toBeTruthy();
    expect(entry0105, 'TOC "0105" entry not found').toBeTruthy();
    const betweenEntriesGap = entry0104!.y - entry0105!.y;

    // 0107's heading wraps onto a line ending "...(CPOY-A)" (finding C,
    // below) - a unique substring for its own continuation line.
    const entry0107 = findStartsWith(rows, '0107');
    const entry0107Wrap = findIncludes(rows, '(CPOY-A)');
    expect(entry0107, 'TOC "0107" entry not found').toBeTruthy();
    expect(entry0107Wrap, 'TOC "0107" wrapped continuation not found').toBeTruthy();
    const withinEntryGap = entry0107!.y - entry0107Wrap!.y;

    // Double-spaced means the between-entries gap is roughly double the
    // within-entry wrap gap, not equal to it.
    expect(betweenEntriesGap).toBeGreaterThan(withinEntryGap * 1.5);
    expect(betweenEntriesGap).toBeGreaterThan(20);
  });

  // Task 18 finding C (critical, data loss): section 0107's long heading
  // ("...AWARD (CPOY-A)") used to run off the right edge of the physical
  // page - the layout's own width estimate (measureText, backed by
  // font-metrics.ts) fell back to a uniform 0.5em for every uppercase
  // character (the generator's charset never included A-Z), so it never
  // triggered a wrap even though the REAL Times New Roman glyphs pdf-lib
  // paints are much wider. The closing "(CPOY-A)" landed past x=612 (the
  // page's own right edge) and was invisible. Root-cause fix: regenerate
  // font-metrics.ts with the full character set (scripts/
  // generate-font-metrics.mjs), so wrapRuns's decisions match pdf-lib's
  // real paint widths and the heading wraps instead of overflowing.
  it('finding C: section 0107\'s heading wraps and keeps the closing "(CPOY-A)" on the page', async () => {
    const rows = await ourRows();
    const closing = findIncludes(rows, '(CPOY-A)');
    expect(closing, 'heading text "(CPOY-A)" was dropped/truncated').toBeTruthy();
    expect(closing!.x).toBeLessThan(540); // must sit left of the right margin, not off the page
  });

  // Task 18 finding D: single-chapter volumes (Vol 17 has one chapter)
  // never print ", Chapter N" in the running head's left label - verified
  // against the real Vol 1, Vol 4 and Vol 17 PDFs (see task-18-report.md):
  // all three print bare "Volume {n}" on every page, including body
  // pages, and switch to the literal word "References" on reference-band
  // pages. Only a MULTI-chapter volume's body pages add the ", Chapter M"
  // suffix (e.g. Vol 1 prints "Volume 1, Chapter 1" on its body pages).
  it('finding D: single-chapter running head never prints a ", Chapter N" suffix', async () => {
    const rows = await ourRows();
    expect(rows.some(r => r.text.includes('Chapter'))).toBe(false);
    expect(findIncludes(rows, 'Volume 17')).toBeTruthy();
    expect(findIncludes(rows, 'References')).toBeTruthy();
  });

  // Task 18 finding E: the real Vol 17 PDF prints the bare literal
  // "Report Required:" or nothing at all; "See Volume text for details."
  // was invented text with no backing field in the schema
  // (`reportRequired` is a plain boolean).
  it('finding E: prints the bare "Report Required:" label with no invented text', async () => {
    const rows = await ourRows();
    expect(findIncludes(rows, 'Report Required:')).toBeTruthy();
    expect(rows.some(r => r.text.includes('See Volume text for details'))).toBe(false);
  });

  // Task 20: title-page/divider styling fidelity - measured directly
  // against the real Vol 17 PDF (task-20-report.md). "VOLUME 17", the
  // hyperlink legend's styled phrase, and the change-table headers all
  // paint bold (the legend phrase bold-ITALIC specifically); ordinary body
  // text stays regular.
  it('Task 20: paints "VOLUME 17", the legend phrase, and table headers bold', async () => {
    const rows = await ourRows();
    const volumeHeading = findIncludes(rows, 'VOLUME 17');
    expect(volumeHeading, '"VOLUME 17" heading not found').toBeTruthy();
    expect(isBoldFont(volumeHeading!.font)).toBe(true);

    const legendPhrase = findIncludes(rows, 'bold, italic, blue and underlined font');
    expect(legendPhrase, 'legend styled phrase not found').toBeTruthy();
    expect(isBoldFont(legendPhrase!.font)).toBe(true);
    expect(isItalicFont(legendPhrase!.font)).toBe(true);

    const tableHeader = rows.find(r => r.text === 'VOLUME' || r.text === 'VOLUME VERSION');
    expect(tableHeader, 'change-table header cell not found').toBeTruthy();
    expect(isBoldFont(tableHeader!.font)).toBe(true);

    // Ordinary body text (section 0101's opening line) stays regular -
    // Vol 17's body-section headings measured regular too (task-20-report.md),
    // so bolding is confined to the front-matter/divider styling this task
    // covers, not body text.
    const bodyText = findIncludes(rows, 'To establish and provide guidance');
    expect(bodyText, 'section 0101 body text not found').toBeTruthy();
    expect(isBoldFont(bodyText!.font)).toBe(false);
  });

  // Task 22: Appendix A ("GLOSSARY OF ACRONYMS AND ABBREVIATIONS") - divider
  // (footer "A-1"), content page (footer "A-2"), the TOC's "APPENDICES"
  // header + per-appendix entry, and the glossary's two-column layout -
  // measured directly against the real Vol 17 PDF (fontmap.py, page indices
  // 1/7/8; see task22-report.md for the full evidence).
  it('Task 22: lays out Appendix A with "A-1"/"A-2" footers and the two-column glossary', async () => {
    const rows = await ourRows();

    const labels = footerLabels(rows);
    expect(labels).toContain('A-1');
    expect(labels).toContain('A-2');

    expect(findIncludes(rows, 'VOLUME 17:  APPENDIX A')).toBeTruthy();
    expect(findIncludes(rows, 'GLOSSARY OF ACRONYMS AND ABBREVIATIONS')).toBeTruthy();

    // Finding: "American Bar Association" also appears in section 0110's
    // body prose (flush-left at x=72), so a bare `findIncludes` can pick up
    // that occurrence instead of the glossary's definition column - filter
    // to the definition column's x range to disambiguate.
    const term = findStartsWith(rows, 'ABA');
    const def = rows.find(r => r.text.includes('American Bar Association') && r.x > 150);
    expect(term, 'glossary term "ABA" not found').toBeTruthy();
    expect(def, 'glossary definition not found').toBeTruthy();
    expect(term!.x).toBeCloseTo(77.4, 0);
    expect(def!.x).toBeCloseTo(185.3, 0);
  });

  it('Task 22: TOC includes an "APPENDICES" header and an "A" entry pointing at the content page', async () => {
    const rows = await ourRows();
    const appendicesHeader = rows.find(r => r.text === 'APPENDICES');
    expect(appendicesHeader, 'TOC "APPENDICES" header not found').toBeTruthy();
    expect(isBoldFont(appendicesHeader!.font)).toBe(true);

    const entry = findIncludes(rows, 'GLOSSARY OF ACRONYMS AND ABBREVIATIONS');
    expect(entry, 'TOC appendix entry not found').toBeTruthy();
    // The entry's page-label row ("A-2") sits on the same TOC line.
    const sameLine = rows.filter(r => r.y === entry!.y);
    expect(sameLine.some(r => r.text.includes('A-2'))).toBe(true);
  });

  // Task 25 fix 2: the References page's own centered "REFERENCES" heading
  // paints bold - measured directly against the real Vol 17 PDF (fontmap.py,
  // page index 2, y=691.4): a `/TimesNewRomanPS-BoldMT` BaseFont, unlike the
  // ordinary regular-weight reference-list body text below it.
  it('Task 25 fix 2: the References page heading "REFERENCES" is bold', async () => {
    const rows = await ourRows();
    const heading = rows.find(r => r.text === 'REFERENCES');
    expect(heading, '"REFERENCES" heading not found').toBeTruthy();
    expect(isBoldFont(heading!.font)).toBe(true);
  });

  // Task 26: the real Vol 17 PDF has ONE references page (the list only, no
  // second quoted-heading "REFERENCES" summary page) - the fixture now sets
  // `referencesSummaryPage: false`, so the REF band collapses from 2 pages
  // to 1 and there is no "REF-2" footer.
  it('Task 26: the REF band has exactly one page (referencesSummaryPage: false)', async () => {
    const rows = await ourRows();
    const refLabels = footerLabels(rows).filter(l => /^REF-\d+$/.test(l));
    expect(refLabels).toEqual(['REF-1']);
    const quotedHeading = rows.find(r => r.text === '"REFERENCES"');
    expect(quotedHeading, 'the opt-out summary page must not render').toBeUndefined();
  });

  // Task 25 fix 3: the divider's title-quoting follows `doc.volume.
  // titleQuoted` instead of being hardcoded on. The Vol 17 fixture sets
  // `titleQuoted: false`, and the real chapter divider (fontmap.py, page
  // index 3) prints the bare "JUDGE ADVOCATE DIVISION AWARDS PROGRAM" with
  // no quote glyphs at all.
  it('Task 25 fix 3: the chapter divider title has no quote characters (titleQuoted: false)', async () => {
    const rows = await ourRows();
    const dividerTitle = findIncludes(rows, 'JUDGE ADVOCATE DIVISION AWARDS PROGRAM');
    expect(dividerTitle, 'chapter divider title line not found').toBeTruthy();
    expect(dividerTitle!.text).not.toContain('"');
  });

  // Task 25 fix 4: the chapter divider's change table carries 4 blank,
  // UNSHADED template rows below its header even when the chapter's own
  // changeLog is empty (Vol 17's fixture chapter has no changeLog entries) -
  // matching the real PDF's own row-rule count (see the vs-real-PDF describe
  // block below for the direct row-count comparison). Verified here via the
  // laid-out `TableItem` directly (not the exported PDF's text extraction,
  // since blank rows paint no text): `dividerChangeRows`'s row count plus its
  // header, for a page-cursor context, isn't independently observable except
  // through the shared `layoutVolume` output.
  it('Task 25 fix 4: chapter and appendix divider tables have 4 blank, unshaded rows below the header', () => {
    const doc = VolumeSchema.parse(JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vol17.json'), 'utf8')));
    const out = layoutVolume(doc);
    const dividerTables = out.pages
      .flatMap(p => p.items)
      .filter((i): i is Extract<typeof i, { kind: 'table' }> => i.kind === 'table')
      .filter(t => t.headerLines.flat().join(' ').includes('CHAPTER'));
    expect(dividerTables.length).toBeGreaterThan(0);
    for (const table of dividerTables) {
      // changeLog is empty for both the fixture's chapter and appendix, so
      // the table's only rows are the 4 blank template rows.
      expect(table.rows.length).toBe(4);
      expect(table.rowShading, 'expected no shading on the divider table').toBeFalsy();
    }
  });

  // Task 27 fix 2: the chapter title page's own "CHAPTER 1" line and title
  // line (NOT the chapter divider's combined "VOLUME 17: CHAPTER 1" heading,
  // which is a different page and was already bold+underlined before this
  // task) - one blank line between them, and the title itself bold+
  // underlined. See layoutChapterTitlePage's doc comment for the measured
  // provenance (a 1.08pt underline rect directly under the title).
  it('Task 27 fix 2: chapter title page has a blank line before a bold+underlined title', () => {
    const doc = VolumeSchema.parse(JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vol17.json'), 'utf8')));
    const out = layoutVolume(doc);
    type TextItem = Extract<(typeof out.pages)[number]['items'][number], { kind: 'line' | 'heading' }>;
    const isTextItem = (i: (typeof out.pages)[number]['items'][number]): i is TextItem =>
      i.kind === 'line' || i.kind === 'heading';

    const titlePage = out.pages.find(p => p.items.some(i => isTextItem(i) && i.segments.some(s => s.text === 'CHAPTER 1')));
    expect(titlePage, 'chapter title page not found').toBeTruthy();

    const chapterLine = titlePage!.items.find((i): i is TextItem => isTextItem(i) && i.segments.some(s => s.text === 'CHAPTER 1'));
    const titleLine = titlePage!.items.find(
      (i): i is TextItem => isTextItem(i) && i.segments.some(s => s.text === 'JUDGE ADVOCATE DIVISION AWARDS PROGRAM'),
    );
    expect(chapterLine, '"CHAPTER 1" line not found').toBeTruthy();
    expect(titleLine, 'chapter title line not found').toBeTruthy();

    // One blank line (2 * LEADING) between "CHAPTER 1" and the title -
    // matches the real PDF's measured 25.3pt gap (694.4 -> 669.1) within
    // rounding noise.
    expect(chapterLine!.y - titleLine!.y).toBeCloseTo(2 * LEADING, 0);

    const seg = titleLine!.segments.find(s => s.text === 'JUDGE ADVOCATE DIVISION AWARDS PROGRAM');
    expect(seg?.run.bold, 'chapter title must be bold').toBe(true);
    expect(seg?.run.underline, 'chapter title must be underlined').toBe(true);
  });

  // Task 27 fix 3: our own render's section-heading-to-body gap (no real PDF
  // required) - section 0101 ("PURPOSE")'s heading to its first body line.
  // The heading text "PURPOSE" also appears (as its own extracted chunk, on
  // the real PDF at least) in the bold TOC entry "0101. PURPOSE" - disambiguated
  // by requiring the heading candidate to share its PAGE with the unambiguous
  // body-text anchor, same pattern the vs-real-PDF fix 3 test below uses.
  it('Task 27 fix 3: section heading has a blank-line gap before its body text', async () => {
    const rows = await ourRows();
    const body = findIncludes(rows, 'To establish and provide guidance');
    expect(body, 'section 0101 body text not found').toBeTruthy();
    const heading = rows.find(r => r.text === 'PURPOSE' && r.page === body!.page);
    expect(heading, '"0101. PURPOSE" heading not found on the body page').toBeTruthy();
    expect(heading!.y - body!.y).toBeCloseTo(2 * LEADING, 0);
  });
});

describe.skipIf(!existsSync(REAL_PDF))('volume Vol 17 vs the real published PDF', () => {
  it('section designators sit at x=72 in both documents', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);
    for (const d of ['0101', '0102', '0103', '0104', '0105', '0106', '0107', '0108', '0109', '0110']) {
      const ourRow = findStartsWith(ours, d);
      const realRow = findStartsWith(real, d);
      expect(ourRow, `our render is missing designator ${d}`).toBeTruthy();
      expect(realRow, `real PDF is missing designator ${d}`).toBeTruthy();
      expect(ourRow!.x).toBeCloseTo(72, 0);
      expect(realRow!.x).toBeCloseTo(72, 0);
    }
  });

  it('body left margin sits at x=72 in both documents', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);
    const ourBody = findIncludes(ours, 'To establish and provide guidance');
    const realBody = findIncludes(real, 'To establish and provide guidance');
    expect(ourBody, 'our render is missing the 0101 body text').toBeTruthy();
    expect(realBody, 'real PDF is missing the 0101 body text').toBeTruthy();
    expect(ourBody!.x).toBeCloseTo(72, 0);
    expect(realBody!.x).toBeCloseTo(72, 0);
  });

  it('running-head right block ("MCO 5800.16" + "V17") is present on body pages in both, y within 6pt', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);

    const ourDesignator = findIncludes(ours, 'MCO 5800.16');
    const realDesignator = findIncludes(real, 'MCO 5800.16');
    expect(ourDesignator, 'our render is missing the running-head designator').toBeTruthy();
    expect(realDesignator, 'real PDF is missing the running-head designator').toBeTruthy();
    expect(Math.abs(ourDesignator!.y - realDesignator!.y)).toBeLessThanOrEqual(6);

    expect(findIncludes(ours, 'V17'), 'our render is missing "V17"').toBeTruthy();
    const realVolumeTag = real.find(r => r.text === 'V17');
    expect(realVolumeTag, 'real PDF is missing a "V17" running-head chunk on a body page').toBeTruthy();
  });

  it('center running head ("LEGAL SUPPORT AND ADMINISTRATION MANUAL") is present in both, y within 6pt', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);
    const ourCenter = findIncludes(ours, 'LEGAL SUPPORT AND ADMINISTRATION MANUAL');
    const realCenter = findIncludes(real, 'LEGAL SUPPORT AND ADMINISTRATION MANUAL');
    expect(ourCenter, 'our render is missing the center running head').toBeTruthy();
    expect(realCenter, 'real PDF is missing the center running head').toBeTruthy();
    expect(Math.abs(ourCenter!.y - realCenter!.y)).toBeLessThanOrEqual(6);
  });

  it('title page uses a roman numeral footer in both documents', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);
    expect(ours.some(r => r.y < 45 && r.text.trim() === 'i')).toBe(true);
    expect(real.some(r => r.y < 45 && r.text.trim() === 'i')).toBe(true);
  });

  /**
   * Fix round 1 (controller ruling): Vol 6 prints bare sequential body
   * numbers and Vol 17 prints chapter-page style ("1-1".."1-4") despite
   * both having a single chapter - the source volumes are genuinely
   * inconsistent, which is exactly what the `pageBand` field is for. Vol
   * 17's fixture now sets `pageBand: 'chapter-page'` explicitly (the
   * `auto` heuristic itself, which Vol 6's fidelity fixture depends on, is
   * unchanged). This test reads the real footer labels off the extraction
   * rows (not a hardcoded list) and asserts our render uses the same
   * scheme with the same labels.
   */
  it('body-page footers use the same chapter-page scheme, with the same labels, in both documents', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);

    const ourChapterPageFooters = footerLabels(ours).filter(l => /^\d+-\d+$/.test(l)).sort();
    const realChapterPageFooters = footerLabels(real).filter(l => /^\d+-\d+$/.test(l)).sort();

    expect(ourChapterPageFooters.length, 'our render has no chapter-page footers').toBeGreaterThan(0);
    expect(realChapterPageFooters.length, 'real PDF has no chapter-page footers').toBeGreaterThan(0);
    expect(ourChapterPageFooters).toEqual(realChapterPageFooters);
  });

  /**
   * Fix round 1 (controller ruling): the real PDF places a blank-line gap
   * between paragraphs within one section body (measured ~25.3pt, i.e. one
   * extra LEADING on top of the ordinary line step - see
   * INTER_PARAGRAPH_GAP's doc comment in lib/volume/layout.ts for the full
   * measurement). Section 0102 has two paragraphs in both documents, so its
   * paragraph-break y-gap is directly comparable.
   */
  it('the inter-paragraph gap in section 0102 matches the real PDF within 2pt', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);

    const ourEnd = findIncludes(ours, 'and renames this award the Brigadier General Michael E. Rich');
    const ourStart = findIncludes(ours, 'Each Regional Trial Counsel (RTC) will nominate');
    const realEnd = findIncludes(real, 'and renames this award the Brigadier General Michael E. Rich');
    const realStart = findIncludes(real, 'Each Regional Trial Counsel (RTC) will nominate');
    expect(ourEnd, 'our render is missing the end of 0102 paragraph 1').toBeTruthy();
    expect(ourStart, 'our render is missing the start of 0102 paragraph 2').toBeTruthy();
    expect(realEnd, 'real PDF is missing the end of 0102 paragraph 1').toBeTruthy();
    expect(realStart, 'real PDF is missing the start of 0102 paragraph 2').toBeTruthy();

    const ourGap = ourEnd!.y - ourStart!.y;
    const realGap = realEnd!.y - realStart!.y;
    expect(Math.abs(ourGap - realGap), `our gap ${ourGap} vs real gap ${realGap}`).toBeLessThanOrEqual(2);
  });

  it('title-page summary block lines are present in both documents', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);
    for (const needle of ['VOLUME 17', 'SUMMARY OF VOLUME 17 CHANGES', 'CANCELLATION', 'MCO 1650.62', 'DISTRIBUTION', 'PCN 10209190801']) {
      expect(findIncludes(ours, needle), `our render is missing "${needle}"`).toBeTruthy();
      expect(findIncludes(real, needle), `real PDF is missing "${needle}"`).toBeTruthy();
    }
  });

  /**
   * Task 23 fix 2: the real PDF wraps the title page's first boilerplate
   * paragraph's first line at "...unless/until a", pushing "full revision
   * of the MCO has been conducted." onto line 2 - ours used to fit "full"
   * onto line 1 too (wrapping at the box's full, un-inset interior width).
   * Reconstructing the whole physical line (joining every text-showing
   * operation at that line's y, per `lineTextAtY`) and comparing it verbatim
   * between the two documents catches ANY wrap-point mismatch, not just
   * this one - a looser prefix/substring check could pass even if the wrap
   * point drifted back.
   */
  it('Task 23 fix 2: the first boilerplate paragraph wraps at the same word in both documents', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);

    const ourAnchor = findIncludes(ours, 'The original publication date of');
    const realAnchor = findIncludes(real, 'The original publication date of');
    expect(ourAnchor, 'our render is missing the first boilerplate paragraph').toBeTruthy();
    expect(realAnchor, 'real PDF is missing the first boilerplate paragraph').toBeTruthy();

    // Both strings' whitespace is collapsed before comparing: pypdf's
    // visitor strips() each individual text-showing operation, and the real
    // PDF splits this line into several such operations (kerning/style
    // boundaries) - one of them is a lone space between two word chunks,
    // which strip() reduces to '' and the extraction drops entirely. Ours
    // paints the whole line as one operation, so its internal spaces
    // survive untouched. The word-boundary content (what actually matters -
    // whether the wrap fell before or after "full") is unaffected either
    // way.
    const ourLine1 = lineTextAtY(ours, ourAnchor!.page, ourAnchor!.y).replace(/\s+/g, '');
    const realLine1 = lineTextAtY(real, realAnchor!.page, realAnchor!.y).replace(/\s+/g, '');
    expect(ourLine1).toBe(realLine1);
    // Guards against a vacuous pass (e.g. both empty/truncated): the wrap
    // must land after "...unless/until a", not after "...a full".
    expect(ourLine1.endsWith('a')).toBe(true);
    expect(ourLine1).not.toContain('full');
  });

  /**
   * Task 23 fix 1: one blank line of padding between the title page's
   * bordered box's TOP edge and "VOLUME {n}"'s baseline - measured directly
   * against the real PDF's content stream (`re [73.224, 466.39, 465.7,
   * 239.66]` on page index 0; top = 466.39 + 239.66 = 706.06 - see
   * layout.ts's Task 23 fix 1 doc comment for the full derivation). The box
   * itself paints no extractable text (measure-pdf.py only sees text-showing
   * operations), so our own box's yTop comes straight from `layoutVolume`'s
   * output instead of the exported PDF; the real box top is this measured
   * constant.
   */
  it('Task 23 fix 1: the box-top-to-"VOLUME{n}" gap matches the real PDF within 3pt', async () => {
    const REAL_BOX_TOP_Y = 706.06;
    const real = measureFile(REAL_PDF);
    const realVolumeLine = findIncludes(real, 'VOLUME 17');
    expect(realVolumeLine, 'real PDF is missing "VOLUME 17"').toBeTruthy();
    const realGap = REAL_BOX_TOP_Y - realVolumeLine!.y;

    const items = ourTitlePageItems();
    const ourBox = items.find((i): i is Extract<typeof i, { kind: 'box' }> => i.kind === 'box');
    const ourVolumeLine = items.find(
      (i): i is Extract<typeof i, { kind: 'line' | 'heading' }> =>
        (i.kind === 'line' || i.kind === 'heading') && i.segments.some(s => s.text === 'VOLUME 17'),
    );
    expect(ourBox, 'our layout is missing the title-page box').toBeTruthy();
    expect(ourVolumeLine, 'our layout is missing the "VOLUME 17" line').toBeTruthy();
    const ourGap = ourBox!.yTop - ourVolumeLine!.y;

    expect(Math.abs(ourGap - realGap)).toBeLessThanOrEqual(3);
  });

  /**
   * Task 20: weight-fidelity parity - the real Vol 17 PDF paints "VOLUME
   * 17", the hyperlink legend's styled phrase (bold-ITALIC specifically),
   * "CANCELLATION", and the change-table headers all bold; body text (and,
   * per the same measurement, Vol 17's own body-section headings) stays
   * regular. Both documents must agree on which is which - not just that
   * the text is present (see the section above).
   */
  it('Task 20: our render matches the real PDF\'s bold/italic weighting on the title page', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);

    for (const [needle, expectBold, expectItalic] of [
      ['VOLUME 17', true, false],
      ['bold, italic, blue and underlined font', true, true],
      ['CANCELLATION', true, false],
    ] as const) {
      const ourRow = findIncludes(ours, needle);
      const realRow = findIncludes(real, needle);
      expect(ourRow, `our render is missing "${needle}"`).toBeTruthy();
      expect(realRow, `real PDF is missing "${needle}"`).toBeTruthy();
      expect(isBoldFont(ourRow!.font), `our "${needle}" bold=${isBoldFont(ourRow!.font)}`).toBe(expectBold);
      expect(isBoldFont(realRow!.font), `real "${needle}" bold=${isBoldFont(realRow!.font)}`).toBe(expectBold);
      expect(isItalicFont(ourRow!.font)).toBe(expectItalic);
      expect(isItalicFont(realRow!.font)).toBe(expectItalic);
    }

    const ourHeader = ours.find(r => r.text === 'VOLUME' || r.text === 'VOLUME VERSION');
    const realHeader = real.find(r => r.text === 'VOLUME' || r.text === 'VOLUME VERSION');
    expect(ourHeader, 'our render is missing the change-table header cell').toBeTruthy();
    expect(realHeader, 'real PDF is missing the change-table header cell').toBeTruthy();
    expect(isBoldFont(ourHeader!.font)).toBe(true);
    expect(isBoldFont(realHeader!.font)).toBe(true);

    const ourBody = findIncludes(ours, 'To establish and provide guidance');
    const realBody = findIncludes(real, 'To establish and provide guidance');
    expect(ourBody, 'our render is missing the 0101 body text').toBeTruthy();
    expect(realBody, 'real PDF is missing the 0101 body text').toBeTruthy();
    expect(isBoldFont(ourBody!.font)).toBe(false);
    expect(isBoldFont(realBody!.font)).toBe(false);
  });

  /**
   * Task 22: Appendix A fidelity against the real PDF - "A-1"/"A-2" footers
   * present in both, and the glossary's term/definition columns within 3pt
   * of the real measured x's (GLOSSARY_TERM_X=77.4, GLOSSARY_DEF_X=185.3 in
   * lib/volume/layout.ts - measured directly off this same real PDF, page
   * index 8, via fontmap.py).
   */
  it('Task 22: our render\'s Appendix A footers and glossary columns match the real PDF', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);

    const ourLabels = footerLabels(ours);
    const realLabels = footerLabels(real);
    expect(ourLabels).toContain('A-1');
    expect(realLabels).toContain('A-1');
    expect(ourLabels).toContain('A-2');
    expect(realLabels).toContain('A-2');

    const ourTerm = findStartsWith(ours, 'ABA');
    const realTerm = findStartsWith(real, 'ABA');
    expect(ourTerm, 'our render is missing the "ABA" glossary term').toBeTruthy();
    expect(realTerm, 'real PDF is missing the "ABA" glossary term').toBeTruthy();
    expect(Math.abs(ourTerm!.x - realTerm!.x)).toBeLessThanOrEqual(3);

    // See the identical disambiguation note above - "American Bar
    // Association" also appears in section 0110's body prose at x=72.
    const ourDef = ours.find(r => r.text.includes('American Bar Association') && r.x > 150);
    const realDef = real.find(r => r.text.includes('American Bar Association') && r.x > 150);
    expect(ourDef, 'our render is missing the "ABA" glossary definition').toBeTruthy();
    expect(realDef, 'real PDF is missing the "ABA" glossary definition').toBeTruthy();
    expect(Math.abs(ourDef!.x - realDef!.x)).toBeLessThanOrEqual(3);
  });

  it('Task 22: TOC "APPENDICES" header and appendix entry are present in both documents', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);

    expect(ours.some(r => r.text === 'APPENDICES')).toBe(true);
    expect(real.some(r => r.text === 'APPENDICES')).toBe(true);
    expect(findIncludes(ours, 'GLOSSARY OF ACRONYMS AND ABBREVIATIONS')).toBeTruthy();
    expect(findIncludes(real, 'GLOSSARY OF ACRONYMS AND ABBREVIATIONS')).toBeTruthy();
  });

  // Task 25 fix 2: bold/regular weight parity for the References page's own
  // heading, matching the real PDF (fontmap.py, page index 2, y=691.4).
  it('Task 25 fix 2: "REFERENCES" heading bold weight matches the real PDF', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);
    const ourHeading = ours.find(r => r.text === 'REFERENCES');
    const realHeading = real.find(r => r.text === 'REFERENCES');
    expect(ourHeading, 'our render is missing the "REFERENCES" heading').toBeTruthy();
    expect(realHeading, 'real PDF is missing the "REFERENCES" heading').toBeTruthy();
    expect(isBoldFont(ourHeading!.font)).toBe(true);
    expect(isBoldFont(realHeading!.font)).toBe(true);
  });

  // Task 25 fix 3: neither document quotes the chapter divider's title
  // (Vol 17's `titleQuoted: false`) - measured directly against the real
  // chapter divider (fontmap.py, page index 3): "JUDGE ADVOCATE DIVISION
  // AWARDS PROGRAM" prints with no quote glyphs.
  it('Task 25 fix 3: neither document quotes the chapter divider title', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);
    const ourTitle = findIncludes(ours, 'JUDGE ADVOCATE DIVISION AWARDS PROGRAM');
    const realTitle = findIncludes(real, 'JUDGE ADVOCATE DIVISION AWARDS PROGRAM');
    expect(ourTitle, 'our render is missing the chapter divider title').toBeTruthy();
    expect(realTitle, 'real PDF is missing the chapter divider title').toBeTruthy();
    expect(ourTitle!.text).not.toContain('"');
    expect(realTitle!.text).not.toContain('"');
  });

  /**
   * Task 25 fix 4: the chapter divider's change table has the same number of
   * row-boundary lines (header + data rows) in both documents - 6 in the
   * real PDF (a 2-line header + 4 blank data rows; see
   * lib/volume/layout.ts's `dividerChangeRows` doc comment for the
   * content-stream-level measurement). The page index and y-window are
   * located dynamically (the header cell text "CHAPTER", the box's
   * boilerplate ends well above y=520 in both documents, and neither
   * document has any other content below the table before its footer) so
   * this isn't hostage to either renderer's own page-numbering scheme.
   */
  it('Task 25 fix 4: the chapter divider table has the same row-rule count as the real PDF', async () => {
    const ourPath = await ourPdfPath();
    const ours = measureFile(ourPath);
    const real = measureFile(REAL_PDF);

    const ourDividerHeader = ours.find(r => r.text === 'CHAPTER');
    const realDividerHeader = real.find(r => r.text === 'CHAPTER');
    expect(ourDividerHeader, 'our render is missing the divider table\'s "CHAPTER" header cell').toBeTruthy();
    expect(realDividerHeader, 'real PDF is missing the divider table\'s "CHAPTER" header cell').toBeTruthy();

    const ourCount = countRowBoundaries(ourPath, ourDividerHeader!.page, 200, 520);
    const realCount = countRowBoundaries(REAL_PDF, realDividerHeader!.page, 200, 520);
    expect(realCount, 'sanity: real PDF row count').toBe(6);
    expect(ourCount).toBe(realCount);
  });

  /**
   * Task 25 fix 5: the divider's first boilerplate paragraph wraps at the
   * same word in both documents - mirrors the title page's identical Task 23
   * fix 2 test above, but for the divider's own (longer) boilerplate text
   * and its narrower `DIVIDER_BOILERPLATE_INSET` wrap width.
   */
  it('Task 25 fix 5: the divider\'s first boilerplate paragraph wraps at the same word in both documents', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);

    // The title page's OWN first boilerplate paragraph also starts "The
    // original publication..." (VOLUME_CHANGE_POLICY_BOILERPLATE), so a
    // bare `findIncludes` could match that page instead of the divider's -
    // scope the search to the divider's own page (located via its table's
    // "CHAPTER" header cell, unique to the divider).
    const ourDividerPage = ours.find(r => r.text === 'CHAPTER')?.page;
    const realDividerPage = real.find(r => r.text === 'CHAPTER')?.page;
    expect(ourDividerPage, 'our render is missing the divider table').toBeDefined();
    expect(realDividerPage, 'real PDF is missing the divider table').toBeDefined();

    // A short anchor: the real PDF splits this line into several
    // text-showing chunks (kerning boundaries), and "The original
    // publication" is reliably its own first chunk on both documents (see
    // `lineTextAtY`'s doc comment for why the FULL line is reconstructed
    // separately below rather than matched in one call).
    const ourAnchor = ours.find(r => r.page === ourDividerPage && r.text.includes('The original publication'));
    const realAnchor = real.find(r => r.page === realDividerPage && r.text.includes('The original publication'));
    expect(ourAnchor, 'our render is missing the divider\'s first boilerplate paragraph').toBeTruthy();
    expect(realAnchor, 'real PDF is missing the divider\'s first boilerplate paragraph').toBeTruthy();

    const ourLine1 = lineTextAtY(ours, ourAnchor!.page, ourAnchor!.y).replace(/\s+/g, '');
    const realLine1 = lineTextAtY(real, realAnchor!.page, realAnchor!.y).replace(/\s+/g, '');
    expect(ourLine1).toBe(realLine1);
    // Guards against a vacuous pass: the wrap must land after "(right
    // header)", not spill "will" onto the same line.
    expect(ourLine1.endsWith('header)')).toBe(true);
    expect(ourLine1).not.toContain('will');
  });

  /**
   * Task 26: the real Vol 17 PDF has exactly ONE references page (the list
   * only - no second quoted-heading "REFERENCES" summary page, unlike Vol 1
   * which has both). The fixture now sets `referencesSummaryPage: false` to
   * match, so the REF band's page count must be equal in both documents
   * (both should be 1, but this compares directly rather than hardcoding it
   * so a real-PDF re-measurement can't silently drift from the assertion).
   */
  it('Task 26: the REF band has the same page count in both documents', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);

    const ourRefLabels = footerLabels(ours).filter(l => /^REF-\d+$/.test(l));
    const realRefLabels = footerLabels(real).filter(l => /^REF-\d+$/.test(l));
    expect(ourRefLabels.length, 'our render has no REF-band pages').toBeGreaterThan(0);
    expect(realRefLabels.length, 'real PDF has no REF-band pages').toBeGreaterThan(0);
    expect(ourRefLabels.length).toBe(realRefLabels.length);
    expect(ourRefLabels.length).toBe(1);
  });

  // Task 27 fix 1: one blank line between the "REFERENCES" heading and the
  // first "(a)" entry - matches the real PDF's measured 30.0pt gap
  // (691.4 -> 661.4) within 2pt. See REFERENCES_HEADING_GAP_EXTRA's doc
  // comment in lib/volume/layout.ts for the full measurement (the
  // references list's own line-to-line leading is looser than the body
  // chapter's, so this isn't simply `2 * LEADING`).
  //
  // "REFERENCES" also appears (bold, per Task 24) as the TOC's own entry
  // label, on an earlier page - both documents' row lists put that TOC row
  // before the actual references-page heading, so a bare `.find` picks the
  // wrong one. Disambiguated by requiring the heading candidate to share its
  // PAGE with the unambiguous "(a)" first-entry anchor.
  it('Task 27 fix 1: the "REFERENCES" heading-to-first-entry gap matches the real PDF within 2pt', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);

    const ourFirstEntry = findStartsWith(ours, '(a)');
    const realFirstEntry = findStartsWith(real, '(a)');
    expect(ourFirstEntry, 'our render is missing the first "(a)" reference entry').toBeTruthy();
    expect(realFirstEntry, 'real PDF is missing the first "(a)" reference entry').toBeTruthy();

    const ourHeading = ours.find(r => r.text === 'REFERENCES' && r.page === ourFirstEntry!.page);
    const realHeading = real.find(r => r.text === 'REFERENCES' && r.page === realFirstEntry!.page);
    expect(ourHeading, 'our render is missing the "REFERENCES" heading on the references page').toBeTruthy();
    expect(realHeading, 'real PDF is missing the "REFERENCES" heading on the references page').toBeTruthy();

    const ourGap = ourHeading!.y - ourFirstEntry!.y;
    const realGap = realHeading!.y - realFirstEntry!.y;
    expect(Math.abs(ourGap - realGap), `our gap ${ourGap} vs real gap ${realGap}`).toBeLessThanOrEqual(2);
  });

  // Task 27 fix 2: the chapter title page's title paints bold in both
  // documents (weight parity, mirroring the Task 20 bold-weight tests
  // above) - the underline itself is a filled rect, not extractable text, so
  // it's covered separately by the non-real-PDF "blank line + bold +
  // underlined" test above, which reads the underline flag straight off our
  // own layout output.
  it('Task 27 fix 2: the chapter title page\'s title is bold in both documents', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);
    const ourTitle = findIncludes(ours, 'JUDGE ADVOCATE DIVISION AWARDS PROGRAM');
    const realTitle = findIncludes(real, 'JUDGE ADVOCATE DIVISION AWARDS PROGRAM');
    expect(ourTitle, 'our render is missing the chapter title').toBeTruthy();
    expect(realTitle, 'real PDF is missing the chapter title').toBeTruthy();
    expect(isBoldFont(ourTitle!.font)).toBe(true);
    expect(isBoldFont(realTitle!.font)).toBe(true);
  });

  // Task 27 fix 3: the section-heading-to-body gap (0101 "PURPOSE" heading
  // to its first body line) matches the real PDF within 2pt - mirrors the
  // existing "inter-paragraph gap in section 0102" test's pattern above.
  //
  // The real PDF's TOC also splits its "0101. PURPOSE" entry into separate
  // "0101"/"."/"PURPOSE" text-showing chunks (unlike ours, which paints that
  // entry as one contiguous string), so a bare `.find(text==='PURPOSE')`
  // picks the TOC's fragment there instead of the body heading. Disambiguated
  // the same way as fix 1 above: require the heading candidate to share its
  // PAGE with the unambiguous body-text anchor.
  it('Task 27 fix 3: the "0101. PURPOSE" heading-to-body gap matches the real PDF within 2pt', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);

    const ourBody = findIncludes(ours, 'To establish and provide guidance');
    const realBody = findIncludes(real, 'To establish and provide guidance');
    expect(ourBody, 'our render is missing the 0101 body text').toBeTruthy();
    expect(realBody, 'real PDF is missing the 0101 body text').toBeTruthy();

    const ourHeading = ours.find(r => r.text === 'PURPOSE' && r.page === ourBody!.page);
    const realHeading = real.find(r => r.text === 'PURPOSE' && r.page === realBody!.page);
    expect(ourHeading, 'our render is missing the "PURPOSE" heading on the body page').toBeTruthy();
    expect(realHeading, 'real PDF is missing the "PURPOSE" heading on the body page').toBeTruthy();

    const ourGap = ourHeading!.y - ourBody!.y;
    const realGap = realHeading!.y - realBody!.y;
    expect(Math.abs(ourGap - realGap), `our gap ${ourGap} vs real gap ${realGap}`).toBeLessThanOrEqual(2);
  });
});
