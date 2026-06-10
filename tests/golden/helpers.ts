/**
 * Shared helpers for the Phase 0 parity harness.
 * Test-only code. No src/ imports are modified by this harness.
 */
import JSZip from 'jszip';

/**
 * Extract word/document.xml from a generated DOCX blob and pretty-print
 * it one tag per line so snapshot diffs are line-scoped and reviewable.
 */
export async function docxToDocumentXml(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('word/document.xml missing from DOCX package');
  const xml = await file.async('string');
  return prettyXml(xml);
}

/** Insert a newline between adjacent tags. Deterministic, no reordering. */
export function prettyXml(xml: string): string {
  return xml.replace(/></g, '>\n<');
}

export interface PdfTextItem {
  page: number;
  x: number;
  y: number;
  text: string;
}

/**
 * Extract positioned text items from a PDF blob using pdfjs-dist.
 * Coordinates are PDF points rounded to 1 decimal, origin bottom-left.
 */
export async function extractPdfTextLayout(blob: Blob): Promise<PdfTextItem[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
  const items: PdfTextItem[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    for (const item of content.items as any[]) {
      if (typeof item.str !== 'string' || item.str === '') continue;
      items.push({
        page: p,
        x: Math.round(item.transform[4] * 10) / 10,
        y: Math.round(item.transform[5] * 10) / 10,
        text: item.str,
      });
    }
  }
  await doc.destroy();
  return items;
}

/** Render the layout as a stable text table for file snapshots. */
export function layoutToSnapshotText(items: PdfTextItem[]): string {
  return items
    .map((i) => `p${i.page} x=${i.x.toFixed(1)} y=${i.y.toFixed(1)} | ${i.text}`)
    .join('\n');
}

/** First page on which the given marker string appears, or -1. */
export function pageOfMarker(items: PdfTextItem[], marker: string): number {
  // Text items can split a marker across runs; join per page first.
  const byPage = new Map<number, string>();
  for (const i of items) {
    byPage.set(i.page, (byPage.get(i.page) ?? '') + i.text);
  }
  for (const [page, text] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
    if (text.includes(marker)) return page;
  }
  return -1;
}
