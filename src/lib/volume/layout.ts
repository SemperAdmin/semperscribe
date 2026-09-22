import type { Appendix, Block, Chapter, Figure, Paragraph, Run, Section, SubPara, VolumeDoc } from '@/lib/schemas/volume-schema';
import { correspondenceDesignator, paragraphDesignator, referenceDesignator, sectionDesignator, subParaDesignator } from '@/lib/volume/designators';
import { designatorX, RUNOVER_X, textStartX } from '@/lib/volume/volume-indent';
import { appendixPageLabel, bodyPageLabel, refPageLabel, toRoman } from '@/lib/volume/page-bands';
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
// Task 22: appendix-specific geometry, measured directly against the real
// Vol 17 PDF (fontmap.py; see task22-report.md for the full evidence).
// ---------------------------------------------------------------------------
/** TOC page (page index 1): appendix letter designator, x=77.5 - slightly
 * right of the ordinary section-designator column (x=72). */
const APPENDIX_TOC_LETTER_X = 77.5;
/** Appendix A content page (page index 8): glossary term column, x=77.4. */
const GLOSSARY_TERM_X = 77.4;
/** Appendix A content page (page index 8): glossary definition column, x=185.3. */
const GLOSSARY_DEF_X = 185.3;

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
  band: 'front' | 'ref' | 'body' | 'appendix';
  chapter?: number;
  /** Task 22: the appendix letter, set only for `band: 'appendix'` pages. */
  appendix?: string;
  items: PaintItem[];
}
export interface TocEntry {
  label: string;
  page: string;
  level: number;
  /**
   * Task 22: renders as a bold heading line with no leader/page (the
   * "APPENDICES" line printed once before the per-appendix entries) instead
   * of the ordinary label+leader+page line - see layoutToc.
   */
  header?: boolean;
  /**
   * Task 22: renders as an appendix entry - a slightly-indented letter
   * designator, then the title starting one ladder stop over (measured
   * against the real Vol 17 TOC page - see PageCursor.addAppendixTocEntry) -
   * instead of the ordinary flush-margin label. `label` still carries the
   * full "LETTER  TITLE" text for simple consumers/tests; `page` is the
   * appendix's CONTENT page label (e.g. "A-2"), not its divider ("A-1").
   */
  appendix?: boolean;
  appendixLetter?: string;
  appendixTitle?: string;
  /**
   * Task 24: renders the entry's label+leader+page all in BOLD instead of
   * the ordinary regular weight - measured directly against the real Vol 17
   * TOC page (fontmap.py, page index 1, y=656.4): the "REFERENCES" entry's
   * label, dotted leader, AND page label ("REF 1") all extract with a
   * `/TimesNewRomanPS-BoldMT` BaseFont, unlike every other entry on the same
   * page (plain `/TimesNewRomanPSMT`). Vol 17 has no other bold TOC entry to
   * generalize from, so this is set only where a caller (layoutVolume, for
   * the "REFERENCES" entry) explicitly measured it - not inferred from any
   * other flag.
   */
  bold?: boolean;
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
// Task 21 finding 5: real Vol 17 grid-line y's (page 0's title-page change
// table) give exact row heights - two-line header 465.91->426.31 = 39.6pt,
// the also-2-line "ORIGINAL VOLUME" data row 426.31->386.71 = 39.6pt, and
// each 1-line blank/shaded row 386.71->358.37/358.37->330.05/330.05->302.09
// ≈ 28.3pt. Solving `rows*LEADING + pad` against both anchors (n=1 -> 28.3,
// n=2 -> 39.6) lands pad ≈16, not the old 6 - the old rows painted visibly
// shorter/cramped than the source's roomier grid.
const TABLE_ROW_PAD = 16;
function tableRowHeight(cellLines: string[][]): number {
  return Math.max(1, ...cellLines.map(lines => lines.length)) * LEADING + TABLE_ROW_PAD;
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
  private appendix?: string;

  constructor(band: Page['band'], labelFn: () => string, chapter?: number, appendix?: string) {
    this.band = band;
    this.chapter = chapter;
    this.appendix = appendix;
    this.labelFn = labelFn;
    this.current = { label: labelFn(), band, chapter, appendix, items: [] };
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
    this.current = { label: this.labelFn(), band: this.band, chapter: this.chapter, appendix: this.appendix, items: [] };
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
   * The dotted leader + right-aligned page label that finishes a TOC entry's
   * last line - shared by `addTocEntry` and (Task 22) `addAppendixTocEntry`,
   * which differ only in how the label ITSELF is positioned/wrapped, not in
   * how the leader/page tail is painted.
   */
  private addTocLeaderAndPage(y: number, lineEndX: number, pageLabel: string, sizePt: number, bold = false) {
    const pageW = measureText(pageLabel, sizePt, bold);
    const targetX = RIGHT_EDGE - pageW;
    const dotWidth = measureText('.', sizePt, bold);
    const gap = Math.max(0, targetX - lineEndX - dotWidth);
    const dotCount = dotWidth > 0 ? Math.floor(gap / dotWidth) : 0;
    if (dotCount > 0) {
      const leader = ' ' + '.'.repeat(dotCount);
      this.current.items.push({
        kind: 'line', x: lineEndX, y, sizePt,
        segments: [{ text: leader, run: { text: leader, bold } }],
      });
    }
    this.current.items.push({
      kind: 'line', x: targetX, y, sizePt,
      segments: [{ text: pageLabel, run: { text: pageLabel, bold } }],
    });
  }

  /**
   * A TOC line: label left at the margin (wrapped continuation indented
   * slightly under the title text, not back to the margin), a dotted leader,
   * and the page label right-aligned to RIGHT_EDGE.
   */
  addTocEntry(label: string, pageLabel: string, sizePt = BODY_SIZE_PT, bold = false) {
    const reserveW = 70; // room for leader + page label on the last line
    const lines = wrapRuns([{ text: label, bold }], MARGIN, MARGIN + 18, RIGHT_EDGE - reserveW, sizePt);
    if (lines.length === 0) lines.push({ segments: [], x: MARGIN });
    for (let i = 0; i < lines.length; i++) {
      this.ensureRoom();
      const y = this.y;
      const isLast = i === lines.length - 1;
      const lineText = lines[i].segments.map(s => s.text).join('');
      this.current.items.push({ kind: 'line', x: lines[i].x, y, segments: lines[i].segments, sizePt });
      if (isLast) {
        const endX = lines[i].x + measureText(lineText, sizePt, bold);
        this.addTocLeaderAndPage(y, endX, pageLabel, sizePt, bold);
      }
      this.y -= LEADING;
    }
  }

  /**
   * Task 22: an appendix's TOC entry - measured directly against the real
   * Vol 17 TOC page (fontmap.py, page index 1): the letter designator sits
   * slightly right of the ordinary section-designator column (x=77.5, not
   * the x=72 `addTocEntry`'s label uses), and the title starts at the next
   * ladder stop (x=108.0 - exactly `textStartX(1, letter)`, the same stop a
   * one-character designator already resolves to), not immediately after
   * the letter. Continuation lines (an unmeasured case for Vol 17's own
   * single-line entry) fall back to the same MARGIN+18 indent
   * `addTocEntry`'s wrapped continuations use.
   */
  addAppendixTocEntry(letter: string, title: string, pageLabel: string, sizePt = BODY_SIZE_PT) {
    const reserveW = 70;
    const titleX = textStartX(1, letter, sizePt);
    const lines = wrapRuns([{ text: title }], titleX, MARGIN + 18, RIGHT_EDGE - reserveW, sizePt);
    if (lines.length === 0) lines.push({ segments: [], x: titleX });
    for (let i = 0; i < lines.length; i++) {
      this.ensureRoom();
      const y = this.y;
      const isLast = i === lines.length - 1;
      if (i === 0) {
        this.current.items.push({
          kind: 'line', x: APPENDIX_TOC_LETTER_X, y,
          segments: [{ text: letter, run: { text: letter } }], sizePt,
        });
      }
      const lineText = lines[i].segments.map(s => s.text).join('');
      this.current.items.push({ kind: 'line', x: lines[i].x, y, segments: lines[i].segments, sizePt });
      if (isLast) {
        const endX = lines[i].x + measureText(lineText, sizePt);
        this.addTocLeaderAndPage(y, endX, pageLabel, sizePt);
      }
      this.y -= LEADING;
    }
  }

  /**
   * Task 22: a two-column glossary row - term flush at `GLOSSARY_TERM_X`,
   * definition starting at `GLOSSARY_DEF_X` and wrapping with continuation
   * lines aligned under that same definition column (not back to the
   * margin) - measured directly against the real Vol 17 Appendix A content
   * page (fontmap.py, page index 8; see GLOSSARY_TERM_X/GLOSSARY_DEF_X's
   * doc comment for the exact measurement).
   */
  addGlossaryEntry(term: string, definition: string, sizePt = BODY_SIZE_PT) {
    this.ensureRoom();
    const y = this.y;
    this.current.items.push({
      kind: 'line', x: GLOSSARY_TERM_X, y,
      segments: [{ text: term, run: { text: term } }], sizePt,
    });
    const lines = wrapRuns([{ text: definition }], GLOSSARY_DEF_X, GLOSSARY_DEF_X, RIGHT_EDGE, sizePt);
    if (lines.length === 0) {
      this.y -= LEADING;
      return;
    }
    this.current.items.push({ kind: 'line', x: lines[0].x, y, segments: lines[0].segments, sizePt });
    this.y -= LEADING;
    for (let i = 1; i < lines.length; i++) {
      this.ensureRoom();
      this.current.items.push({ kind: 'line', x: lines[i].x, y: this.y, segments: lines[i].segments, sizePt });
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

/**
 * Task 21 finding 4: like `leftParagraphRuns`, but each wrapped line is
 * individually re-centered on the page instead of starting at the left
 * margin - measured directly against the real Vol 17 PDF (both the title
 * page and the chapter divider): the change-policy boilerplate paragraphs
 * are centered, not flush-left, with EACH wrapped line centered on its own
 * measured width (fontmap x's per line don't share a single left edge).
 * Wrapping decisions themselves are unaffected - only the resulting line's
 * `x` is recomputed after wrapRuns has already decided where to break.
 *
 * Task 23 fix 2: `inset` narrows the WRAP width (not just the resulting
 * centered position) by the same amount on each side - the real title page's
 * first boilerplate paragraph wraps its first line at "...unless/until a",
 * pushing "full revision..." onto line 2, while ours (wrapping at the full
 * `MARGIN..RIGHT_EDGE` interior width, inset=0) fit "full" onto line 1 too.
 * See `TITLE_BOILERPLATE_INSET`'s doc comment for the measurement. Defaults
 * to 0 (the prior, unnarrowed behavior) so `layoutDivider`'s callers -
 * unmeasured for this task - are unaffected.
 */
function centeredParagraphRuns(runs: Run[], sizePt = BODY_SIZE_PT, inset = 0) {
  const lines = wrapRuns(runs, MARGIN + inset, MARGIN + inset, RIGHT_EDGE - inset, sizePt);
  return lines.map(line => {
    const width = line.segments.reduce((w, s) => w + measureText(s.text, sizePt, !!s.run.bold), 0);
    return { segments: line.segments, x: CENTER_X - width / 2 };
  });
}

/**
 * Task 23 fix 2: the real Vol 17 title page's centered boilerplate text sits
 * inset from the box's `MARGIN..RIGHT_EDGE` interior, not flush to it -
 * measured directly against the real PDF's content stream (fontmap.py, page
 * index 0): the first boilerplate paragraph's first line starts at x=83.7
 * (`MARGIN` is 72, so inset = 83.7 - 72 = 11.7) and, by the same paragraph's
 * own centered symmetry (`centeredParagraphRuns` centers each line
 * independently), ends at x = 2*CENTER_X - 83.7 = 528.3 (`RIGHT_EDGE` is
 * 540, inset = 540 - 528.3 = 11.7 too) - an exactly symmetric 11.7pt inset on
 * each side. Verified this is the correct WRAP-width constraint (not just
 * where that one line happened to land): at inset=11.7 (wrap width 444.6),
 * `wrapRuns` breaks the first paragraph's first line at "...unless/until a",
 * matching the real PDF exactly (ours previously fit "full" onto that line
 * too, at the old unconstrained 468pt width) - while the OTHER two
 * boilerplate paragraphs and the legend line, all single-line in the real
 * PDF, stay single-line at this width too (they don't reach the new,
 * narrower boundary). Applied to every centered paragraph in the title
 * page's box (legend/boilerplate/CANCELLATION), per the task's "one
 * consistent measure" - none of the others actually wrap differently at this
 * width, so this only visibly changes the first paragraph.
 */
const TITLE_BOILERPLATE_INSET = 11.7;

/**
 * Task 25 fix 5: the divider's (chapter and appendix alike) centered
 * boilerplate paragraphs wrap NARROWER than the title page's - a bigger
 * inset than `TITLE_BOILERPLATE_INSET` - because the divider's box template
 * is itself narrower/more indented than the title page's (real Vol 17 PDF,
 * fontmap.py: divider box `re [85.104, 489.79, 441.94, 214.34]`, page index
 * 3, vs. the title page's `re [73.224, 466.39, 465.7, 239.66]`, page index
 * 0), plus additional text padding within that box.
 *
 * Derived the same way as `TITLE_BOILERPLATE_INSET` - from the first
 * boilerplate paragraph's measured first-line x - but the divider's own
 * CHAPTER_CHANGE_POLICY_BOILERPLATE text differs from the title page's
 * VOLUME_CHANGE_POLICY_BOILERPLATE (it additionally reads "...Marine Corps
 * Order (MCO) Volume (right header)..."), so the two boilerplates wrap at
 * different widths even though both boxes use the same nominal geometry.
 * Measured on the real chapter divider (fontmap.py, page index 3): first
 * boilerplate line "The original publication date of this Marine Corps
 * Order (MCO) Volume (right header)" starts at x=112.9 (inset = 112.9 - 72 =
 * 40.9) and, by centered symmetry, ends at x = 2*CENTER_X - 112.9 = 499.1
 * (inset = 540 - 499.1 = 40.9 too). Re-confirmed against the SECOND
 * boilerplate line too ("All Volume changes denoted in blue font will reset
 * to black font upon a full revision of this" / "Volume." - starts at
 * x=104.7 on the same page): computing the exact word-wrap boundary each
 * line's own measured width implies (the range of wrap widths consistent
 * with THAT word wrapping and not the next word) gives two overlapping
 * windows whose intersection is ~31.0-32.8pt - 32.0 sits inside both, and
 * reproduces the identical word-wrap point (`wrapRuns`) for both lines as
 * the real PDF, unlike either paragraph's own naive x-derived value (40.9 or
 * 32.7) alone. Re-confirmed identical on the Appendix A divider (page index
 * 7 - same two wrap points, modulo the published PDF's own ~11.5 vs 11.0pt
 * font-size rounding noise between the two divider instances, which doesn't
 * change which word each line wraps after).
 */
const DIVIDER_BOILERPLATE_INSET = 32.0;

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
 * be filled in by hand.
 *
 * Task 21 finding 5 (regression fix): Task 20's doc comment here previously
 * claimed the 3 blank/shaded rows were "out of measured scope for a
 * populated log" and dropped them once `doc.changeLog` had any real entries.
 * That was wrong - re-measured directly against the real Vol 17 PDF, whose
 * OWN changeLog has exactly one recorded entry (the "ORIGINAL VOLUME" row
 * itself, stored as real data, not synthesized) - it still prints the same
 * 3 blank/shaded template rows below it. The vol17.json fixture stores that
 * one row as `changeLog[0]`, so it took the "populated" branch and silently
 * lost the blank rows in BOTH the PDF and DOCX exports (neither generator
 * has its own bug here - both call this shared function). The blank/shaded
 * template rows are appended after whatever rows are already recorded,
 * always, not only when the log is empty.
 */
export function titlePageChangeRows(doc: VolumeDoc): { rows: string[][]; shading?: boolean[][] } {
  const v = doc.volume;
  const blankRow = ['', '', '', ''];
  const blankShading: boolean[] = [false, false, true, false];
  if (doc.changeLog.length > 0) {
    const rows = doc.changeLog.map(r => [r.version, r.summary, r.originationDate, r.dateOfChanges]);
    const shading = rows.map(() => [false, false, false, false]);
    return {
      rows: [...rows, blankRow, blankRow, blankRow],
      shading: [...shading, blankShading, blankShading, blankShading],
    };
  }
  const seedRow = ['ORIGINAL VOLUME', 'N/A', formatDate(v.originalPublicationDate), 'N/A'];
  return {
    rows: [seedRow, blankRow, blankRow, blankRow],
    shading: [[false, false, false, false], blankShading, blankShading, blankShading],
  };
}

/**
 * Task 25 fix 4: the divider's own change table (chapter AND appendix alike)
 * appends 4 blank template rows below whatever real changeLog rows already
 * exist, with NO shading on any of them - shared by the PDF (layoutDivider
 * below) and DOCX (volumeDocx.ts's buildDividerChildren) generators, the
 * same "single source of truth" pattern `titlePageChangeRows` above already
 * uses for the title page's analogous (but shaded, 3-row) template.
 *
 * Measured directly against the real Vol 17 PDF (fontmap.py + raw content-
 * stream `re`/`f*` row-rule extraction): both the chapter divider (page
 * index 3) and the Appendix A divider (page index 7) draw exactly 6
 * horizontal row-boundary rules below the box (5 row bands: the 2-line
 * header + 4 data rows), and neither page contains any text between the
 * header and the footer, nor any gray-fill ("0.8xx g") operator anywhere on
 * the page - i.e. all 4 rows are genuinely blank AND unshaded, unlike the
 * title page's own 3 blank rows (which DO shade their ORIGINATION DATE
 * column).
 */
export function dividerChangeRows(
  changeLog: { version: string; pageParagraph: string; summary: string; dateOfChange: string }[],
): string[][] {
  const rows = changeLog.map(r => [r.version, r.pageParagraph, r.summary, r.dateOfChange]);
  const blankRow = ['', '', '', ''];
  return [...rows, blankRow, blankRow, blankRow, blankRow];
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
  /** Running head right, top line: designator + volume tag, e.g. "MCO 5800.16 – V17". */
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
 *
 * Task 21 finding 2: the separator between the designator and the volume
 * tag is an EN DASH (U+2013), not a middot - re-measured directly against
 * the real Vol 17 PDF's content stream (a Type0/Identity-H glyph whose
 * ToUnicode CMap maps its CID to <2013>; naive text extraction renders it
 * as the replacement character because the substitute font used for
 * extraction can't encode it, not because the source glyph is actually a
 * middot). Fixed once, here, in the single shared composer both the PDF and
 * DOCX generators consume, so neither can drift back to the wrong character.
 *
 * Task 22: extended with an `appendix` letter for `band: 'appendix'` pages -
 * both the divider and content page(s) print "Volume {n}, Appendix {L}"
 * (measured verbatim against the real Vol 17 Appendix A pages, fontmap.py
 * page indices 7/8), UNCONDITIONALLY (unlike the chapter suffix, which only
 * appears for a multi-chapter volume's body pages - Vol 17 has a single
 * appendix and still prints the suffix, so this isn't gated on having more
 * than one).
 */
export function runningHeadParts(doc: VolumeDoc, band: Page['band'], chapter?: number, appendix?: string): RunningHeadParts {
  const multiChapter = doc.chapters.length > 1;
  let left: string;
  if (band === 'ref') {
    left = 'References';
  } else if (band === 'appendix' && appendix !== undefined) {
    left = `Volume ${doc.volume.number}, Appendix ${appendix}`;
  } else if (band === 'body' && chapter !== undefined && multiChapter) {
    left = `Volume ${doc.volume.number}, Chapter ${chapter}`;
  } else {
    left = `Volume ${doc.volume.number}`;
  }
  return {
    center: doc.order.policyTitle.toUpperCase(),
    left,
    rightTop: `${doc.order.designator} – V${doc.volume.number}`,
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
 *
 * Task 22: `band: 'appendix'` uses the appendix's own letter-prefixed band
 * ("A-1", "A-2", ...), passed via `opts.appendix`.
 *
 * The `ref` band's prefix stays `REF-` (hyphen) - see `refPageLabel`'s doc
 * comment in page-bands.ts for the measured provenance and the user's
 * explicit 2026-09-21 ratification of keeping the hyphen form.
 */
export function footerScheme(
  band: Page['band'],
  opts: { chapter?: number; useChapterPage?: boolean; appendix?: string } = {},
): FooterScheme {
  if (band === 'ref') return { prefix: 'REF-', format: 'decimal' };
  if (band === 'appendix' && opts.appendix !== undefined) {
    return { prefix: `${opts.appendix}-`, format: 'decimal' };
  }
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

  // Task 21 finding 3: the real Vol 17 PDF steps VOLUME {n} -> title ->
  // SUMMARY -> legend -> each boilerplate paragraph -> CANCELLATION all at
  // the SAME ~25.2pt rhythm (one blank line - `INTER_PARAGRAPH_GAP`, on top
  // of the LEADING step `addLines` already takes between any two lines) -
  // measured y's: 683.1 -> 657.9 -> 632.6 -> 607.5 -> 582.2 -> 544.3 -> 519.0
  // -> 493.6 (task21-findings.md).
  //
  // Task 23 fix 1: that same one-blank-line rhythm applies ONE MORE TIME
  // before the very first line too - between the box's TOP edge and "VOLUME
  // {n}" itself - which round 1 never accounted for: it painted "VOLUME
  // {n}" straight at the page's generic top-of-text cursor position (no gap
  // at all past the bare LEADING already folded into `boxTopY` above), so
  // every line in this block landed ~13pt higher than its real counterpart
  // (the ladder's internal spacing was already correct - only its start was
  // wrong). Measured directly against the real PDF's content stream
  // (fontmap.py + raw `re` rect ops, page index 0): box top y=706.06 (the
  // `re [73.224, 466.39, 465.7, 239.66]` outer rect, top = 466.39+239.66)
  // down to "VOLUME 17"'s baseline y=683.1 is a 22.96pt gap - close to
  // 2*LEADING (25.2pt, within the same ~2-3pt slop every other rhythm
  // measurement in this file already carries), not the bare 1*LEADING
  // (12.6pt) `boxTopY`'s formula alone produces.
  cursor.addGap(INTER_PARAGRAPH_GAP);

  cursor.addLines(centeredRuns([{ text: `VOLUME ${v.number}`, bold: true }], HEADING_SIZE_PT), HEADING_SIZE_PT);
  cursor.addGap(INTER_PARAGRAPH_GAP);
  const titleText = v.titleQuoted !== false ? `"${v.title}"` : v.title;
  cursor.addLines(centeredRuns([{ text: titleText, bold: true, underline: true }], HEADING_SIZE_PT), HEADING_SIZE_PT);
  cursor.addGap(INTER_PARAGRAPH_GAP);
  cursor.addLines(
    centeredRuns([{ text: `SUMMARY OF VOLUME ${v.number} CHANGES`, bold: true }], HEADING_SIZE_PT),
    HEADING_SIZE_PT,
  );
  cursor.addGap(INTER_PARAGRAPH_GAP);

  cursor.addLines(centeredRuns(legendRuns()));
  cursor.addGap(INTER_PARAGRAPH_GAP);

  // Task 21 finding 4: the real PDF centers every wrapped line of each
  // boilerplate paragraph (fontmap x's per line, not a shared left edge) -
  // ours rendered them flush-left. Also, only the THIRD paragraph's "full
  // revision" (the "...will reset to black font upon a full revision..."
  // sentence) is underlined in the source; the underline rect measured at
  // x=402.8,y=517.3 has no counterpart near the FIRST paragraph's own "full
  // revision" phrase (y~569.6) - underlining both, as before, was wrong.
  //
  // Task 23 fix 2: each paragraph now wraps at `TITLE_BOILERPLATE_INSET`
  // narrower than the box's full interior width - see that constant's doc
  // comment for the measurement. Only the first paragraph's wrap point
  // actually changes at this width; the other two stay single-line exactly
  // as before.
  VOLUME_CHANGE_POLICY_BOILERPLATE.forEach((line, i) => {
    if (i > 0) cursor.addGap(INTER_PARAGRAPH_GAP);
    const underlineFullRevision = i === VOLUME_CHANGE_POLICY_BOILERPLATE.length - 1;
    cursor.addLines(centeredParagraphRuns(styleBoilerplateRuns(line, { underlineFullRevision }), BODY_SIZE_PT, TITLE_BOILERPLATE_INSET));
  });

  if (v.cancellation) {
    cursor.addGap(INTER_PARAGRAPH_GAP);
    // Task 21 finding 4: measured centered too (x=226.4, not the left
    // margin) - part of the same centered "VOLUME {n} .. CANCELLATION"
    // block as the boilerplate paragraphs above it.
    cursor.addLines(
      centeredParagraphRuns([
        { text: 'CANCELLATION', bold: true, underline: true },
        { text: `: ${v.cancellation}` },
      ], BODY_SIZE_PT, TITLE_BOILERPLATE_INSET),
    );
  }

  // Task 23 fix 1: symmetric to the top-edge gap above - one more blank
  // line (`INTER_PARAGRAPH_GAP`) between the last line (CANCELLATION, or the
  // last boilerplate paragraph if there's no cancellation) and the box's
  // BOTTOM edge. Measured directly against the real PDF: CANCELLATION's
  // baseline y=493.6 down to the box's bottom edge y=466.39 (same outer rect
  // as `boxTopY`'s, bottom = 466.39) is a 27.21pt gap - again close to
  // 2*LEADING (25.2pt), not the bare 1*LEADING `cursor.currentY()` alone
  // (post the last `addLines` call's trailing decrement) already provides.
  cursor.addGap(INTER_PARAGRAPH_GAP);
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
  // Task 24: one blank line (`INTER_PARAGRAPH_GAP`) before the address block
  // - measured directly against the real Vol 17 PDF (fontmap.py, page index
  // 0): "Submit recommended changes..." at y=241.6 down to "CMC (JA)" at
  // y=216.3 is a 25.3pt gap (one blank line), while every subsequent address
  // line (y=216.3 -> 203.5 -> 190.9) steps by the bare ~12.6-12.8pt LEADING
  // with no extra gap between them.
  cursor.addGap(INTER_PARAGRAPH_GAP);
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

  // Task 25 fix 2: bold - measured directly against the real Vol 17 PDF
  // (fontmap.py, page index 2, y=691.4): "REFERENCES" extracts with a
  // `/TimesNewRomanPS-BoldMT` BaseFont, unlike the ordinary regular-weight
  // reference-list body text below it. Previously painted plain.
  cursor.addLines(
    centeredRuns([{ text: 'REFERENCES', bold: true }], HEADING_SIZE_PT),
    HEADING_SIZE_PT,
    'heading',
  );
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
  // Task 21 finding 6: both title lines paint bold in the real PDF, and
  // "TABLE OF CONTENTS" is additionally underlined - measured at page index
  // 1, y=694.3/669.0 (task21-findings.md); ours painted both plain.
  //
  // Task 24: one blank line (`INTER_PARAGRAPH_GAP`) between the two title
  // lines - re-measured directly against the real Vol 17 TOC page
  // (fontmap.py, page index 1): "VOLUME 17: ..." at y=694.3 down to "TABLE
  // OF CONTENTS" at y=669.0 is a 25.3pt gap (one blank line), not the bare
  // ~12.6pt `addLines`' own trailing LEADING step alone produced before this
  // fix.
  cursor.addLines(
    centeredRuns([{ text: `VOLUME ${doc.volume.number}: ${doc.volume.title.toUpperCase()}`, bold: true }], HEADING_SIZE_PT),
    HEADING_SIZE_PT,
  );
  cursor.addGap(INTER_PARAGRAPH_GAP);
  cursor.addLines(
    centeredRuns([{ text: 'TABLE OF CONTENTS', bold: true, underline: true }], HEADING_SIZE_PT),
    HEADING_SIZE_PT,
  );

  // Task 24: NO extra gap here - the real PDF's first entry ("REFERENCES")
  // sits directly under "TABLE OF CONTENTS" with only the ordinary single
  // LEADING step (y=669.0 -> 656.4, a 12.6pt gap), not the `GAP` (25pt) this
  // used to insert. The prior `cursor.addGap()` call that lived here is
  // removed; the first entry now paints right after the heading's own
  // trailing `addLines` decrement.

  // Task 21 finding 6: entries are double-spaced (a blank line between
  // consecutive entries - measured ~29pt entry-to-entry vs. ~14.5pt for a
  // wrapped continuation line within ONE entry, roughly double); a wrapped
  // entry's own continuation lines stay single-spaced (addTocEntry's
  // internal per-line LEADING step, unchanged). Only the gap BETWEEN
  // entries gets the extra blank-line step.
  toc.forEach((entry, i) => {
    if (i > 0) cursor.addGap(INTER_PARAGRAPH_GAP);
    // Task 22: the "APPENDICES" header line (bold, no leader/page) and each
    // per-appendix entry (indented letter + title one ladder stop over) get
    // their own rendering, distinct from the ordinary flush-margin
    // label+leader+page line every other entry uses.
    if (entry.header) {
      cursor.addLines(leftParagraphRuns([{ text: entry.label, bold: true }]));
    } else if (entry.appendix) {
      cursor.addAppendixTocEntry(entry.appendixLetter ?? '', entry.appendixTitle ?? entry.label, entry.page);
    } else {
      // Task 24: the "REFERENCES" entry (and only that entry - see
      // TocEntry.bold's doc comment) renders label+leader+page all bold.
      cursor.addTocEntry(entry.label, entry.page, BODY_SIZE_PT, !!entry.bold);
    }
  });

  return cursor.finish();
}

// ---------------------------------------------------------------------------
// Divider ("Summary of Substantive Changes") - shared by a chapter divider
// ("VOLUME {n}: CHAPTER {m}") and (Task 22) an appendix divider ("VOLUME
// {n}:  APPENDIX {L}"). The two differ only in the heading/title text, the
// title's quoting, and which changeLog feeds the table below - everything
// else (legend, boilerplate, box, table shape) is measured identical on
// both the real Vol 17 chapter divider (page index 3) and its Appendix A
// divider (page index 7, footer "A-1").
// ---------------------------------------------------------------------------
type DividerContext =
  | { kind: 'chapter'; chapter: Chapter }
  | { kind: 'appendix'; appendix: Appendix };

function layoutDivider(cursor: PageCursor, doc: VolumeDoc, ctx: DividerContext) {
  // Task 20: same bordered-box-then-table treatment as layoutTitlePage
  // (measured on the real Vol 17 chapter divider page too - task-20-report.md).
  const boxTopY = cursor.currentY() + LEADING;

  // Task 23 fix 1: same top-edge gap as layoutTitlePage's identical fix -
  // one blank line between the box's TOP edge and the heading line -
  // re-measured on both the real chapter divider (page index 3) and the
  // Appendix A divider (page index 7): box top y=704.14 on both (`re
  // [85.104, 489.79, 441.94, 214.34]` / `re [85.104, 480.31, 441.94,
  // 223.82]`, top = y+height) down to the heading's baseline (681.2 / 680.3
  // respectively) is a ~23pt gap on both - consistent with the title page's
  // ~23pt top gap, so the same `INTER_PARAGRAPH_GAP` fix applies here too.
  cursor.addGap(INTER_PARAGRAPH_GAP);

  // Task 22: the appendix divider's heading prints TWO spaces after the
  // colon ("VOLUME 17:  APPENDIX A") - measured verbatim as a single
  // text-showing operation on the real PDF (fontmap.py, page index 7,
  // y=680.3) - unlike the chapter divider's single space.
  //
  // Task 25 fix 3: quoting follows `doc.volume.titleQuoted` - the SAME flag
  // the title page's own title uses (layoutTitlePage above) - instead of
  // hardcoding quotes on for the chapter divider and off for the appendix
  // divider. Vol 17's own fixture has `titleQuoted: false`, and its real
  // chapter divider (fontmap.py, page index 3) prints the bare
  // "JUDGE ADVOCATE DIVISION AWARDS PROGRAM" with no quote glyphs at all -
  // the previous hardcoded `"${title}"` was simply wrong for this volume (it
  // happened to look plausible only because no test asserted the absence of
  // quotes). A `titleQuoted: true` volume (Vol 1 style) still gets its
  // chapter title quoted, same as its title page. Both titles stay
  // bold+underlined regardless of quoting (confirmed via a measured
  // underline rect at x=172.13,y=651.94,w=267.77 on the Appendix A divider).
  const quoted = doc.volume.titleQuoted !== false;
  const headingText = ctx.kind === 'chapter'
    ? `VOLUME ${doc.volume.number}: CHAPTER ${ctx.chapter.number}`
    : `VOLUME ${doc.volume.number}:  APPENDIX ${ctx.appendix.letter}`;
  const rawTitle = ctx.kind === 'chapter' ? ctx.chapter.title : ctx.appendix.title;
  const titleText = quoted ? `"${rawTitle.toUpperCase()}"` : rawTitle.toUpperCase();
  const changeLog = ctx.kind === 'chapter' ? ctx.chapter.changeLog : ctx.appendix.changeLog;

  // Task 21 finding 3: same rhythm fix as layoutTitlePage - one blank line
  // (`INTER_PARAGRAPH_GAP`) between every heading/legend/boilerplate line on
  // the divider too, re-measured on page index 3 of the real Vol 17 PDF
  // (task21-findings.md).
  cursor.addLines(centeredRuns([{ text: headingText, bold: true }], HEADING_SIZE_PT), HEADING_SIZE_PT);
  cursor.addGap(INTER_PARAGRAPH_GAP);
  cursor.addLines(
    centeredRuns([{ text: titleText, bold: true, underline: true }], HEADING_SIZE_PT),
    HEADING_SIZE_PT,
  );
  cursor.addGap(INTER_PARAGRAPH_GAP);
  cursor.addLines(
    centeredRuns([{ text: 'SUMMARY OF SUBSTANTIVE CHANGES', bold: true }], HEADING_SIZE_PT),
    HEADING_SIZE_PT,
  );
  cursor.addGap(INTER_PARAGRAPH_GAP);

  cursor.addLines(centeredRuns(legendRuns()));
  cursor.addGap(INTER_PARAGRAPH_GAP);

  // Task 21 finding 4: centered per-wrapped-line, like layoutTitlePage's
  // boilerplate - measured on the divider too (x=112.9/104.7, not the left
  // margin). Underline scope unchanged: neither divider boilerplate line
  // underlines "full revision" (re-confirmed: no underline rect near either
  // phrase on page index 3, nor on the appendix divider's page index 7),
  // unlike the title page's third paragraph.
  //
  // Task 25 fix 5: wraps at `DIVIDER_BOILERPLATE_INSET` (narrower than the
  // title page's own `TITLE_BOILERPLATE_INSET`) - see that constant's doc
  // comment for the measured provenance (real wrap points on both the
  // chapter and Appendix A dividers).
  CHAPTER_CHANGE_POLICY_BOILERPLATE.forEach((line, i) => {
    if (i > 0) cursor.addGap(INTER_PARAGRAPH_GAP);
    cursor.addLines(
      centeredParagraphRuns(styleBoilerplateRuns(line, { underlineFullRevision: false }), BODY_SIZE_PT, DIVIDER_BOILERPLATE_INSET),
    );
  });

  // Task 23 fix 1: bottom-edge gap - measured DIFFERENTLY from the title
  // page's, per "measure, don't assume": on the chapter divider, the last
  // boilerplate line's baseline y=529.6 down to the box's bottom edge
  // y=489.79 (`re [85.104, 489.79, 441.94, 214.34]`) is a ~39.81pt gap; on
  // the Appendix A divider, last line y=520.4 down to box bottom y=480.31 is
  // a ~40.09pt gap. Both dividers agree with each other but NOT with the
  // title page's ~27.21pt bottom gap (fix above) - the divider's boilerplate
  // has no trailing "CANCELLATION"-style line, and its box is templated
  // with visibly more trailing whitespace before the change table. `GAP`
  // (25pt, on top of the LEADING already folded into `cursor.currentY()`,
  // for a ~37.6pt total) is the closest existing named constant - about 2pt
  // under both measurements, within this file's usual measurement slop -
  // rather than inventing a new one-off magic number for this single case.
  cursor.addGap(GAP);
  const boxBottomY = cursor.currentY();
  // Fix round 1 (reviewer finding, CRITICAL): see layoutTitlePage's
  // identical comment - addBox must run BEFORE addTable, while
  // `cursor.current` is still guaranteed to be the page holding this
  // divider's text block, since addTable can paginate a long changeLog
  // onto later pages.
  cursor.addBox(boxTopY, boxBottomY);
  // Finding 15 (T10): format spec §4.6 verbatim header, with spaces around
  // the slash.
  const tableCols = ['CHAPTER VERSION', 'PAGE / PARAGRAPH', 'SUMMARY OF SUBSTANTIVE CHANGES', 'DATE OF CHANGE'];
  const tableColWidths = [80, 90, 208, 90];
  // Task 20: see layoutTitlePage's identical comment - this sizes the gap
  // so the table's own top border lands exactly at `boxBottomY` instead of
  // overlapping backward into the boilerplate text above it.
  cursor.addGap(tableHeaderHeight(tableCols, tableColWidths) - 3);
  // Task 25 fix 4: appends 4 blank, unshaded template rows below whatever
  // real changeLog rows exist - see `dividerChangeRows`'s doc comment for the
  // measured provenance (both the chapter and Appendix A dividers).
  cursor.addTable(tableCols, tableColWidths, dividerChangeRows(changeLog));
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
    layoutDivider(cursor, doc, { kind: 'chapter', chapter });
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
// Task 22: appendices - divider (band label "A-1") + content page(s)
// ("A-2", ...), laid out after every chapter. Content renders plain `blocks`
// (flush-left, no CCSSPP designators) and/or a two-column `glossary`.
// ---------------------------------------------------------------------------
function layoutAppendixContent(cursor: PageCursor, appendix: Appendix) {
  // Task 22: measured against the real Vol 17 Appendix A content page
  // (fontmap.py, page index 8) - "APPENDIX {L}" prints bold with no
  // underline (like a chapter title page's "CHAPTER {m}"), but the title
  // below it prints REGULAR weight (not bold, unlike the divider's title)
  // with an underline (measured rect at x=177.05,y=667.66,w=257.93) - it
  // reads like an ordinary (unbolded) section heading, not a repeat of the
  // divider's bold title.
  cursor.addLines(centeredRuns([{ text: `APPENDIX ${appendix.letter}`, bold: true }], HEADING_SIZE_PT), HEADING_SIZE_PT);
  cursor.addLines(centeredRuns([{ text: appendix.title.toUpperCase(), underline: true }]), BODY_SIZE_PT);
  cursor.addGap();

  if (appendix.blocks.length > 0) {
    layoutBodyBlocks(cursor, appendix.blocks, MARGIN, 1);
    if ((appendix.glossary?.length ?? 0) > 0) cursor.addGap();
  }
  for (const entry of appendix.glossary ?? []) {
    cursor.addGlossaryEntry(entry.term, entry.definition);
  }
}

function layoutAppendices(doc: VolumeDoc, toc: TocEntry[]): Page[] {
  const appendixPages: Page[] = [];
  if (doc.appendices.length === 0) return appendixPages;

  // Task 22: a single bold "APPENDICES" TOC line precedes the per-appendix
  // entries, with no leader/page of its own (measured at x=72, bold, on the
  // real Vol 17 TOC page - fontmap.py page index 1, y=307.2).
  toc.push({ label: 'APPENDICES', page: '', level: 0, header: true });

  for (const appendix of doc.appendices) {
    let page = 0;
    const labelFn = () => appendixPageLabel(appendix.letter, ++page);
    const cursor = new PageCursor('appendix', labelFn, undefined, appendix.letter);

    // Divider is page 1 of the appendix ("{L}-1") — content starts on the
    // page right after it, whose label the appendix's own TOC entry points
    // at (the CONTENT page, e.g. "A-2" - NOT the divider "A-1"; see the
    // ground truth in the TOC's own real "A ... A-2" entry).
    layoutDivider(cursor, doc, { kind: 'appendix', appendix });
    cursor.breakPage();
    const contentFirstLabel = cursor.currentLabel();

    layoutAppendixContent(cursor, appendix);
    toc.push({
      label: `${appendix.letter}   ${appendix.title.toUpperCase()}`,
      page: contentFirstLabel,
      level: 0,
      appendix: true,
      appendixLetter: appendix.letter,
      appendixTitle: appendix.title.toUpperCase(),
    });

    appendixPages.push(...cursor.finish());
  }

  return appendixPages;
}

// ---------------------------------------------------------------------------
// layoutVolume
// ---------------------------------------------------------------------------
export function layoutVolume(doc: VolumeDoc): LaidOutDoc {
  const toc: TocEntry[] = [];

  // References: computed (not yet PLACED) before the body walk. Its REF-{n}
  // band is independent of front-matter/body pagination, so its page labels
  // can be resolved before either - the TOC needs the resolved
  // `refFirstLabel` below regardless of where the reference pages themselves
  // end up in the final page sequence.
  //
  // Task 24: the real Vol 17 PDF's own PLACEMENT order is title (i) -> blank
  // verso (ii) -> TABLE OF CONTENTS (iii...) -> REFERENCES (REF band) ->
  // chapter divider/body (fontmap.py: page index 0 = title/footer "i", index
  // 1 = TOC/footer "ii", index 2 = REFERENCES/footer "REF-1", index 3 =
  // chapter divider/footer "1-1") - TOC immediately after the verso, BEFORE
  // References, not after. This is a pure re-ordering of the final `pages`
  // array below; the two-phase label resolution is unaffected (References'
  // own labels never depended on body/TOC layout, and the TOC below still
  // waits for every entry - including this one - to be resolved first).
  const { pages: refPages, firstLabel: refFirstLabel } = layoutReferences(doc);
  // Task 24: this entry renders bold (label+leader+page) in the TOC - see
  // TocEntry.bold's doc comment for the measured provenance.
  toc.push({ label: 'REFERENCES', page: refFirstLabel, level: 0, bold: true });

  // Body walk resolves every section/chapter TOC entry's final page label.
  const bodyPages = layoutBody(doc, toc);

  // Task 22: appendices lay out after every chapter, each in its own
  // letter-prefixed band ("A-1", "A-2", ...), independent of body/front-matter
  // pagination - same independence as layoutReferences' REF-{n} band above.
  const appendixPages = layoutAppendices(doc, toc);

  // Front matter: title page + verso consume roman i/ii; the TOC (built last,
  // now that every entry above is resolved) continues the same roman count.
  let romanIdx = 1;
  const nextRoman = () => toRoman(romanIdx++);
  const titlePages = layoutTitlePage(doc, nextRoman);
  const versoPage = blankVersoPage(nextRoman());
  const tocPages = layoutToc(doc, toc, nextRoman);

  // Task 24: TOC placed immediately after the verso, References placed
  // after the TOC - see the ordering note above.
  return {
    pages: [...titlePages, versoPage, ...tocPages, ...refPages, ...bodyPages, ...appendixPages],
    toc,
  };
}
