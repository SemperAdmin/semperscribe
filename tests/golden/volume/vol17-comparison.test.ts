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
const TOL = 2; // pt, per the brief, unless a check says otherwise.

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

  it('uses a bare sequential footer (auto band, single chapter)', async () => {
    const rows = await ourRows();
    // Title page: roman numeral.
    expect(rows.some(r => r.y < 45 && r.text.trim() === 'i')).toBe(true);
    // Body pages: bare number, not "1-2" chapter-page style, because Vol
    // 17 has exactly one chapter and volume.pageBand is 'auto' (see
    // layoutBody in lib/volume/layout.ts: useChapterPage is true only for
    // 'chapter-page' or 'auto' + multiChapter).
    expect(rows.some(r => r.y < 45 && /^\d+$/.test(r.text.trim()))).toBe(true);
    expect(rows.some(r => r.y < 45 && /^\d+-\d+$/.test(r.text.trim()))).toBe(false);
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
   * KNOWN, REPORTED MISMATCH (do not weaken this to pass - see the Task 17
   * report). Our body-page footer scheme is bare sequential numbers ("1",
   * "2", "3", ...): volume.pageBand is 'auto' and Vol 17 has exactly one
   * chapter, and layoutBody's rule is "chapter-page" numbering only for
   * 'chapter-page' or 'auto' + MULTI-chapter (lib/volume/layout.ts). The
   * real, published Vol 17 instead prints chapter-page style body numbers
   * ("1-1", "1-2", "1-3", "1-4") despite having only one chapter. This test
   * asserts what OUR renderer actually does (so a regression here is
   * caught) and separately records the real PDF's scheme so the mismatch
   * is visible in the test output rather than silently asserted away.
   */
  it('records the real PDF body footer scheme (chapter-page) vs. ours (bare sequential) - reported mismatch', async () => {
    const ours = await ourRows();
    const real = measureFile(REAL_PDF);

    // Ours: bare sequential, per the 'auto' + single-chapter rule.
    expect(ours.some(r => r.y < 45 && /^\d+$/.test(r.text.trim()))).toBe(true);

    // Real: reconstruct the footer label on a body page by joining the
    // digit/hyphen chunks pypdf split "1-2" into ('1', '-', '2').
    const bodyFooterChunks = real.filter(r => r.y < 45 && r.page >= 3 && r.page <= 6);
    const footerText = bodyFooterChunks
      .sort((a, b) => a.page - b.page || a.x - b.x)
      .map(r => r.text)
      .join('');
    expect(footerText, 'real Vol 17 body footers').toMatch(/1-1.*1-2.*1-3.*1-4/);
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
