/**
 * E.1 - the same-page endorsement (SECNAV M-5216.5 9-1, 9-2.1.a,
 * Figure 9-1).
 *
 * The manual leaves the placement to a measurement, not to taste:
 * "If it will completely fit on the signature page of the basic letter
 * or the preceding endorsement, you may add it to that page. If not,
 * use a new-page endorsement." (9-1). So the decision belongs to
 * whatever knows the geometry of both documents, and nothing on the
 * form can answer it. This module holds that arithmetic.
 *
 * Everything here is pure over PDF bytes. The browser package export,
 * the headless companion and the tests all run the same code, and no
 * function reaches for the DOM, a blob URL or a React tree. The PDF
 * engines load through dynamic imports so this module stays out of the
 * first-load bundle.
 *
 * Figure 9-1 draws a horizontal rule between the basic letter and the
 * first endorsement. The text of 9-2 prescribes no such rule, and the
 * figure's rule reads as a separator between two documents printed on
 * one illustrated page. Nothing is drawn here.
 */

import { PDF_MARGINS, LINE_HEIGHT_12PT } from '@/lib/pdf-settings';
import type { FormData } from '@/types';

/** Blank lines between the host's last line and the block's first. */
export const SAME_PAGE_GAP_LINES = 2;

/**
 * Text within the bottom margin band is furniture, not content: the
 * page-number footer, the classification banner and the distribution
 * statement all live there. The last CONTENT line is the lowest
 * baseline above the band.
 */
export const CONTENT_FLOOR = PDF_MARGINS.bottom;

/** True when this document is an endorsement placed on the signature page. */
export function isSamePageEndorsement(
  formData: Pick<FormData, 'documentType' | 'endorsementPlacement'>,
): boolean {
  return formData.documentType === 'endorsement'
    && formData.endorsementPlacement === 'same-page';
}

/**
 * 9-2.1.a: the omission is the manual's own default for a same-page
 * endorsement (Figure 9-1 prints neither the SSIC nor a subject), so
 * an unset flag reads as true. It is read only for a same-page
 * endorsement; a new-page endorsement always carries the SSIC, the
 * subject and the basic letter's identification (Figure 9-1, second
 * endorsement).
 */
export function omitsIdentification(
  formData: Pick<FormData, 'documentType' | 'endorsementPlacement' | 'samePageOmitsIdentification'>,
): boolean {
  if (!isSamePageEndorsement(formData)) return false;
  return formData.samePageOmitsIdentification !== false;
}

/**
 * 9-2.1.b: "FIRST ENDORSEMENT on" plus the basic letter in reference
 * style. With the 9-2.1.a omission taken, Figure 9-1 shows the line as
 * the ordinal and the word alone.
 */
export function endorsementLineText(formData: FormData): string {
  const level = String(formData.endorsementLevel ?? '').trim();
  if (!level) return '';
  const reference = String(formData.basicLetterReference ?? '').trim();
  if (omitsIdentification(formData) || !reference) return `${level} ENDORSEMENT`;
  return `${level} ENDORSEMENT on ${reference}`;
}

export interface TextExtent {
  /** Highest text baseline on the page, in PDF points from the bottom. */
  top: number;
  /** Lowest text baseline on the page. */
  bottom: number;
  /** top minus bottom. Zero for a single line. */
  height: number;
}

interface PositionedItem {
  y: number;
  text: string;
}

/**
 * Reads positioned text from one page. pdfjs is loaded the way the app
 * already loads it (src/services/import/documentTextExtractor.ts): the
 * package's own entry point, with the vendored same-origin worker in
 * the browser and the built-in fake worker under Node.
 */
async function pageItems(pdfBytes: Uint8Array, pageIndex: number): Promise<PositionedItem[]> {
  const pdfjs = await import('pdfjs-dist');
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    const { getPdfWorkerSrc } = await import('@/lib/pdf-worker');
    pdfjs.GlobalWorkerOptions.workerSrc = getPdfWorkerSrc();
  }
  // The copy is deliberate: pdfjs transfers the buffer it is handed to
  // its worker, which detaches the caller's array.
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  try {
    if (pageIndex < 0 || pageIndex >= doc.numPages) return [];
    const page = await doc.getPage(pageIndex + 1);
    const content = await page.getTextContent();
    const items: PositionedItem[] = [];
    for (const item of content.items as Array<{ str?: unknown; transform?: number[] }>) {
      if (typeof item.str !== 'string' || item.str.trim() === '') continue;
      if (!Array.isArray(item.transform)) continue;
      items.push({ y: item.transform[5], text: item.str });
    }
    return items;
  } finally {
    await doc.destroy();
  }
}

/** Page count, read through the engine already loaded here. */
async function pageCount(pdfBytes: Uint8Array): Promise<number> {
  const pdfjs = await import('pdfjs-dist');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  try {
    return doc.numPages;
  } finally {
    await doc.destroy();
  }
}

/**
 * The baseline of the last line of content on the given page, or null
 * when the page carries no text above the footer band.
 */
