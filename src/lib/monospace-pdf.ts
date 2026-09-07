/**
 * Fixed-width page renderer.
 *
 * THE GENERIC HALF OF jagman-a1-pdf.ts, extracted 2026-08-26 when the unit
 * diary worksheet became a second caller. Nothing here knows what it is
 * printing: it takes lines, a title, and page furniture, and it places
 * caller-supplied text. Both callers hand it text their own module composed.
 *
 * WHY MONOSPACE AT ALL, and why this is not a style preference. Everything
 * printed through here is COLUMN-ALIGNED by character count rather than by
 * measured width: the JAGMAN appendices align their CO, ACC and WIT columns
 * and their signature rules that way, and an MCTFS statement is a
 * byte-positional record whose prompts a clerk reads off in order. Set
 * either in a proportional face and the columns drift while every character
 * is still present, which is the failure mode a substring test cannot see.
 *
 * THE TYPE SIZE IS DERIVED from the longest line rather than fixed, so a
 * longer fill still fits the page without a code change. Courier is
 * metrically exact at 0.6 em per glyph, which is what makes that
 * calculation reliable rather than approximate.
 */

/** US Letter, the size every other generator in this app uses. */
export const PAGE_WIDTH = 612;
export const PAGE_HEIGHT = 792;
/** One inch, matching coordinationPageGenerator. */
export const MARGIN = 72;
/** Room reserved at the foot for the designator and the page count. */
export const FOOTER_HEIGHT = 36;
/** Room reserved at the head for the citation. */
export const HEADER_HEIGHT = 28;

/** Courier advance width per glyph, in em. Exact, not an approximation. */
export const COURIER_ADVANCE = 0.6;

/** Largest body size. Bigger reads as a letter rather than a form. */
export const MAX_BODY_SIZE = 11;
/** Smallest body size worth printing. Below this a clerk cannot read it. */
export const MIN_BODY_SIZE = 7;

export class MonospaceRenderError extends Error {}

/**
 * The largest size at or below MAX_BODY_SIZE where the longest line still
 * fits the content width.
 *
 * Throws rather than silently shrinking past legibility. A line long enough
 * to force sub-seven-point type means a caller's fill blew past the measure
 * its own wrap helper exists to enforce, so this is a bug report rather than
 * a layout decision.
 */
export function deriveBodySize(lines: readonly string[]): number {
  const widest = lines.reduce((max, line) => Math.max(max, line.length), 0);
  if (widest === 0) return MAX_BODY_SIZE;

  const available = PAGE_WIDTH - MARGIN * 2;
  const exact = available / (widest * COURIER_ADVANCE);
  const size = Math.min(MAX_BODY_SIZE, Math.floor(exact * 10) / 10);

  if (size < MIN_BODY_SIZE) {
    throw new MonospaceRenderError(
      `Longest line is ${widest} characters, which needs ${size}pt Courier to fit a ` +
        `${available}pt content width. Below ${MIN_BODY_SIZE}pt is unreadable. A caller ` +
        'wrapped its fill past the measure, see jagman-a1-wrap.ts.',
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
 * WinAnsi covers the curly apostrophe the JAGMAN instruction's own text
 * uses, so nothing is normally replaced. This exists for the character that
 * is not covered: pdf-lib throws on an unencodable glyph, which would take
 * the whole preview down, and losing one character beats losing the
 * document. Every substitution is reported so a silent alteration is
 * impossible.
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

export interface MonospacePdfFurniture {
  /** PDF document title. */
  title: string;
  /** PDF document subject. Normally the governing citation. */
  subject: string;
  /** Faint line at the head of every page. Normally the citation. */
  header: string;
  /**
   * Foot of every page, left side. The page count is appended, so pass the
   * designator alone.
   */
  footerLeft: string;
  /** Foot of every page, right side. Normally the source instruction. */
  footerRight: string;
  /** Bold line under the header, first page only. */
  caption?: string;
  /** Overrides the derived body size. Use only to match an existing print. */
  bodySize?: number;
}

export interface MonospacePdfResult {
  bytes: Uint8Array;
  pageCount: number;
  bodySize: number;
  /** Characters swapped for a question mark. Empty on every normal render. */
  replaced: Array<[number, string]>;
}

/**
 * Renders `lines` as a fixed-width document.
 *
 * PAGINATION IS BY LINE COUNT ALONE. A caller that needs a block kept
 * together pads its own lines, because this module cannot know which of a
 * caller's lines belong to one another. The unit diary worksheet does
 * exactly that for its transaction blocks.
 */
export async function renderMonospacePdf(
  lines: readonly string[],
  furniture: MonospacePdfFurniture,
): Promise<MonospacePdfResult> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');

  const { lines: safe, replaced } = sanitizeForCourier(lines);
  const bodySize = furniture.bodySize ?? deriveBodySize(safe);
  const perPage = linesPerPage(bodySize);
  const leading = bodySize * 1.15;

  const doc = await PDFDocument.create();
  const body = await doc.embedFont(StandardFonts.Courier);
  const bold = await doc.embedFont(StandardFonts.CourierBold);
  const ink = rgb(0.1, 0.1, 0.1);
  const faint = rgb(0.42, 0.42, 0.42);

  doc.setTitle(furniture.title);
  doc.setSubject(furniture.subject);
  doc.setProducer('SemperScribe');

  const pages: string[][] = [];
  for (let i = 0; i < safe.length; i += perPage) {
    pages.push(safe.slice(i, i + perPage));
  }
  if (pages.length === 0) pages.push([]);

  const footSize = Math.max(6, bodySize - 2);

  pages.forEach((pageLines, pageIndex) => {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

    page.drawText(furniture.header, {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN + 10,
      size: footSize,
      font: body,
      color: faint,
    });

    if (furniture.caption && pageIndex === 0) {
      page.drawText(furniture.caption, {
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

    const foot = `${furniture.footerLeft}    Page ${pageIndex + 1} of ${pages.length}`;
    page.drawText(foot, {
      x: MARGIN,
      y: MARGIN - 18,
      size: footSize,
      font: body,
      color: faint,
    });
    page.drawText(furniture.footerRight, {
      x: PAGE_WIDTH - MARGIN - furniture.footerRight.length * footSize * COURIER_ADVANCE,
      y: MARGIN - 18,
      size: footSize,
      font: body,
      color: faint,
    });
  });

  return { bytes: await doc.save(), pageCount: pages.length, bodySize, replaced };
}
