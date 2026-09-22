import type { Block, Chapter, Figure, Paragraph, Run, Section, SubPara, VolumeDoc } from '@/lib/schemas/volume-schema';
import { correspondenceDesignator, paragraphDesignator, referenceDesignator, sectionDesignator, subParaDesignator } from '@/lib/volume/designators';
import { designatorX, RUNOVER_X, textStartX } from '@/lib/volume/volume-indent';
import { bodyPageLabel, refPageLabel, toRoman } from '@/lib/volume/page-bands';
import { measureText, wrapPlainText, wrapRuns, type WrappedSegment } from '@/lib/volume/measure';

// ---------------------------------------------------------------------------
// Page geometry (US Letter, 1" margins).
// ---------------------------------------------------------------------------
export const PAGE_W = 612;
export const PAGE_H = 792;
export const MARGIN = 72;
/** First body line sits below the running head. */
export const TOP_TEXT_Y = PAGE_H - MARGIN - 24;
export const BOTTOM_Y = MARGIN;
export const LEADING = 12.6;
export const GAP = 25;
export const RIGHT_EDGE = PAGE_W - MARGIN;
export const CENTER_X = PAGE_W / 2;

/**
 * The extra vertical space inserted between two consecutive body `Block`s
 * within the same section/paragraph/sub-para body (i.e. a real paragraph
 * break within one designated item), on top of the ordinary `LEADING` step
 * that already separates any two lines.
 *
 * Task 17 fix round 1: measured directly from the real MCO 5800.16 Vol 17
 * PDF (four samples, sections 0102/0108/0109/0110 - the last line of one
 * paragraph to the first line of the next): y-deltas of 25.3, 25.4, 25.3,
 * 25.3pt (avg 25.325pt). That is, within measurement/font-metric rounding,
 * exactly `2 * LEADING` (25.2pt) - one blank line - not the larger `GAP`
 * (25pt is coincidentally close in magnitude to `2 * LEADING`, but `GAP` is
 * used for structural spacing - between a table and the text before/after
 * it, before a figure, etc. - not for prose paragraph breaks). So the
 * ADDITIONAL space needed on top of the LEADING step already taken between
 * any two lines is one more LEADING: `25.325 - 12.6 ≈ 12.7 ≈ LEADING`.
 */
export const INTER_PARAGRAPH_GAP = LEADING;

const BODY_SIZE_PT = 11;
const HEADING_SIZE_PT = 12;

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------
export interface LineItem {
  kind: 'line';
  x: number;
  y: number;
  segments: WrappedSegment[];
  sizePt: number;
}
export interface HeadingItem {
  kind: 'heading';
  x: number;
  y: number;
  segments: WrappedSegment[];
  sizePt: number;
}
export interface FigureItem {
  kind: 'figure';
  x: number;
  y: number;
  width: number;
  height: number;
  figureNumber: number;
  image: string;
}
export interface TableItem {
  kind: 'table';
  x: number;
  y: number;
  width: number;
  colWidths: number[];
  /** Header cells, each already word-wrapped to fit its column width. */
  headerLines: string[][];
  headerHeight: number;
  /** Data rows, each cell already word-wrapped to fit its column width. */
  rows: string[][][];
  rowHeights: number[];
  /**
   * Task 20: per-row, per-column shading flags (parallel to `rows`), used by
   * the title-page change table's 3 blank rows below the ORIGINAL row - the
   * real Vol 17 PDF fills their ORIGINATION DATE cell light gray (~0.85
   * gray). `undefined` (or a row with no `true` entries) paints normally.
   */
  rowShading?: (boolean[] | undefined)[];
}
/**
 * Task 20: an unfilled bordered rectangle - real Vol 17's title page and
 * chapter divider box the whole "VOLUME {n} .. CANCELLATION" text block in
 * one outer rectangle, with the change table's own top border immediately
 * below it (no visible gap - see layoutTitlePage/layoutChapterDivider). This
 * is a pure overlay: it doesn't consume cursor space, so it never affects
 * pagination/wrapping of anything else on the page.
 */
export interface BoxItem {
  kind: 'box';
  x: number;
  yTop: number;
  yBottom: number;
  width: number;
}
export type PaintItem = LineItem | HeadingItem | FigureItem | TableItem | BoxItem;

export interface Page {
  label: string;
  band: 'front' | 'ref' | 'body';
  chapter?: number;
  items: PaintItem[];
}
export interface TocEntry {
  label: string;
  page: string;
  level: number;
}
export interface LaidOutDoc {
  pages: Page[];
  toc: TocEntry[];
}

// ---------------------------------------------------------------------------
// Change-table cell wrapping/row-height math, shared by PageCursor.addTable
// below AND (Task 20) by layoutTitlePage/layoutChapterDivider, which need to
// know a table's HEADER height up front - before calling addTable - to size
// the gap that puts the bordered box's bottom edge just above the table's
// own top border without the two overlapping (see BoxItem's doc comment).
// ---------------------------------------------------------------------------
const TABLE_SIZE_PT = 11;
const TABLE_CELL_PAD_X = 4;
function wrapTableCell(text: string, colWidth: number, bold = false): string[] {
  return wrapPlainText(String(text ?? ''), Math.max(colWidth - TABLE_CELL_PAD_X * 2, 1), TABLE_SIZE_PT, bold);
}
function tableRowHeight(cellLines: string[][]): number {
  return Math.max(1, ...cellLines.map(lines => lines.length)) * LEADING + 6;
}
/** The rendered height of `cols`' header row (always bold - see addTable). */
export function tableHeaderHeight(cols: string[], colWidths: number[]): number {
  return tableRowHeight(cols.map((c, i) => wrapTableCell(c, colWidths[i] ?? 0, true)));
}

// ---------------------------------------------------------------------------
// PageCursor: accumulates PaintItems onto pages, paginating on overflow.
// ---------------------------------------------------------------------------
class PageCursor {
  pages: Page[] = [];
  private current: Page;
  private y = TOP_TEXT_Y;
  private labelFn: () => string;
  private band: Page['band'];
  private chapter?: number;

