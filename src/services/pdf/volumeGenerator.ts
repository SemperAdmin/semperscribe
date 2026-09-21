import { PDFArray, PDFDocument, PDFName, PDFString, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
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

/** Adds a low-level PDF link annotation (URI action) covering the given rect. */
function addLinkAnnotation(pdfDoc: PDFDocument, page: PDFPage, x: number, y: number, w: number, h: number, url: string) {
  const rect = [x, y - 2, x + w, y + h];
  const annotation = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: rect,
    Border: [0, 0, 0],
    A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
  });
  const ref = pdfDoc.context.register(annotation);
  const existing = page.node.get(PDFName.of('Annots'));
  if (existing instanceof PDFArray) {
    existing.push(ref);
  } else {
    page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([ref]));
  }
}

/** data:image/png;... or data:image/jpeg;... -> raw bytes. */
function decodeDataUrl(dataUrl: string): { mime: string; bytes: Uint8Array } {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) throw new Error('Unsupported figure image encoding (expected a base64 data URL)');
  const [, mime, b64] = match;
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { mime, bytes };
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

interface Fonts {
  regular: PDFFont;
  link: PDFFont; // bold+italic, used for hyperlink runs per the format standard
}

async function paintItem(pdfDoc: PDFDocument, page: PDFPage, item: PaintItem, fonts: Fonts) {
  switch (item.kind) {
    case 'line':
    case 'heading': {
      // Segments are drawn sequentially, advancing x by measured width.
      // Adjacent segments that share the same paint font+color are merged
      // into one drawText call so plain runs of text extract as a single
      // text run (a run's own word-level tokenization from wrapRuns
      // shouldn't fragment an otherwise uniform line into one PDF text op
      // per word).
      //
      // IMPORTANT (Task 9 controller ruling): that merging is a *paint*
      // optimization only. Hyperlink annotation rectangles are computed
      // below from each segment's OWN measured width and x-advance as we
      // walk item.segments — never derived from the merged drawText
      // buffer — so two adjacent link runs with different hrefs each get
      // their own rectangle instead of collapsing into one.
      let x = item.x;
      let bufferText = '';
      let bufferColor = BLACK;
      let bufferFont = fonts.regular;
      let bufferX = x;
      const flush = () => {
        if (bufferText.length === 0) return;
        page.drawText(bufferText, { x: bufferX, y: item.y, size: item.sizePt, font: bufferFont, color: bufferColor });
        bufferText = '';
      };
      for (const segment of item.segments) {
        const isLink = !!(segment.run.link && segment.run.href);
        const color = segment.run.changed || segment.run.link ? BLUE : BLACK;
        const segFont = isLink ? fonts.link : fonts.regular;
        const segWidth = segFont.widthOfTextAtSize(segment.text, item.sizePt);

        if (bufferText.length === 0) {
          bufferX = x;
        } else if (color !== bufferColor || segFont !== bufferFont) {
          flush();
          bufferX = x;
        }
        bufferColor = color;
        bufferFont = segFont;
        bufferText += segment.text;

        if (isLink) {
          // Underline + link annotation over exactly this segment's box.
          const underlineY = item.y - 1.5;
          page.drawLine({
            start: { x, y: underlineY }, end: { x: x + segWidth, y: underlineY },
            thickness: 0.5, color: BLUE,
          });
          addLinkAnnotation(pdfDoc, page, x, item.y, segWidth, item.sizePt, segment.run.href!);
        }
        x += segWidth;
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
          page.drawText(String(cells[c] ?? ''), { x: cx + 4, y: baselineY, size, font: fonts.regular, color: BLACK });
          cx += colWidths[c] ?? 0;
        }
      }
      break;
    }
    case 'figure': {
      const { mime, bytes } = decodeDataUrl(item.image);
      const embedded = mime === 'image/jpeg' || mime === 'image/jpg'
        ? await pdfDoc.embedJpg(bytes)
        : await pdfDoc.embedPng(bytes);

      // Fit the embedded image inside the reserved box, preserving aspect
      // ratio (pixel dimensions aren't known until now), then center it.
      const scale = Math.min(item.width / embedded.width, item.height / embedded.height);
      const drawW = embedded.width * scale;
      const drawH = embedded.height * scale;
      const drawX = item.x + (item.width - drawW) / 2;
      const drawY = item.y + (item.height - drawH) / 2;
      page.drawImage(embedded, { x: drawX, y: drawY, width: drawW, height: drawH });
      break;
    }
    default:
      break;
  }
}

export async function generateVolumePdf(doc: VolumeDoc): Promise<Blob> {
  const laidOut = layoutVolume(doc);
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const link = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const fonts: Fonts = { regular, link };

  for (const laidOutPage of laidOut.pages) {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    paintTemplate(page, laidOutPage, doc, fonts.regular);
    for (const item of laidOutPage.items) {
      await paintItem(pdfDoc, page, item, fonts);
    }
  }

  const bytes = await pdfDoc.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
