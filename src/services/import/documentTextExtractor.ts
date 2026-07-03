import { ExtractedText, SourceFormat } from './extractionTypes';
import { linesFromText } from './correspondenceParser';

/**
 * Browser-side text extraction for the document import pipeline:
 * .docx via mammoth, .pdf via pdfjs-dist. Both libraries are loaded with
 * dynamic import() so they never touch the main bundle, and no data
 * leaves the browser (local-first posture — see SECURITY.md).
 */

/** Thrown for user-facing extraction failures; message is shown verbatim. */
export class DocumentExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DocumentExtractionError';
  }
}

const NO_TEXT_MESSAGE =
  'No text could be extracted from this file. If it is a scanned image ' +
  '(no text layer), it cannot be imported — try an original digital copy.';

export function detectSourceFormat(fileName: string, data: ArrayBuffer): SourceFormat | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.pdf')) return 'pdf';
  // Fallback: sniff magic bytes (PK zip header for docx, %PDF for pdf).
  const head = new Uint8Array(data.slice(0, 5));
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf';
  if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04) return 'docx';
  return null;
}

export async function extractDocumentText(data: ArrayBuffer, fileName: string): Promise<ExtractedText> {
  const format = detectSourceFormat(fileName, data);
  if (format === 'docx') return extractDocx(data);
  if (format === 'pdf') return extractPdf(data);
  throw new DocumentExtractionError(
    `"${fileName}" is not a supported file type. Upload a Word document (.docx) or a PDF.`,
  );
}

async function extractDocx(data: ArrayBuffer): Promise<ExtractedText> {
  const mammoth = await import('mammoth');
  let value: string;
  const warnings: string[] = [];
  try {
    // mammoth's browser build reads options.arrayBuffer, the node build
    // (used by vitest) reads options.buffer — pass both, they are ignored
    // by the build that doesn't use them.
    const input = { arrayBuffer: data, buffer: data } as unknown as { arrayBuffer: ArrayBuffer };
    const result = await mammoth.extractRawText(input);
    value = result.value;
    for (const message of result.messages) {
      if (message.type === 'warning' || message.type === 'error') {
        warnings.push(`Word extraction: ${message.message}`);
      }
    }
  } catch (err) {
    throw new DocumentExtractionError(
      `Could not read this Word document. It may be corrupt or in the legacy .doc format. (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  // mammoth terminates every docx paragraph with "\n\n", so a single blank
  // line is a paragraph-boundary artifact, not document structure. Splitting
  // on the separator restores the true lines: intentionally empty paragraphs
  // become empty items and survive as real blank lines.
  const lines = linesFromText(value.split('\n\n').join('\n'));
  if (lines.length === 0) {
    throw new DocumentExtractionError(NO_TEXT_MESSAGE);
  }
  return { lines, sourceFormat: 'docx', warnings };
}

/** The subset of pdfjs TextItem the line assembler needs. */
export interface PdfTextItem {
  str: string;
  /** pdfjs transform matrix; [4] is x, [5] is y in page space. */
  transform: number[];
  width?: number;
}

/**
 * Reassembles pdfjs text items into visual lines: items whose baselines
 * are within a small tolerance share a line (top of page first), and a
 * space is inserted between items only when there is a horizontal gap —
 * pdfs routinely split a single word across items.
 */
export function assemblePdfLines(items: PdfTextItem[]): string[] {
  const Y_TOLERANCE = 2;
  const rows: { y: number; items: { x: number; str: string; width: number }[] }[] = [];
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue;
    if (!Array.isArray(item.transform) || item.transform.length < 6) continue;
    const x = item.transform[4];
    const y = item.transform[5];
    let row = rows.find(r => Math.abs(r.y - y) <= Y_TOLERANCE);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push({ x, str: item.str, width: item.width ?? 0 });
  }

  rows.sort((a, b) => b.y - a.y);
  return rows.map(row => {
    row.items.sort((a, b) => a.x - b.x);
    let line = '';
    let prevEnd: number | null = null;
    for (const item of row.items) {
      if (prevEnd !== null && item.x - prevEnd > 1 && !line.endsWith(' ')) line += ' ';
      line += item.str;
      prevEnd = item.x + item.width;
    }
    return line;
  });
}

async function extractPdf(data: ArrayBuffer): Promise<ExtractedText> {
  const pdfjs = await import('pdfjs-dist');
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    // Same CDN worker configuration the app's react-pdf views use.
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  }

  let doc;
  try {
    // The slice is deliberate, not a redundant copy: pdfjs transfers the
    // buffer it is given to its worker, detaching the caller's ArrayBuffer.
    doc = await pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) }).promise;
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    if (name === 'PasswordException') {
      throw new DocumentExtractionError('This PDF is password-protected and cannot be imported.');
    }
    throw new DocumentExtractionError(
      `Could not read this PDF. It may be corrupt. (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  const warnings: string[] = [];
  const rawLines: string[] = [];
  let emptyPages = 0;
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const content = await page.getTextContent();
      const pageLines = assemblePdfLines(content.items as PdfTextItem[]);
      if (pageLines.length === 0) {
        emptyPages++;
        warnings.push(`Page ${pageNum} has no text (scanned image?).`);
        continue;
      }
      if (rawLines.length > 0) rawLines.push('');
      rawLines.push(...pageLines);
    }
  } finally {
    await doc.destroy();
  }

  const lines = linesFromText(rawLines.join('\n'));
  if (lines.length === 0) {
    throw new DocumentExtractionError(
      'This PDF appears to be a scanned image with no text layer, so its text cannot be extracted. Try an original digital copy.',
    );
  }
  if (emptyPages > 0 && emptyPages < doc.numPages) {
    warnings.push('Some pages had no extractable text; the import may be incomplete.');
  }
  return { lines, sourceFormat: 'pdf', warnings };
}
