import type { Block, Paragraph, Run, Section, SubPara, VolumeDoc } from '@/lib/schemas/volume-schema';
import { paragraphDesignator, sectionDesignator, subParaDesignator } from '@/lib/volume/designators';
import { designatorX, RUNOVER_X, textStartX } from '@/lib/volume/volume-indent';
import { bodyPageLabel, toRoman } from '@/lib/volume/page-bands';
import { wrapRuns, type WrappedSegment } from '@/lib/volume/measure';

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

const BODY_SIZE_PT = 11;

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
}
export interface TableItem {
  kind: 'table';
  x: number;
  y: number;
  width: number;
  height: number;
}
export type PaintItem = LineItem | HeadingItem | FigureItem | TableItem;

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
    this.pages.push(this.current);
    this.current = { label: this.labelFn(), band: this.band, chapter: this.chapter, items: [] };
    this.y = TOP_TEXT_Y;
  }

  /** Ensure there is room for one more line before appending. */
  private ensureRoom() {
    if (this.y < BOTTOM_Y + LEADING) this.newPage();
  }

  currentLabel(): string {
    return this.current.label;
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

  addGap(gap = GAP) {
    this.y -= gap;
    if (this.y < BOTTOM_Y) this.newPage();
  }

  finish(): Page[] {
    if (this.current.items.length > 0 || this.pages.length === 0) this.pages.push(this.current);
    return this.pages;
  }
}

// ---------------------------------------------------------------------------
// Body-block layout helpers
// ---------------------------------------------------------------------------
function layoutBlockLines(cursor: PageCursor, block: Block, x: number) {
  const lines = wrapRuns(block.runs, x, RUNOVER_X, RIGHT_EDGE, BODY_SIZE_PT);
  cursor.addLines(lines);
}

function layoutSubPara(cursor: PageCursor, sub: SubPara, level: 1 | 2 | 3 | 4) {
  const designator = subParaDesignator(sub.style, sub.seq);
  const bodyRuns = sub.title
    ? [{ text: `${sub.title}. ` }, ...sub.body.flatMap(b => b.runs)]
    : sub.body.flatMap(b => b.runs);
  cursor.addDesignatedLines(designator, level, bodyRuns);
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
  const bodyRuns = para.title
    ? [{ text: `${para.title}. ` }, ...para.body.flatMap(b => b.runs)]
    : para.body.flatMap(b => b.runs);
  cursor.addDesignatedLines(designator, level, bodyRuns);
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
  cursor.addDesignatedLines(designator, 1, [{ text: headingText }], BODY_SIZE_PT, 'heading');
  toc.push({ label: `${designator} ${headingText}`.trim(), page: cursor.currentLabel(), level: 1 });

  if (section.body && section.body.length > 0) {
    for (const block of section.body) {
      layoutBlockLines(cursor, block, designatorX(1));
    }
  } else {
    for (const para of section.paragraphs) {
      layoutParagraph(cursor, chapter, section.seq, para);
    }
  }
}

// ---------------------------------------------------------------------------
// Front matter
// ---------------------------------------------------------------------------
function layoutFrontMatter(doc: VolumeDoc): Page[] {
  let romanIdx = 1;
  const nextRoman = () => toRoman(romanIdx++);

  const pages: Page[] = [];

  // Title page.
  const titleCursor = new PageCursor('front', nextRoman);
  titleCursor.addLines(
    wrapRuns([{ text: doc.order.designator }], MARGIN, RUNOVER_X, RIGHT_EDGE, 14),
    14,
  );
  titleCursor.addLines(
    wrapRuns([{ text: doc.order.policyTitle }], MARGIN, RUNOVER_X, RIGHT_EDGE, 12),
    12,
  );
  titleCursor.addLines(
    wrapRuns(
      [{ text: `VOLUME ${doc.volume.number}: ${doc.volume.title}` }],
      MARGIN,
      RUNOVER_X,
      RIGHT_EDGE,
      12,
    ),
    12,
  );
  pages.push(...titleCursor.finish());

  // Blank verso page.
  pages.push({ label: nextRoman(), band: 'front', items: [] });

  // References list + summary (still front-matter roman pages).
  const refListCursor = new PageCursor('front', nextRoman);
  refListCursor.addLines(
    wrapRuns([{ text: 'REFERENCES' }], designatorX(1), RUNOVER_X, RIGHT_EDGE, BODY_SIZE_PT),
    BODY_SIZE_PT,
    'heading',
  );
  for (const ref of doc.references) {
    refListCursor.addLines(
      wrapRuns([{ text: ref.text }], designatorX(1), RUNOVER_X, RIGHT_EDGE, BODY_SIZE_PT),
    );
  }
  pages.push(...refListCursor.finish());

  // TOC placeholder page — entries are collected during the body walk that
  // follows (see layoutVolume); the real TOC page is composed in Task 10.
  pages.push({ label: nextRoman(), band: 'front', items: [] });

  return pages;
}

// ---------------------------------------------------------------------------
// layoutVolume
// ---------------------------------------------------------------------------
export function layoutVolume(doc: VolumeDoc): LaidOutDoc {
  const toc: TocEntry[] = [];
  const frontPages = layoutFrontMatter(doc);

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

    for (const section of chapter.sections) {
      layoutSection(cursor, chapter.number, section, doc.volume.sectionPeriod, toc);
      cursor.addGap();
    }

    bodyPages.push(...cursor.finish());
  }

  return {
    pages: [...frontPages, ...bodyPages],
    toc,
  };
}
