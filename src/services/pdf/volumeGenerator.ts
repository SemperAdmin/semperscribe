import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type { VolumeDoc } from '@/lib/schemas/volume-schema';
import { layoutVolume, PAGE_H, PAGE_W, type Page as LaidOutPage, type PaintItem } from '@/lib/volume/layout';

const BLACK = rgb(0, 0, 0);
const BLUE = rgb(0, 0, 1);

const RUNNING_HEAD_CENTER_Y = 745;
const RUNNING_HEAD_LEFT_Y = 731;
const RUNNING_HEAD_RIGHT_Y = 731;
const DATE_LINE_Y = 717;
const FOOTER_Y = 38.6;
const CENTER_X = 306;
const RIGHT_EDGE_X = 540;
const LEFT_X = 72;

function drawCentered(page: PDFPage, text: string, centerX: number, y: number, size: number, font: PDFFont, color = BLACK) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: centerX - width / 2, y, size, font, color });
}

function drawRightAligned(page: PDFPage, text: string, rightX: number, y: number, size: number, font: PDFFont, color = BLACK) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - width, y, size, font, color });
}

function paintTemplate(page: PDFPage, laidOutPage: LaidOutPage, doc: VolumeDoc, font: PDFFont) {
  // Running head center: policy title, upper-cased.
  drawCentered(page, doc.order.policyTitle.toUpperCase(), CENTER_X, RUNNING_HEAD_CENTER_Y, 12, font);

  // Running head left: "Volume N" or "Volume N, Chapter M" on body pages.
  const leftText = laidOutPage.band === 'body' && laidOutPage.chapter !== undefined
    ? `Volume ${doc.volume.number}, Chapter ${laidOutPage.chapter}`
    : `Volume ${doc.volume.number}`;
  page.drawText(leftText, { x: LEFT_X, y: RUNNING_HEAD_LEFT_Y, size: 12, font, color: BLACK });

  // Running head right: designator and volume, then the last-updated date below it.
  drawRightAligned(page, `${doc.order.designator} · V${doc.volume.number}`, RIGHT_EDGE_X, RUNNING_HEAD_RIGHT_Y, 12, font);
  drawRightAligned(page, doc.volume.lastUpdatedDate, RIGHT_EDGE_X, DATE_LINE_Y, 12, font);

  // Footer: page label, centered.
  drawCentered(page, laidOutPage.label, CENTER_X, FOOTER_Y, 11.5, font);
}

function paintItem(page: PDFPage, item: PaintItem, font: PDFFont) {
  switch (item.kind) {
    case 'line':
    case 'heading': {
      // Segments are drawn sequentially, advancing x by measured width.
      // Adjacent segments that share the same paint color are merged into
      // one drawText call so plain runs of text extract as a single text
      // run (a run's own word-level tokenization from wrapRuns shouldn't
      // fragment an otherwise uniform line into one PDF text op per word).
      let x = item.x;
      let bufferText = '';
      let bufferColor = BLACK;
      const flush = () => {
        if (bufferText.length === 0) return;
        page.drawText(bufferText, { x, y: item.y, size: item.sizePt, font, color: bufferColor });
        x += font.widthOfTextAtSize(bufferText, item.sizePt);
        bufferText = '';
      };
      for (const segment of item.segments) {
        const color = segment.run.changed || segment.run.link ? BLUE : BLACK;
        if (bufferText.length > 0 && color !== bufferColor) flush();
        bufferColor = color;
        bufferText += segment.text;
      }
      flush();
      break;
    }
    case 'table': {
      const { x, y, cols, colWidths, rows, rowHeight } = item;
      const width = colWidths.reduce((a, b) => a + b, 0);
      const numRows = rows.length + 1; // + header
      const top = y + rowHeight - 3;
      const bottom = top - numRows * rowHeight;
      const size = 11;

      // Horizontal grid lines (numRows + 1 of them).
      for (let r = 0; r <= numRows; r++) {
        const ly = top - r * rowHeight;
        page.drawLine({ start: { x, y: ly }, end: { x: x + width, y: ly }, thickness: 0.75, color: BLACK });
      }
      // Vertical grid lines (one per column boundary, plus the outer edges).
      let vx = x;
      page.drawLine({ start: { x: vx, y: top }, end: { x: vx, y: bottom }, thickness: 0.75, color: BLACK });
      for (const w of colWidths) {
        vx += w;
        page.drawLine({ start: { x: vx, y: top }, end: { x: vx, y: bottom }, thickness: 0.75, color: BLACK });
      }

      // Header + data row text.
      for (let r = 0; r < numRows; r++) {
        const cells = r === 0 ? cols : rows[r - 1];
        const baselineY = top - (r + 1) * rowHeight + 4;
        let cx = x;
        for (let c = 0; c < cells.length; c++) {
          page.drawText(String(cells[c] ?? ''), { x: cx + 4, y: baselineY, size, font, color: BLACK });
          cx += colWidths[c] ?? 0;
        }
      }
      break;
    }
    default:
      // Figures are painted in a later task.
      break;
  }
}

export async function generateVolumePdf(doc: VolumeDoc): Promise<Blob> {
  const laidOut = layoutVolume(doc);
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);

  for (const laidOutPage of laidOut.pages) {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    paintTemplate(page, laidOutPage, doc, font);
    for (const item of laidOutPage.items) {
      paintItem(page, item, font);
    }
  }

  const bytes = await pdfDoc.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
