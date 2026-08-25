/**
 * Renders a JAGMAN Appendix A-1 form to PDF.
 *
 * These appendices are FIXED WIDTH. Their column alignment and their
 * underscore rules only line up in a monospace face, so this renders in
 * Courier and never in the proportional faces the letter pipeline uses.
 * Handing this text to a Times renderer produces a page where the CO, ACC,
 * and WIT column drifts and the signature rules stop meeting their labels.
 *
 * The type size is DERIVED from the appendix's own longest line rather than
 * fixed, so a regenerated appendix or a longer fill still fits the page
 * without a code change. Courier is metrically exact at 0.6 em per glyph,
 * which is what makes that calculation reliable rather than approximate.
 *
 * Page furniture. The extractor stripped the instruction's own running head
 * and page footers, because its pagination has nothing to do with this
 * one. Equivalents go back on here: a reader holding a printed copy needs to
 * know which appendix it is and which edition it came from, and the original
 * carried exactly that.
 */

import type { JagmanAppendix } from '@/lib/jagman-appendix-a1';
import { JAGMAN_A1_SOURCE, jagmanCitation } from '@/lib/jagman-appendix-a1';

/** US Letter, the size every other generator in this app uses. */
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
/** One inch, matching coordinationPageGenerator. */
const MARGIN = 72;
/** Room reserved at the foot for the designator and the page count. */
const FOOTER_HEIGHT = 36;
/** Room reserved at the head for the citation. */
const HEADER_HEIGHT = 28;

/** Courier advance width per glyph, in em. Exact, not an approximation. */
const COURIER_ADVANCE = 0.6;

/** Largest body size. Bigger reads as a letter rather than a form. */
const MAX_BODY_SIZE = 11;
/** Smallest body size worth printing. Below this a clerk cannot read it. */
const MIN_BODY_SIZE = 7;

export interface RenderAppendixPdfOptions {
  /** Overrides the derived body size. Use only to match an existing print. */
  bodySize?: number;
  /** Adds a line above the citation, for instance the accused's name. */
  caption?: string;
}

export class JagmanA1RenderError extends Error {}

/**
 * The largest size at or below MAX_BODY_SIZE where the appendix's longest
 * line still fits the content width.
 *
 * Throws rather than silently shrinking past legibility. A line long enough
 * to force sub-seven-point type means a caller's fill blew past the
 * appendix measure, which the wrap helper exists to prevent, so this is a
 * bug report rather than a layout decision.
 */
export function deriveBodySize(lines: readonly string[]): number {
  const widest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  if (widest === 0) return MAX_BODY_SIZE;

  const available = PAGE_WIDTH - MARGIN * 2;
  const exact = available / (widest * COURIER_ADVANCE);
  const size = Math.min(MAX_BODY_SIZE, Math.floor(exact * 10) / 10);

  if (size < MIN_BODY_SIZE) {
    throw new JagmanA1RenderError(
      `Longest line is ${widest} characters, which needs ${size}pt Courier to fit a ` +
        `${available}pt content width. Below ${MIN_BODY_SIZE}pt is unreadable. A caller ` +
        'wrapped its fill past the appendix measure, see jagman-a1-wrap.ts.',
    );
  }
  return size;
}

/** Lines per page at a given body size, given the reserved head and foot. */
export function linesPerPage(bodySize: number): number {
  const leading = bodySize * 1.15;
  const usable = PAGE_HEIGHT - MARGIN * 2 - HEADER_HEIGHT - FOOTER_HEIGHT;
  return Math.max(1, Math.floor(usable / leading));
}

/**
 * WinAnsi covers the curly apostrophe the instruction's own text uses, so
 * nothing is normally replaced. This exists for the character that is not
 * covered: pdf-lib throws on an unencodable glyph, which would take the
 * whole preview down, and losing one character beats losing the document.
 * Every substitution is reported so a silent alteration is impossible.
 */
export function sanitizeForCourier(
  lines: readonly string[],
): { lines: string[]; replaced: Array<[number, string]> } {
  const replaced: Array<[number, string]> = [];
  const out = lines.map((line, index) => {
    let result = '';
    for (const ch of line) {
      const code = ch.codePointAt(0) ?? 0;
      // Printable ASCII, plus the typographic marks WinAnsi carries.
      if (code >= 0x20 && code <= 0x7e) {
        result += ch;
        continue;
      }
      if ('‘’“”–—…'.includes(ch)) {
        result += ch;
        continue;
      }
      replaced.push([index, ch]);
      result += '?';
    }
    return result;
  });
  return { lines: out, replaced };
}

export interface AppendixPdfResult {
  bytes: Uint8Array;
  pageCount: number;
  bodySize: number;
  /** Characters swapped for a question mark. Empty on every normal render. */
  replaced: Array<[number, string]>;
}

/**
 * Renders `lines` as the given appendix.
 *
 * `lines` is what a generator returned, NOT `appendix.text`. The appendix
 * carries the designator, the title, and the citation for the furniture.
 */
export async function renderAppendixPdf(
  appendix: JagmanAppendix,
  lines: readonly string[],
  options?: RenderAppendixPdfOptions,
): Promise<AppendixPdfResult> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const { lines: safe, replaced } = sanitizeForCourier(lines);
  const bodySize = options?.bodySize ?? deriveBodySize(safe);
  const perPage = linesPerPage(bodySize);
  const leading = bodySize * 1.15;

  const doc = await PDFDocument.create();
  const body = await doc.embedFont(StandardFonts.Courier);
  const bold = await doc.embedFont(StandardFonts.CourierBold);
  const ink = rgb(0.1, 0.1, 0.1);
  const faint = rgb(0.42, 0.42, 0.42);

  doc.setTitle(`${appendix.designator} ${appendix.title}`);
  doc.setSubject(jagmanCitation(appendix.designator));
  doc.setProducer('SemperScribe');

  const pages: string[][] = [];
  for (let i = 0; i < safe.length; i += perPage) {
    pages.push(safe.slice(i, i + perPage));
  }
  if (pages.length === 0) pages.push([]);

  const citation = jagmanCitation(appendix.designator);
  const footSize = Math.max(6, bodySize - 2);

  pages.forEach((pageLines, pageIndex) => {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    page.drawText(citation, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN + 10,
      size: footSize,
      font: body,
      color: faint,
    });

    if (options?.caption && pageIndex === 0) {
      page.drawText(options.caption, {
        x: MARGIN,
        y: PAGE_HEIGHT - MARGIN - 2,
        size: footSize,
        font: bold,
        color: faint,
      });
    }

    let y = PAGE_HEIGHT - MARGIN - HEADER_HEIGHT;
    for (const line of pageLines) {
      if (line.trim() !== '') {
        page.drawText(line, { x: MARGIN, y, size: bodySize, font: body, color: ink });
      }
      y -= leading;
    }

    const foot = `${appendix.designator}    Page ${pageIndex + 1} of ${pages.length}`;
    page.drawText(foot, {
      x: MARGIN,
      y: MARGIN - 18,
      size: footSize,
      font: body,
      color: faint,
    });
    page.drawText(JAGMAN_A1_SOURCE.instruction, {
      x: PAGE_WIDTH - MARGIN - JAGMAN_A1_SOURCE.instruction.length * footSize * COURIER_ADVANCE,
      y: MARGIN - 18,
      size: footSize,
      font: body,
      color: faint,
    });
  });

  return {
    bytes: await doc.save(),
    pageCount: pages.length,
    bodySize,
    replaced,
  };
}