  constructor(band: Page['band'], labelFn: () => string, chapter?: number) {
    this.band = band;
    this.chapter = chapter;
    this.labelFn = labelFn;
    this.current = { label: labelFn(), band, chapter, items: [] };
  }

  private newPage() {
    // Finding 5: guard against emitting an empty page. Every call site below
    // (ensureRoom, breakPage, addTable's pagination) may invoke newPage()
    // when the current page has not yet received any items (e.g. a fresh
    // page whose very first item still doesn't fit some conservative
    // estimate). Pushing `this.current` unconditionally in that case would
    // insert a blank page into the document; instead, just reset `y` and
    // keep accumulating onto the same (still-empty) page.
    if (this.current.items.length === 0) {
      this.y = TOP_TEXT_Y;
      return;
    }
    this.pages.push(this.current);
    this.current = { label: this.labelFn(), band: this.band, chapter: this.chapter, items: [] };
    this.y = TOP_TEXT_Y;
  }

  /** Ensure there is room for one more line before appending. */
  private ensureRoom() {
    if (this.y < BOTTOM_Y + LEADING) this.newPage();
  }

  /** Force the next content onto a fresh page (no-op if current page is empty). */
  breakPage() {
    if (this.current.items.length > 0) this.newPage();
  }

  currentLabel(): string {
    return this.current.label;
  }

  /** The y-coordinate the NEXT item would be painted at (before it's added). */
  currentY(): number {
    return this.y;
  }

  /**
   * An unfilled bordered rectangle, painted as a pure overlay (see BoxItem's
   * doc comment) - callers capture `yTop`/`yBottom` via `currentY()` around
   * whatever content the box should enclose.
   */
  addBox(yTop: number, yBottom: number, x = MARGIN, width = RIGHT_EDGE - MARGIN) {
    this.current.items.push({ kind: 'box', x, yTop, yBottom, width });
  }

  /** A single flush line, e.g. a plain body block with no designator. */
  addLines(lines: { segments: WrappedSegment[]; x: number }[], sizePt = BODY_SIZE_PT, kind: 'line' | 'heading' = 'line') {
    for (const line of lines) {
      this.ensureRoom();
      this.current.items.push({ kind, x: line.x, y: this.y, segments: line.segments, sizePt });
      this.y -= LEADING;
    }
  }

  /**
   * A designator + wrapped body sharing the designator's first line, per the
   * fixed ladder: designator at designatorX(level), first-line text at
   * textStartX(level, designator), every wrapped/run-over line back at the
   * left margin (RUNOVER_X). Not a hanging indent.
   */
  addDesignatedLines(
    designator: string,
    level: 1 | 2 | 3 | 4,
    bodyRuns: Run[],
    sizePt = BODY_SIZE_PT,
    kind: 'line' | 'heading' = 'line',
  ) {
    this.ensureRoom();
    const y = this.y;
    const dx = designatorX(level);
    this.current.items.push({
      kind,
      x: dx,
      y,
      segments: [{ text: designator, run: { text: designator } }],
      sizePt,
    });

    const firstLineX = textStartX(level, designator, sizePt);
    const lines = wrapRuns(bodyRuns, firstLineX, RUNOVER_X, RIGHT_EDGE, sizePt);
    if (lines.length === 0) {
      this.y -= LEADING;
      return;
    }
    // First wrapped line shares the designator's y.
    this.current.items.push({ kind, x: lines[0].x, y, segments: lines[0].segments, sizePt });
    this.y -= LEADING;
    for (let i = 1; i < lines.length; i++) {
      this.ensureRoom();
      this.current.items.push({ kind, x: lines[i].x, y: this.y, segments: lines[i].segments, sizePt });
      this.y -= LEADING;
    }
  }

  /**
   * A TOC line: label left at the margin (wrapped continuation indented
   * slightly under the title text, not back to the margin), a dotted leader,
   * and the page label right-aligned to RIGHT_EDGE.
   */
  addTocEntry(label: string, pageLabel: string, sizePt = BODY_SIZE_PT) {
    const reserveW = 70; // room for leader + page label on the last line
    const lines = wrapRuns([{ text: label }], MARGIN, MARGIN + 18, RIGHT_EDGE - reserveW, sizePt);
    if (lines.length === 0) lines.push({ segments: [], x: MARGIN });
    for (let i = 0; i < lines.length; i++) {
      this.ensureRoom();
      const y = this.y;
      const isLast = i === lines.length - 1;
      const lineText = lines[i].segments.map(s => s.text).join('');
      this.current.items.push({ kind: 'line', x: lines[i].x, y, segments: lines[i].segments, sizePt });
      if (isLast) {
        const endX = lines[i].x + measureText(lineText, sizePt);
        const pageW = measureText(pageLabel, sizePt);
        const targetX = RIGHT_EDGE - pageW;
        const dotWidth = measureText('.', sizePt);
        const gap = Math.max(0, targetX - endX - dotWidth);
        const dotCount = dotWidth > 0 ? Math.floor(gap / dotWidth) : 0;
        if (dotCount > 0) {
          const leader = ' ' + '.'.repeat(dotCount);
          this.current.items.push({
            kind: 'line', x: endX, y, sizePt,
            segments: [{ text: leader, run: { text: leader } }],
          });
        }
        this.current.items.push({
          kind: 'line', x: targetX, y, sizePt,
          segments: [{ text: pageLabel, run: { text: pageLabel } }],
        });
      }
      this.y -= LEADING;
    }
  }