export async function measureLastContent(
  pdfBytes: Uint8Array,
  pageIndex: number,
): Promise<number | null> {
  const items = (await pageItems(pdfBytes, pageIndex)).filter((i) => i.y >= CONTENT_FLOOR);
  if (items.length === 0) return null;
  return items.reduce((lowest, item) => Math.min(lowest, item.y), Infinity);
}

export interface BlockExtent extends TextExtent {
  /** Pages the block rendered to. More than one never fits anywhere. */
  pages: number;
}

/** Top and bottom baselines of the block's first page, and its length. */
export async function measureBlockExtent(blockPdfBytes: Uint8Array): Promise<BlockExtent> {
  const pages = await pageCount(blockPdfBytes);
  const items = await pageItems(blockPdfBytes, 0);
  if (items.length === 0) {
    return { top: 0, bottom: 0, height: 0, pages };
  }
  const top = items.reduce((highest, item) => Math.max(highest, item.y), -Infinity);
  const bottom = items.reduce((lowest, item) => Math.min(lowest, item.y), Infinity);
  return { top, bottom, height: top - bottom, pages };
}

export interface ComposeOptions {
  /**
   * Blank lines between the host's last content line and the block's
   * first. Two by default, the spacing the manual uses everywhere it
   * says "on the second line below".
   */
  gapLines?: number;
}

export interface ComposeFits {
  fits: true;
  bytes: Uint8Array;
  /** Baseline of the host's last content line. */
  hostLastBaseline: number;
  /** Baseline the block's first line was placed on. */
  blockFirstBaseline: number;
  /** Baseline the block's last line was placed on. */
  blockLastBaseline: number;
  /** Pages in the composed document. Unchanged from the host. */
  pages: number;
}

export interface ComposeDoesNotFit {
  fits: false;
  reason: string;
  hostLastBaseline: number | null;
  blockHeight: number;
}

export type ComposeResult = ComposeFits | ComposeDoesNotFit;

/**
 * Draws the endorsement block onto the last page of the host document
 * when 9-1's fit test passes.
 *
 * The block page is embedded cropped to the band its text occupies, so
 * the drawn form covers nothing above the host's last line, and it is
 * translated so the block's first baseline lands two lines below that
 * last line. The composed document has exactly the host's page count,
 * which is the point of a same-page endorsement: it adds no page, so
 * it disturbs no page number in the package.
 */
export async function composeSamePage(
  hostPdfBytes: Uint8Array,
  blockPdfBytes: Uint8Array,
  options: ComposeOptions = {},
): Promise<ComposeResult> {
  const gap = (options.gapLines ?? SAME_PAGE_GAP_LINES) * LINE_HEIGHT_12PT;
  const extent = await measureBlockExtent(blockPdfBytes);

  const { PDFDocument } = await import('pdf-lib');
  const host = await PDFDocument.load(hostPdfBytes);
  const hostPageIndex = host.getPageCount() - 1;
  const hostLastBaseline = await measureLastContent(hostPdfBytes, hostPageIndex);

  if (extent.pages > 1) {
    return {
      fits: false,
      reason: `The endorsement runs to ${extent.pages} pages, so it does not fit on a signature page (9-1).`,
      hostLastBaseline,
      blockHeight: extent.height,
    };
  }
  if (hostLastBaseline === null) {
    return {
      fits: false,
      reason: 'The last page of the document being endorsed carries no text to measure against.',
      hostLastBaseline,
      blockHeight: extent.height,
    };
  }

  const available = hostLastBaseline - CONTENT_FLOOR;
  if (extent.height + gap > available) {
    return {
      fits: false,
      reason: `The endorsement needs ${Math.round(extent.height + gap)} pt below the last line and the signature page has ${Math.round(available)} pt, so 9-1 calls for a new-page endorsement.`,
      hostLastBaseline,
      blockHeight: extent.height,
    };
  }

  const blockDoc = await PDFDocument.load(blockPdfBytes);
  // Crop to the text band, one line of ascent above the top baseline
  // and a third of a line of descent below the bottom one, so nothing
  // the block page paints outside its own text reaches the host page.
  const cropTop = extent.top + LINE_HEIGHT_12PT;
  const cropBottom = extent.bottom - LINE_HEIGHT_12PT / 3;
  const [blockPage] = blockDoc.getPages();
  const { width: blockWidth } = blockPage.getSize();
  const embedded = await host.embedPage(blockPage, {
    left: 0,
    bottom: cropBottom,
    right: blockWidth,
    top: cropTop,
  });

  const blockFirstBaseline = hostLastBaseline - gap;
  // A source point s lands at drawY plus (s minus cropBottom), so
  // placing the top baseline on blockFirstBaseline fixes drawY.
  const drawY = blockFirstBaseline - extent.top + cropBottom;
  host.getPage(hostPageIndex).drawPage(embedded, { x: 0, y: drawY });

  const bytes = await host.save();
  return {
    fits: true,
    bytes,
    hostLastBaseline,
    blockFirstBaseline,
    blockLastBaseline: blockFirstBaseline - extent.height,
    pages: host.getPageCount(),
  };
}
