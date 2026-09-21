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

interface MeasuredRow { page: number; x: number; y: number; size: number; text: string }

function measureFile(pdfPath: string): MeasuredRow[] {
  const out = execFileSync('python', [join(__dirname, 'measure-pdf.py'), pdfPath]).toString();
  return JSON.parse(out) as MeasuredRow[];
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
});