  /**
   * A bordered grid: header row + data rows, painted by the PDF pass.
   *
   * Task 18 finding A: cell text used to paint at a fixed x with no
   * wrapping, so anything wider than its column ran straight across the
   * boundary into the next column (e.g. "VOLUME VERSION" bleeding into
   * "SUMMARY OF CHANGE"). Every cell is now word-wrapped to fit within its
   * own column width here at layout time, and each row's height grows to
   * fit the tallest cell in that row (the header row and data rows can
   * each have a different number of wrapped lines).
   *
   * Finding 5: this used to emit ONE atomic TableItem sized to the whole
   * table regardless of how much of the page remained, so a long change
   * log (e.g. a 60-row log) painted rows straight past the bottom margin
   * (negative y, off the physical page) instead of paginating. The table
   * now splits across as many TableItems/pages as it needs, repeating the
   * header row at the top of each page it spills onto.
   */
  addTable(cols: string[], colWidths: number[], rows: string[][], shading?: boolean[][]) {
    // Task 20: header cells now paint bold (see paintItem's 'table' case in
    // volumeGenerator.ts) - wrap them at bold widths too, or a header word
    // that just fits at regular width could overrun its column once painted
    // bold.
    const headerLines = cols.map((c, i) => wrapTableCell(c, colWidths[i] ?? 0, true));
    const headerHeight = tableRowHeight(headerLines);
    const rowsLines = rows.map(r => r.map((cell, i) => wrapTableCell(cell, colWidths[i] ?? 0)));
    const rowHeights = rowsLines.map(tableRowHeight);
    const width = colWidths.reduce((a, b) => a + b, 0);

    let idx = 0;
    do {
      // Start a fresh page for this chunk if the header alone won't fit
      // where we are AND this page already carries other content (never
      // force a blank page just to re-flow onto an identical empty one).
      if (this.y - headerHeight < BOTTOM_Y && this.current.items.length > 0) this.newPage();

      const chunkRows: string[][][] = [];
      const chunkHeights: number[] = [];
      const chunkShading: (boolean[] | undefined)[] = [];
      let used = headerHeight;
      while (idx < rowsLines.length) {
        const rowH = rowHeights[idx];
        // Always take at least one row per chunk (even if it alone
        // overflows the page) so a single oversized row can't loop forever.
        if (chunkRows.length > 0 && this.y - (used + rowH) < BOTTOM_Y) break;
        chunkRows.push(rowsLines[idx]);
        chunkHeights.push(rowH);
        chunkShading.push(shading?.[idx]);
        used += rowH;
        idx++;
      }

      const y = this.y;
      this.current.items.push({
        kind: 'table', x: MARGIN, y, width, colWidths,
        headerLines, headerHeight, rows: chunkRows, rowHeights: chunkHeights,
        rowShading: chunkShading.some(Boolean) ? chunkShading : undefined,
      });
      this.y -= used;

      if (idx < rowsLines.length) this.newPage();
    } while (idx < rowsLines.length);
  }

  addGap(gap = GAP) {
    this.y -= gap;
    if (this.y < BOTTOM_Y) this.newPage();
  }

  /**
   * A centered figure box, scaled to fit at layout time to the text width and
   * a fixed max height (or remaining page height if smaller). The painter
   * fits the actual image into this box preserving aspect ratio, since pixel
   * dimensions of a data-URL image aren't known here.
   */
  addFigure(image: string, figureNumber: number) {
    const maxHeight = 300;
    const minRoom = 120;
    if (this.y - BOTTOM_Y < minRoom) this.newPage();
    const available = this.y - BOTTOM_Y;
    const height = Math.min(maxHeight, available);
    const width = RIGHT_EDGE - MARGIN;
    const y = this.y - height;
    this.current.items.push({ kind: 'figure', x: MARGIN, y, width, height, figureNumber, image });
    this.y = y;
  }

  finish(): Page[] {
    if (this.current.items.length > 0 || this.pages.length === 0) this.pages.push(this.current);
    return this.pages;
  }
}

// ---------------------------------------------------------------------------
// Small text-layout helpers shared by front matter builders.
// ---------------------------------------------------------------------------
function centeredLine(text: string, sizePt = BODY_SIZE_PT): { segments: WrappedSegment[]; x: number }[] {
  return centeredRuns([{ text }], sizePt);
}
/**
 * Task 20: like `centeredLine`, but for a line built from several styled
 * `Run`s (e.g. the hyperlink legend's regular/bold-italic/bold segments) -
 * centered as ONE line, never wrapped, so its total width is measured
 * up-front (respecting each run's own `bold` hint - see measure.ts's
 * `wrapRuns` for why bold must use the bold-derived width table) rather than
 * going through wrapRuns.
 */
function centeredRuns(runs: Run[], sizePt = BODY_SIZE_PT): { segments: WrappedSegment[]; x: number }[] {
  const totalWidth = runs.reduce((w, r) => w + measureText(r.text, sizePt, !!r.bold), 0);
  return [{ segments: runs.map(r => ({ text: r.text, run: r })), x: CENTER_X - totalWidth / 2 }];
}
function leftParagraph(text: string, sizePt = BODY_SIZE_PT) {
  return leftParagraphRuns([{ text }], sizePt);
}
/** Like `leftParagraph`, but for a line built from several styled `Run`s. */
function leftParagraphRuns(runs: Run[], sizePt = BODY_SIZE_PT) {
  return wrapRuns(runs, MARGIN, MARGIN, RIGHT_EDGE, sizePt);
}

// ---------------------------------------------------------------------------
// Task 20: styled-run builders for the front matter's fixed literal text -
// measured directly against the real Vol 17 PDF (task-20-report.md). Kept
// alongside the plain-text *_TEXT/*_BOILERPLATE constants below (still
// exported verbatim for DOCX/tests that just need the plain string) rather
// than replacing them, per the same "single source of truth" pattern.
// ---------------------------------------------------------------------------

/**
 * The hyperlink legend, split into its three measured runs: regular lead-in,
 * a bold-italic-blue-underlined phrase (matching the format standard's own
 * description of what a hyperlink looks like), and a bold trailing period.
 * Concatenating every run's `text` reproduces `LEGEND_TEXT` exactly.
 */
export function legendRuns(): Run[] {
  return [
    { text: 'Hyperlinks are denoted by ' },
    { text: 'bold, italic, blue and underlined font', bold: true, italic: true, underline: true, color: 'blue' },
    { text: '.', bold: true },
  ];
}

