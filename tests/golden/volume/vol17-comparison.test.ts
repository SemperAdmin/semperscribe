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

async function ourRows(): Promise<MeasuredRow[]> {
  const doc = VolumeSchema.parse(JSON.parse(readFileSync(join(__dirname, 'fixtures', 'vol17.json'), 'utf8')));
  const blob = await generateVolumePdf(doc);
  const dir = mkdtempSync(join(tmpdir(), 'vol17-'));
  const pdf = join(dir, 'v.pdf');
  writeFileSync(pdf, Buffer.from(await blob.arrayBuffer()));
  return measureFile(pdf);
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
});