/**
 * Styles a boilerplate line's fixed literal phrases: every "blue font"
 * occurrence paints blue, and (only where the caller says so - see the
 * measured difference between the title page's and the chapter divider's
 * copy of the same sentence, task-20-report.md) "full revision" is
 * underlined. Concatenating every returned run's `text` reproduces the
 * input `text` exactly.
 */
export function styleBoilerplateRuns(text: string, opts: { underlineFullRevision?: boolean } = {}): Run[] {
  const phrases: { phrase: string; style: Partial<Run> }[] = [{ phrase: 'blue font', style: { color: 'blue' } }];
  if (opts.underlineFullRevision) phrases.push({ phrase: 'full revision', style: { underline: true } });

  const pattern = new RegExp(`(${phrases.map(p => p.phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  const runs: Run[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    if (m.index > lastIndex) runs.push({ text: text.slice(lastIndex, m.index) });
    const matched = m[0];
    const found = phrases.find(p => p.phrase === matched);
    runs.push({ text: matched, ...(found?.style ?? {}) });
    lastIndex = m.index + matched.length;
  }
  if (lastIndex < text.length) runs.push({ text: text.slice(lastIndex) });
  return runs;
}

// Exported so other emitters (e.g. the DOCX generator, src/services/docx/volumeDocx.ts)
// can share these canonical strings as a single source of truth rather than
// duplicating them.
export const LEGEND_TEXT = 'Hyperlinks are denoted by bold, italic, blue and underlined font.';
// Canonical text transcribed verbatim from the published volumes — do not
// paraphrase; see task-10-report.md fix-round 1 for provenance.
export const VOLUME_CHANGE_POLICY_BOILERPLATE = [
  'The original publication date of this Marine Corps Order (right header) will not change unless/until a full revision of the MCO has been conducted.',
  'The date denoted by blue font (left header) will reflect the date this Volume was last updated.',
  'All Volume changes denoted in blue font will reset to black font upon a full revision of this Volume.',
];
export const CHAPTER_CHANGE_POLICY_BOILERPLATE = [
  'The original publication date of this Marine Corps Order (MCO) Volume (right header) will not change unless/until a full revision of the MCO has been conducted.',
  'All Volume changes denoted in blue font will reset to black font upon a full revision of this Volume.',
];
export const REFERENCES_SUMMARY_BOILERPLATE = [
  'As changes are made within this MCO Volume, the References list will also update.',
  'Annotation of each update/change/addition to the References list is required.',
  'The original publication date this MCO (right header) will not change unless/until a full revision of the MCO has been conducted.',
  'The date denoted by blue font (left header) will reflect the date these References were last updated as changes/revisions are made within this MCO.',
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/**
 * Normalizes an ISO (or already-formatted) date to the canonical `DD Mon
 * YYYY` the source volumes print (e.g. Vol 17's "10 Feb 2021"). Exported so
 * volumeGenerator.ts's running head can format `doc.volume.lastUpdatedDate`
 * the same way (Task 17 finding: the running head used to print the raw
 * `lastUpdatedDate` string, so an ISO-dated document printed "2021-02-10"
 * instead of "10 Feb 2021").
 */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return iso ?? '';
  const [, y, mo, d] = m;
  const monthIdx = Number(mo) - 1;
  if (monthIdx < 0 || monthIdx > 11) return iso;
  return `${Number(d)} ${MONTHS[monthIdx]} ${y}`;
}

/**
 * Task 20: the title-page change table's rows and gray-shading flags -
 * shared by the PDF (layoutTitlePage below) and DOCX (volumeDocx.ts's
 * buildTitlePageChildren) generators, per the same "single source of truth"
 * pattern LEGEND_TEXT/formatDate/runningHeadParts already use.
 *
 * Measured directly against the real Vol 17 PDF (task-20-report.md): with no
 * recorded changes yet, the table shows the synthesized ORIGINAL row
 * followed by exactly 3 blank rows, each with its ORIGINATION DATE cell
 * shaded light gray (~0.85 gray) - a fixed template for future changes to
 * be filled in by hand. Once a real changeLog exists, this volume-specific
 * template no longer applies (out of measured scope for a populated log),
 * so those rows print exactly as authored, unshaded.
 */
export function titlePageChangeRows(doc: VolumeDoc): { rows: string[][]; shading?: boolean[][] } {
  const v = doc.volume;
  if (doc.changeLog.length > 0) {
    return { rows: doc.changeLog.map(r => [r.version, r.summary, r.originationDate, r.dateOfChanges]) };
  }
  const seedRow = ['ORIGINAL VOLUME', 'N/A', formatDate(v.originalPublicationDate), 'N/A'];
  const blankRow = ['', '', '', ''];
  return {
    rows: [seedRow, blankRow, blankRow, blankRow],
    shading: [
      [false, false, false, false],
      [false, false, true, false],
      [false, false, true, false],
      [false, false, true, false],
    ],
  };
}

// ---------------------------------------------------------------------------
// Shared running-head / footer composition (Finding 3).
//
// Before this, volumeGenerator.ts's `paintTemplate` and volumeDocx.ts's
// `buildChapterHeader`/`buildChapterFooter` each carried their own copy of
// the running-head left-label rule (bare "Volume N" vs "Volume N, Chapter M"
// vs the literal word "References") and the last-updated-date formatting.
// They drifted: the DOCX path never picked up the T17/T18 PDF fixes (the
// single-chapter volume never gets a ", Chapter N" suffix; the date prints
// through formatDate instead of the raw ISO string), and the DOCX front
// matter had no running head/footer furniture at all. Both generators now
// derive the running-head text and the footer's static prefix/numeral style
// from these two functions, following the same "exported single source of
// truth" pattern LEGEND_TEXT and the *_BOILERPLATE arrays above already use.
// ---------------------------------------------------------------------------
export interface RunningHeadParts {
  /** Running head center line: the policy title, upper-cased. */
  center: string;
  /** Running head left label: band-dependent (References / Volume N / Volume N, Chapter M). */
  left: string;
  /** Running head right, top line: designator + volume tag, e.g. "MCO 5800.16 · V17". */
  rightTop: string;
  /** Running head right, second line: the last-updated date, canonically formatted. */
  rightDate: string;
}

/**
 * The running-head text for a page in the given band (and, for a body page,
 * its chapter). See paintTemplate in services/pdf/volumeGenerator.ts for the
 * measured provenance of the left-label rule (Task 18 finding D): reference
 * pages print the literal word "References"; a single-chapter volume's body
 * pages print bare "Volume {n}"; a multi-chapter volume's body pages print
 * "Volume {n}, Chapter {m}"; every other page (front matter) prints bare
 * "Volume {n}".
 */
export function runningHeadParts(doc: VolumeDoc, band: Page['band'], chapter?: number): RunningHeadParts {
  const multiChapter = doc.chapters.length > 1;
  let left: string;
  if (band === 'ref') {
    left = 'References';
  } else if (band === 'body' && chapter !== undefined && multiChapter) {
    left = `Volume ${doc.volume.number}, Chapter ${chapter}`;
  } else {
    left = `Volume ${doc.volume.number}`;
  }
  return {
    center: doc.order.policyTitle.toUpperCase(),
    left,
    rightTop: `${doc.order.designator} · V${doc.volume.number}`,
    rightDate: formatDate(doc.volume.lastUpdatedDate),
  };
}

export interface FooterScheme {
  /** Literal text painted/typed immediately before the page-number value, e.g. "REF-" or "3-". */
  prefix: string;
  /** Numeral style for the page-number value itself. */
  format: 'decimal' | 'lowerRoman';
}

/**
 * The footer's page-number SCHEME for a given band — not a resolved string.
 * The PDF path already resolves concrete per-page label strings at layout
 * time (bodyPageLabel/refPageLabel/toRoman in lib/volume/page-bands.ts,
 * baked into each Page.label as it's produced); this is for the DOCX path,
 * which lets Word compute and paint its own page numbers (see the module
 * docstring in volumeDocx.ts) but needs the same prefix/numeral rules to
 * build its `PageNumber` field runs, instead of a separate, partially-wrong
 * copy of the rule (Finding 3: DOCX's front matter — title/verso/references/
 * TOC — had no footer, and thus no numbering scheme, at all).
 */
export function footerScheme(band: Page['band'], opts: { chapter?: number; useChapterPage?: boolean } = {}): FooterScheme {
  if (band === 'ref') return { prefix: 'REF-', format: 'decimal' };
  if (band === 'body' && opts.useChapterPage && opts.chapter !== undefined) {
    return { prefix: `${opts.chapter}-`, format: 'decimal' };
  }
  if (band === 'body') return { prefix: '', format: 'decimal' };
  return { prefix: '', format: 'lowerRoman' };
}

// ---------------------------------------------------------------------------
// Body-block layout helpers
// ---------------------------------------------------------------------------
function layoutBlockLines(cursor: PageCursor, block: Block, x: number) {
  const lines = wrapRuns(block.runs, x, RUNOVER_X, RIGHT_EDGE, BODY_SIZE_PT);
  cursor.addLines(lines);
}

function isCorrespondence(block: Block | undefined): boolean {
  return block?.ladder === 'correspondence';
}

/**
 * Lays out a body's Blocks, with `INTER_PARAGRAPH_GAP` inserted before each
 * one after the first so a real paragraph break inside one designated item
 * reads as a blank line, matching the source (see INTER_PARAGRAPH_GAP's
 * measurement note).
 *
 * Finding 8: a Block flagged `ladder: 'correspondence'` was accepted by the
 * schema (BlockSchema.ladder) but had no consumer at all - the flag was
 * silently ignored, so an embedded verbatim document (format spec §2's
 * "Embedded-content ladder": a secondary a./(1)/(a) naval-letter-style
 * ladder for samples reproduced inside a volume, distinct from the
 * volume's own structural CCSSPP designators) rendered as indistinguishable
 * flush-margin prose with no designators of its own.
 *
 * The schema doesn't model nested correspondence sub-levels - a Block is
 * flat text, not a tree, so there's nowhere to store a (1)/(a) depth on an
 * individual block. The simplest behavior that's still spec-conformant and
 * fully representable by the data we have: a contiguous run of
 * `correspondence` blocks within one body numbers as its own depth-0
 * a./b./c. sequence (`correspondenceDesignator(0, seq)`), restarting
 * whenever a non-correspondence block interrupts it or a new body starts,
 * laid out one structural indent step deeper than the body's own `level` -
 * using the SAME designatorX/textStartX ladder geometry as every other
 * designated item in this module, so the embedded ladder reads as visually
 * nested without inventing new geometry. Deeper (1)/(a) correspondence
 * levels would need a richer (nested) Block model and are out of scope for
 * this minimal, faithful implementation.
 */
function layoutBodyBlocks(cursor: PageCursor, blocks: Block[], x: number, level: 1 | 2 | 3 | 4) {
  let correspondenceSeq = 0;
  blocks.forEach((block, i) => {
    if (i > 0) cursor.addGap(INTER_PARAGRAPH_GAP);
    if (block.ladder === 'correspondence') {
      correspondenceSeq += 1;
      const corrLevel = Math.min(level + 1, 4) as 1 | 2 | 3 | 4;
      cursor.addDesignatedLines(correspondenceDesignator(0, correspondenceSeq), corrLevel, block.runs);
    } else {
      correspondenceSeq = 0;
      layoutBlockLines(cursor, block, x);
    }
  });
}

function layoutSubPara(cursor: PageCursor, sub: SubPara, level: 1 | 2 | 3 | 4) {
  const designator = subParaDesignator(sub.style, sub.seq);
  const firstBlock = sub.body[0];
  // Finding 8: a correspondence-ladder first block must NOT be merged onto
  // the sub-paragraph's own designator/title line - it gets its own
  // a./b./c. designator via layoutBodyBlocks below, same as every other
  // correspondence block in this body.
  const mergeFirst = firstBlock !== undefined && !isCorrespondence(firstBlock);
  const firstRuns = mergeFirst ? firstBlock.runs : [];
  const restBlocks = mergeFirst ? sub.body.slice(1) : sub.body;
  const bodyRuns = sub.title
    ? [{ text: `${sub.title}. ` }, ...firstRuns]
    : firstRuns;
  cursor.addDesignatedLines(designator, level, bodyRuns);
  layoutBodyBlocks(cursor, restBlocks, RUNOVER_X, level);
  for (const child of sub.children) {
    // Each child's own `style` (upper under a paragraph, arabic under an
    // upper) is set on the node already; layout only advances the indent level.
    const childLevel = Math.min(level + 1, 4) as 1 | 2 | 3 | 4;
    layoutSubPara(cursor, child, childLevel);
  }
}

function layoutParagraph(cursor: PageCursor, chapter: number, sectionSeq: number, para: Paragraph) {
  const level = 2 as const;
  const designator = paragraphDesignator(chapter, sectionSeq, para.seq);
  const firstBlock = para.body[0];
  // Finding 8: see layoutSubPara's identical comment - a correspondence
  // first block gets its own a./b./c. designator instead of being merged
  // onto the paragraph's own designator/title line.
  const mergeFirst = firstBlock !== undefined && !isCorrespondence(firstBlock);
  const firstRuns = mergeFirst ? firstBlock.runs : [];
  const restBlocks = mergeFirst ? para.body.slice(1) : para.body;
  const bodyRuns = para.title
    ? [{ text: `${para.title}. ` }, ...firstRuns]
    : firstRuns;
  cursor.addDesignatedLines(designator, level, bodyRuns);
  layoutBodyBlocks(cursor, restBlocks, RUNOVER_X, level);
  for (const sub of para.children) {
    layoutSubPara(cursor, sub, 3);
  }
}

function layoutSection(
  cursor: PageCursor,
  chapter: number,
  section: Section,
  sectionPeriod: boolean,
  toc: TocEntry[],
) {
  const designator = sectionDesignator(chapter, section.seq, sectionPeriod);
  const headingText = section.title.toUpperCase();
  // Finding 13 (T8): capture the page label BEFORE laying out the heading,
  // not after. A long heading can wrap onto a second line and, if that
  // line lands past the bottom margin, paginate onto the NEXT page - so
  // reading currentLabel() after addDesignatedLines recorded the page of
  // the heading's LAST wrapped line instead of where it starts.
  const headingPage = cursor.currentLabel();
  cursor.addDesignatedLines(designator, 1, [{ text: headingText }], BODY_SIZE_PT, 'heading');
  toc.push({ label: `${designator} ${headingText}`.trim(), page: headingPage, level: 1 });

  // Finding 1: `body` and `paragraphs` are not mutually exclusive in the
  // schema (SectionSchema permits both, and the editor offers both "Add
  // text" and "Add Paragraph" on the same section - ChapterTree.tsx), but
  // this used to be an if/else that silently dropped whichever one it
  // didn't pick. Render flush-left body blocks first, then numbered
  // paragraphs, so a section carrying both loses neither.
  if (section.body && section.body.length > 0) {
    // Finding 8: honors any `correspondence`-ladder blocks in the section
    // body (see layoutBodyBlocks's doc comment).
    layoutBodyBlocks(cursor, section.body, designatorX(1), 1);
    if (section.paragraphs.length > 0) cursor.addGap(INTER_PARAGRAPH_GAP);
  }
  for (const para of section.paragraphs) {
    layoutParagraph(cursor, chapter, section.seq, para);
  }
}

/**
 * A figure block: centered graphic box, centered "Figure {n}" caption, then
 * optional legend lines — each figure registers its own level-1 TOC entry.
 */
function layoutFigure(cursor: PageCursor, figure: Figure, toc: TocEntry[]) {
  cursor.addFigure(figure.image, figure.number);
  cursor.addGap(6);
  cursor.addLines(centeredLine(`Figure ${figure.number}`), BODY_SIZE_PT);
  toc.push({
    label: `FIGURE ${figure.number}: ${figure.caption.toUpperCase()}`,
    page: cursor.currentLabel(),
    level: 1,
  });
  for (const line of figure.legend ?? []) {
    cursor.addLines(centeredLine(line), BODY_SIZE_PT);
  }
}

// ---------------------------------------------------------------------------
// Front matter: title page, blank verso.
// ---------------------------------------------------------------------------
function layoutTitlePage(doc: VolumeDoc, nextRoman: () => string): Page[] {
  const cursor = new PageCursor('front', nextRoman);
  const v = doc.volume;

  // Task 20: the whole "VOLUME {n} .. CANCELLATION" block sits inside one
  // bordered box in the real PDF, with the change table's own top border
  // immediately below it (no gap - see BoxItem's doc comment and the
  // `cursor.addBox` call below, in place of the `addGap()` this used to have
  // right before `addTable`).
  const boxTopY = cursor.currentY() + LEADING;

  cursor.addLines(centeredRuns([{ text: `VOLUME ${v.number}`, bold: true }], HEADING_SIZE_PT), HEADING_SIZE_PT);
  const titleText = v.titleQuoted !== false ? `"${v.title}"` : v.title;
  cursor.addLines(centeredRuns([{ text: titleText, bold: true, underline: true }], HEADING_SIZE_PT), HEADING_SIZE_PT);
  cursor.addLines(
    centeredRuns([{ text: `SUMMARY OF VOLUME ${v.number} CHANGES`, bold: true }], HEADING_SIZE_PT),
    HEADING_SIZE_PT,
  );
  cursor.addGap();

  cursor.addLines(centeredRuns(legendRuns()));
  cursor.addGap();

  for (const line of VOLUME_CHANGE_POLICY_BOILERPLATE) {
    cursor.addLines(leftParagraphRuns(styleBoilerplateRuns(line, { underlineFullRevision: true })));
  }

  if (v.cancellation) {
    cursor.addGap();
    cursor.addLines(
      leftParagraphRuns([
        { text: 'CANCELLATION', bold: true, underline: true },
        { text: `: ${v.cancellation}` },
      ]),
    );
  }

  const boxBottomY = cursor.currentY();
  // Fix round 1 (reviewer finding, CRITICAL): addBox must be called HERE,
  // before addTable - not after it. addTable can paginate onto a new page
  // (Finding 5's pagination, e.g. a long changeLog), which would leave a
  // stray box - painted with THIS page's y-coordinates - attached to
  // whatever page addTable happened to finish on instead of the page that
  // actually holds the "VOLUME {n} .. CANCELLATION" text it's meant to
  // enclose. Capturing it immediately, while `cursor.current` is still
  // guaranteed to be that page, is what makes it correct regardless of how
  // the table itself paginates.
  cursor.addBox(boxTopY, boxBottomY);
  const { rows: changeRows, shading } = titlePageChangeRows(doc);
  const tableCols = ['VOLUME VERSION', 'SUMMARY OF CHANGE', 'ORIGINATION DATE', 'DATE OF CHANGES'];
  const tableColWidths = [90, 198, 90, 90];
  // Task 20: the table's own top border paints at `y + headerHeight - 3`
  // (see volumeGenerator.ts's 'table' case), i.e. ABOVE the cursor position
  // addTable is called at - so closing the gap to zero (as a naive "join
  // them directly" read of the measurement would do) makes the header row
  // overlap backward into the CANCELLATION line above it. Sizing the gap to
  // `headerHeight - 3` instead makes that top border land EXACTLY at
  // `boxBottomY`, so the box's bottom edge and the table's top border
  // coincide with no overlap and only a hairline-thin visual gap above it -
  // as measured on the real Vol 17 PDF (task-20-report.md).
  cursor.addGap(tableHeaderHeight(tableCols, tableColWidths) - 3);
  cursor.addTable(tableCols, tableColWidths, changeRows, shading);

  if (v.reportRequired) {
    cursor.addGap();
    // Task 18 finding E: the real Vol 17 PDF prints exactly "Report
    // Required:" with nothing appended - the trailing "See Volume text for
    // details." sentence was invented, not sourced from any stored field
    // (`reportRequired` is a plain boolean; there is no free-text value to
    // print verbatim). Verified against the real PDF: page 0, y=266.8,
    // text is the bare literal "Report Required:" only.
    cursor.addLines(leftParagraph('Report Required:'));
  }

  cursor.addGap();
  cursor.addLines(leftParagraph('Submit recommended changes to this Volume, via the proper channels, to:'));
  for (const line of v.submitChangesTo.split('\n')) {
    cursor.addLines(leftParagraph(line));
  }

  cursor.addGap();
  const distText = v.distribution.kind === 'pcn'
    ? `DISTRIBUTION: PCN ${v.distribution.value ?? ''}`
    : 'DISTRIBUTION STATEMENT A: Approved for public release; distribution is unlimited.';
  cursor.addLines(leftParagraph(distText));

  return cursor.finish();
}

function blankVersoPage(label: string): Page {
  const text = '(This page intentionally left blank)';
  const line = centeredLine(text, BODY_SIZE_PT)[0];
  return {
    label,
    band: 'front',
    items: [{ kind: 'line', x: line.x, y: TOP_TEXT_Y, segments: line.segments, sizePt: BODY_SIZE_PT }],
  };
}

// ---------------------------------------------------------------------------
// References — its own REF-{n} band, independent of front-matter pagination.
// ---------------------------------------------------------------------------
function layoutReferences(doc: VolumeDoc): { pages: Page[]; firstLabel: string } {
  let refIdx = 0;
  const labelFn = () => refPageLabel(++refIdx);
  const cursor = new PageCursor('ref', labelFn);
  const firstLabel = cursor.currentLabel();

  cursor.addLines(centeredLine('REFERENCES', HEADING_SIZE_PT), HEADING_SIZE_PT, 'heading');
  for (const [i, ref] of doc.references.entries()) {
    cursor.addDesignatedLines(referenceDesignator(i), 1, [{ text: ref.text }]);
  }

  cursor.breakPage();
  cursor.addLines(centeredLine('"REFERENCES"', HEADING_SIZE_PT), HEADING_SIZE_PT, 'heading');
  cursor.addGap();
  for (const line of REFERENCES_SUMMARY_BOILERPLATE) {
    cursor.addLines(leftParagraph(line));
  }

  return { pages: cursor.finish(), firstLabel };
}

// ---------------------------------------------------------------------------
// Table of contents — built once the body walk has resolved every entry's
// page label.
// ---------------------------------------------------------------------------
function layoutToc(doc: VolumeDoc, toc: TocEntry[], nextRoman: () => string): Page[] {
  const cursor = new PageCursor('front', nextRoman);
  cursor.addLines(
    centeredLine(`VOLUME ${doc.volume.number}: ${doc.volume.title.toUpperCase()}`, HEADING_SIZE_PT),
    HEADING_SIZE_PT,
  );
  cursor.addLines(centeredLine('TABLE OF CONTENTS', HEADING_SIZE_PT), HEADING_SIZE_PT);
  cursor.addGap();

  for (const entry of toc) {
    cursor.addTocEntry(entry.label, entry.page);
  }

  return cursor.finish();
}

// ---------------------------------------------------------------------------
// Chapter divider ("Summary of Substantive Changes") + "CHAPTER {M}" title.
// ---------------------------------------------------------------------------
function layoutChapterDivider(cursor: PageCursor, doc: VolumeDoc, chapter: Chapter) {
  // Task 20: same bordered-box-then-table treatment as layoutTitlePage
  // (measured on the real Vol 17 chapter divider page too - task-20-report.md).
  const boxTopY = cursor.currentY() + LEADING;

  cursor.addLines(
    centeredRuns([{ text: `VOLUME ${doc.volume.number}: CHAPTER ${chapter.number}`, bold: true }], HEADING_SIZE_PT),
    HEADING_SIZE_PT,
  );
  cursor.addLines(
    centeredRuns([{ text: `"${chapter.title.toUpperCase()}"`, bold: true, underline: true }], HEADING_SIZE_PT),
    HEADING_SIZE_PT,
  );
  cursor.addLines(
    centeredRuns([{ text: 'SUMMARY OF SUBSTANTIVE CHANGES', bold: true }], HEADING_SIZE_PT),
    HEADING_SIZE_PT,
  );
  cursor.addGap();

  cursor.addLines(centeredRuns(legendRuns()));
  cursor.addGap();

  for (const line of CHAPTER_CHANGE_POLICY_BOILERPLATE) {
    // Task 20: measured against the real PDF, the divider's copy of the
    // "...full revision..." sentence is NOT underlined, unlike the title
    // page's copy of the same sentence (task-20-report.md) - a genuine
    // per-page inconsistency in the source document, not a bug.
    cursor.addLines(leftParagraphRuns(styleBoilerplateRuns(line, { underlineFullRevision: false })));
  }

  const boxBottomY = cursor.currentY();
  // Fix round 1 (reviewer finding, CRITICAL): see layoutTitlePage's
  // identical comment - addBox must run BEFORE addTable, while
  // `cursor.current` is still guaranteed to be the page holding this
  // divider's text block, since addTable can paginate a long chapter
  // changeLog onto later pages.
  cursor.addBox(boxTopY, boxBottomY);
  // Finding 15 (T10): format spec §4.6 verbatim header, with spaces around
  // the slash.
  const tableCols = ['CHAPTER VERSION', 'PAGE / PARAGRAPH', 'SUMMARY OF SUBSTANTIVE CHANGES', 'DATE OF CHANGE'];
  const tableColWidths = [80, 90, 208, 90];
  // Task 20: see layoutTitlePage's identical comment - this sizes the gap
  // so the table's own top border lands exactly at `boxBottomY` instead of
  // overlapping backward into the boilerplate text above it.
  cursor.addGap(tableHeaderHeight(tableCols, tableColWidths) - 3);
  cursor.addTable(tableCols, tableColWidths, chapter.changeLog.map(r => [r.version, r.pageParagraph, r.summary, r.dateOfChange]));
}

function layoutChapterTitlePage(cursor: PageCursor, chapter: Chapter) {
  cursor.breakPage();
  // Task 20: measured bold on the real Vol 17 chapter title page (page
  // index 4 - task-20-report.md), matching the divider/title-page headings.
  cursor.addLines(centeredRuns([{ text: `CHAPTER ${chapter.number}`, bold: true }], HEADING_SIZE_PT), HEADING_SIZE_PT);
  cursor.addLines(centeredRuns([{ text: chapter.title.toUpperCase(), bold: true }], HEADING_SIZE_PT), HEADING_SIZE_PT);
  cursor.addGap();
}

// ---------------------------------------------------------------------------
// Body: chapter dividers + chapter title pages + sections/paragraphs.
// ---------------------------------------------------------------------------
function layoutBody(doc: VolumeDoc, toc: TocEntry[]): Page[] {
  const multiChapter = doc.chapters.length > 1;
  const band = doc.volume.pageBand;
  const useChapterPage = band === 'chapter-page' || (band === 'auto' && multiChapter);
  const bodyPages: Page[] = [];
  let globalPage = 0;

  for (const chapter of doc.chapters) {
    let chapterPage = 0;
    const labelFn = () => {
      chapterPage += 1;
      globalPage += 1;
      const pageNum = useChapterPage ? chapterPage : globalPage;
      return bodyPageLabel({ chapter: chapter.number, page: pageNum, multiChapter, band });
    };
    const cursor = new PageCursor('body', labelFn, chapter.number);
    // Finding 14 (T10): capture the chapter's TOC page label right after
    // constructing its cursor - i.e. the divider's own first page - not
    // after laying out the divider. The divider's change table can itself
    // paginate (finding 5), so reading currentLabel() after
    // layoutChapterDivider recorded whatever page the divider table
    // happened to spill onto instead of the chapter's actual first page.
    const chapterFirstLabel = cursor.currentLabel();

    // Divider is page 1 of the chapter — its page counter continues below.
    layoutChapterDivider(cursor, doc, chapter);
    toc.push({
      label: `CHAPTER ${chapter.number}: ${chapter.title.toUpperCase()}`,
      page: chapterFirstLabel,
      level: 0,
    });

    layoutChapterTitlePage(cursor, chapter);

    for (const section of chapter.sections) {
      layoutSection(cursor, chapter.number, section, doc.volume.sectionPeriod, toc);
      cursor.addGap();
    }

    for (const figure of chapter.figures) {
      layoutFigure(cursor, figure, toc);
      cursor.addGap();
    }

    bodyPages.push(...cursor.finish());
  }

  return bodyPages;
}

// ---------------------------------------------------------------------------
// layoutVolume
// ---------------------------------------------------------------------------
export function layoutVolume(doc: VolumeDoc): LaidOutDoc {
  const toc: TocEntry[] = [];

  // References first: its REF-{n} band is independent of front-matter/body
  // pagination, so it can be laid out before either.
  const { pages: refPages, firstLabel: refFirstLabel } = layoutReferences(doc);
  toc.push({ label: 'REFERENCES', page: refFirstLabel, level: 0 });

  // Body walk resolves every section/chapter TOC entry's final page label.
  const bodyPages = layoutBody(doc, toc);

  // Front matter: title page + verso consume roman i/ii; the TOC (built last,
  // now that every entry above is resolved) continues the same roman count.
  let romanIdx = 1;
  const nextRoman = () => toRoman(romanIdx++);
  const titlePages = layoutTitlePage(doc, nextRoman);
  const versoPage = blankVersoPage(nextRoman());
  const tocPages = layoutToc(doc, toc, nextRoman);

  return {
    pages: [...titlePages, versoPage, ...refPages, ...tocPages, ...bodyPages],
    toc,
  };
}
