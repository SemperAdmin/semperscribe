import { PDFArray, PDFDocument, PDFName, PDFString, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import type { Run, VolumeDoc } from '@/lib/schemas/volume-schema';
import { layoutVolume, LEADING, PAGE_H, PAGE_W, runningHeadParts, type Page as LaidOutPage, type PaintItem } from '@/lib/volume/layout';

const BLACK = rgb(0, 0, 0);
const BLUE = rgb(0, 0, 1);
// Task 20: the real Vol 17 PDF's "blue" literal text (the legend's styled
// hyperlink-description phrase, and the boilerplate's "blue font" phrase)
// paints a muted blue-gray, not the vivid pure blue used elsewhere for
// change-tracked ("changed") text and real hyperlink runs - measured
// directly off the source PDF's non-stroking color (task-20-report.md).
const TITLE_BLUE = rgb(0.518, 0.588, 0.69);

// Task 20: measured bold, 11pt on every page (title page, chapter divider,
// and body pages alike) - supersedes the previous regular-12pt running
// head (task-20-report.md).
const RUNNING_HEAD_SIZE_PT = 11;
const RUNNING_HEAD_CENTER_Y = 745.8;
const RUNNING_HEAD_LEFT_Y = 733.2;
const RUNNING_HEAD_RIGHT_Y = 733.2;
const DATE_LINE_Y = 720.5;
const FOOTER_Y = 38.6;
const CENTER_X = 306;
const RIGHT_EDGE_X = 540;
const LEFT_X = 72;

// ---------------------------------------------------------------------------
// Finding 10: a single character a font's encoding can't represent (every
// font embedded here - pdf-lib's StandardFonts.TimesRoman/
// TimesRomanBoldItalic - uses WinAnsi encoding, which doesn't cover e.g.
// '→' or '≥') used to throw all the way out of `font.widthOfTextAtSize`/
// `page.drawText` and abort the ENTIRE `generateVolumePdf` call, no matter
// where in the document the character appeared. `safeText` replaces ONLY
// the characters the given font actually can't encode - checked one at a
// time against the font itself, never a hand-maintained WinAnsi charset,
// so it stays correct if the paint font ever changes - with '?', so the
// rest of the document still paints and the export still resolves. Every
// width computation and drawText/drawText-adjacent call below runs on the
// sanitized string so a paint-time replacement never causes a measured
// width to mismatch what's actually drawn.
// ---------------------------------------------------------------------------
const encodableCache = new WeakMap<PDFFont, Map<string, boolean>>();

function canEncode(font: PDFFont, ch: string): boolean {
  let cache = encodableCache.get(font);
  if (!cache) {
    cache = new Map();
    encodableCache.set(font, cache);
  }
  const cached = cache.get(ch);
  if (cached !== undefined) return cached;
  let ok = true;
  try {
    font.widthOfTextAtSize(ch, 12);
  } catch {
    ok = false;
  }
  cache.set(ch, ok);
  return ok;
}

function safeText(font: PDFFont, text: string): string {
  let out = '';
  let changed = false;
  for (const ch of text) {
    if (canEncode(font, ch)) {
      out += ch;
    } else {
      out += '?';
      changed = true;
    }
  }
  return changed ? out : text;
}

function drawCentered(page: PDFPage, text: string, centerX: number, y: number, size: number, font: PDFFont, color = BLACK) {
  const safe = safeText(font, text);
  const width = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, { x: centerX - width / 2, y, size, font, color });
}

function drawRightAligned(page: PDFPage, text: string, rightX: number, y: number, size: number, font: PDFFont, color = BLACK) {
  const safe = safeText(font, text);
  const width = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, { x: rightX - width, y, size, font, color });
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

/** Bordered box + label, painted in place of a figure whose image failed to embed. */
function drawFigurePlaceholder(page: PDFPage, item: Extract<PaintItem, { kind: 'figure' }>, font: PDFFont) {
  const { x, y, width, height, figureNumber } = item;
  page.drawRectangle({
    x, y, width, height,
    borderColor: BLACK, borderWidth: 0.75,
    color: rgb(1, 1, 1),
  });
  const label = safeText(font, `Figure ${figureNumber}: image could not be embedded`);
  const size = 10;
  const textWidth = font.widthOfTextAtSize(label, size);
  page.drawText(label, {
    x: x + (width - textWidth) / 2,
    y: y + height / 2,
    size, font, color: BLACK,
  });
}

function paintTemplate(page: PDFPage, laidOutPage: LaidOutPage, doc: VolumeDoc, fonts: Fonts) {
  // Finding 3: the running-head text (center/left/right-top/right-date) is
  // now composed by the single shared `runningHeadParts` (lib/volume/
  // layout.ts) also consumed by the DOCX generator, instead of each
  // generator carrying its own copy of the left-label band rule and date
  // formatting. See runningHeadParts's doc comment for the measured
  // provenance of the two-line layout and the left-label rule (Task 18
  // finding D) and formatDate's doc comment for the date fix (Task 17).
  //
  // Task 20: the whole running head paints bold at 11pt on every page (see
  // RUNNING_HEAD_SIZE_PT's doc comment) - previously regular at 12pt.
  const parts = runningHeadParts(doc, laidOutPage.band, laidOutPage.chapter);
  const font = fonts.bold;
  drawCentered(page, parts.center, CENTER_X, RUNNING_HEAD_CENTER_Y, RUNNING_HEAD_SIZE_PT, font);
  page.drawText(safeText(font, parts.left), {
    x: LEFT_X, y: RUNNING_HEAD_LEFT_Y, size: RUNNING_HEAD_SIZE_PT, font, color: BLACK,
  });
  drawRightAligned(page, parts.rightTop, RIGHT_EDGE_X, RUNNING_HEAD_RIGHT_Y, RUNNING_HEAD_SIZE_PT, font);
  drawRightAligned(page, parts.rightDate, RIGHT_EDGE_X, DATE_LINE_Y, RUNNING_HEAD_SIZE_PT, font);

  // Task 20: a single full-width rule sits immediately under the
  // left-label/right-designator row only - NOT under the center policy
  // title or the date row below it (measured as one continuous rect
  // spanning the full text width at that row's y, task-20-report.md).
  page.drawLine({
    start: { x: LEFT_X, y: RUNNING_HEAD_LEFT_Y - 2 },
    end: { x: RIGHT_EDGE_X, y: RUNNING_HEAD_LEFT_Y - 2 },
    thickness: 0.75,
    color: BLACK,
  });

  // Footer: page label, centered. Already resolved to a concrete string at
  // layout time (bodyPageLabel/refPageLabel/toRoman, lib/volume/page-bands.ts).
  drawCentered(page, laidOutPage.label, CENTER_X, FOOTER_Y, 11.5, fonts.regular);
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont; // Task 20: running head + title-page/divider headings + table headers
  // bold+italic - used for real hyperlink runs AND for any run explicitly
  // flagged both `bold` and `italic` (e.g. the hyperlink legend's styled
  // phrase, which looks like a link but isn't one - see pickFont below).
  boldItalic: PDFFont;
}

/** Picks the paint font for a styled `Run` (see pickColor for its color). */
function pickFont(run: Run, fonts: Fonts): PDFFont {
  const isLink = !!(run.link && run.href);
  if (isLink || (run.bold && run.italic)) return fonts.boldItalic;
  if (run.bold) return fonts.bold;
  // Fix round 1 (reviewer finding, minor): an italic-only run (italic set,
  // bold not) has no dedicated embedded font and silently falls back to
  // regular - only italic PAIRED with bold (the legend's styled phrase, or
  // a real hyperlink) is supported here. No current caller produces
  // italic-only runs (legendRuns/styleBoilerplateRuns never set `italic`
  // without also setting `bold`), so this is a documented limitation, not
  // an observed bug; embedding a plain TimesRomanItalic would be the fix if
  // an italic-only run is ever needed.
  return fonts.regular;
}

/** Picks the paint color for a styled `Run` (see pickFont for its font). */
function pickColor(run: Run) {
  if (run.changed || run.link) return BLUE;
  if (run.color === 'blue') return TITLE_BLUE;
  return BLACK;
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
      // buffer above — so two adjacent link runs with different hrefs
      // each get their own rectangle instead of collapsing into one.
      //
      // wrapRuns tokenizes on word boundaries, so a single link run like
      // "this link" arrives as multiple segments (word, space, word) that
      // all share the same underlying `run`/href. We accumulate a
      // contiguous run of same-href segments into ONE rectangle (flushing
      // whenever the href changes, a non-link segment appears, or the
      // line ends) rather than emitting one rectangle per word-token.
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

      // Task 20: generalized from the old link-only underline accumulator
      // to cover ANY run flagged `underline` (title-page/divider styled
      // text - the legend phrase, "full revision", "CANCELLATION" - not
      // just real hyperlinks), while still drawing the link annotation
      // rectangle for actual link runs. A contiguous stretch of
      // underline-worthy segments (same rule as before: flush on href
      // change, on losing the underline flag, or at line end) still paints
      // ONE underline rule, not one per word-token.
      let ulActive = false;
      let ulStartX = x;
      let ulWidth = 0;
      let ulColor = BLACK;
      let ulHref: string | undefined;
      const flushUnderline = () => {
        if (!ulActive) return;
        const underlineY = item.y - 1.5;
        page.drawLine({
          start: { x: ulStartX, y: underlineY }, end: { x: ulStartX + ulWidth, y: underlineY },
          thickness: 0.5, color: ulColor,
        });
        if (ulHref !== undefined) addLinkAnnotation(pdfDoc, page, ulStartX, item.y, ulWidth, item.sizePt, ulHref);
        ulActive = false;
        ulHref = undefined;
        ulWidth = 0;
      };

      for (const segment of item.segments) {
        const run = segment.run;
        const isLink = !!(run.link && run.href);
        const shouldUnderline = isLink || !!run.underline;
        const color = pickColor(run);
        const segFont = pickFont(run, fonts);
        // Finding 10: sanitize BEFORE measuring, so the width used to
        // advance `x` (and to size the underline/annotation rect below)
        // always matches what actually gets painted.
        const segText = safeText(segFont, segment.text);
        const segWidth = segFont.widthOfTextAtSize(segText, item.sizePt);

        if (bufferText.length === 0) {
          bufferX = x;
        } else if (color !== bufferColor || segFont !== bufferFont) {
          flush();
          bufferX = x;
        }
        bufferColor = color;
        bufferFont = segFont;
        bufferText += segText;

        if (shouldUnderline) {
          const linkHrefChanged = isLink && ulHref !== run.href;
          if (!ulActive || linkHrefChanged) {
            flushUnderline();
            ulActive = true;
            ulStartX = x;
            ulWidth = 0;
            ulHref = isLink ? run.href : undefined;
          }
          ulColor = color;
          ulWidth += segWidth;
        } else {
          flushUnderline();
        }
        x += segWidth;
      }
      flush();
      flushUnderline();
      break;
    }
    case 'table': {
      // Task 18 finding A: each cell is pre-wrapped to its own column width
      // (see `addTable` in lib/volume/layout.ts), and each row's height
      // (`rowHeights`/`headerHeight`) already accounts for the tallest
      // wrapped cell in that row, so painting each cell's lines top-down
      // never crosses into the next column or the next row.
      const { x, y, colWidths, headerLines, headerHeight, rows, rowHeights, rowShading } = item;
      const width = colWidths.reduce((a, b) => a + b, 0);
      const allRowHeights = [headerHeight, ...rowHeights];
      const allRowsLines = [headerLines, ...rows];
      const top = y + headerHeight - 3;
      const totalHeight = allRowHeights.reduce((a, b) => a + b, 0);
      const bottom = top - totalHeight;
      const size = 11;
      const lineStep = LEADING;

      // Task 20: gray-fill any shaded cells FIRST, so the grid lines and
      // text painted below land on top of the fill, not under it. Measured
      // ~0.85 gray on the real Vol 17 title page's 3 blank change-table
      // rows (task-20-report.md).
      if (rowShading) {
        let bandTop = top - headerHeight;
        for (let r = 0; r < rows.length; r++) {
          const shadeRow = rowShading[r];
          const rowH = rowHeights[r];
          if (shadeRow) {
            let cx = x;
            for (let c = 0; c < colWidths.length; c++) {
              if (shadeRow[c]) {
                page.drawRectangle({ x: cx, y: bandTop - rowH, width: colWidths[c] ?? 0, height: rowH, color: rgb(0.85, 0.85, 0.85) });
              }
              cx += colWidths[c] ?? 0;
            }
          }
          bandTop -= rowH;
        }
      }

      // Horizontal grid lines, one per row boundary (rows can differ in height).
      let ly = top;
      page.drawLine({ start: { x, y: ly }, end: { x: x + width, y: ly }, thickness: 0.75, color: BLACK });
      for (const h of allRowHeights) {
        ly -= h;
        page.drawLine({ start: { x, y: ly }, end: { x: x + width, y: ly }, thickness: 0.75, color: BLACK });
      }
      // Vertical grid lines (one per column boundary, plus the outer edges).
      let vx = x;
      page.drawLine({ start: { x: vx, y: top }, end: { x: vx, y: bottom }, thickness: 0.75, color: BLACK });
      for (const w of colWidths) {
        vx += w;
        page.drawLine({ start: { x: vx, y: top }, end: { x: vx, y: bottom }, thickness: 0.75, color: BLACK });
      }

      // Header + data row text: each cell's own wrapped lines are painted
      // top-down within that row's band, never spilling past the column's
      // right edge (they were wrapped to fit it) or the row below (the row
      // height already grew to fit the tallest cell).
      let rowTop = top;
      for (let r = 0; r < allRowsLines.length; r++) {
        const cells = allRowsLines[r];
        const rowH = allRowHeights[r];
        // Task 20: the header row (r === 0) paints bold on every measured
        // table (title-page and chapter-divider change tables both -
        // task-20-report.md); data rows stay regular.
        const rowFont = r === 0 ? fonts.bold : fonts.regular;
        let cx = x;
        for (let c = 0; c < cells.length; c++) {
          const lines = cells[c];
          const cellTopBaseline = rowTop - lineStep + 2;
          for (let li = 0; li < lines.length; li++) {
            page.drawText(safeText(rowFont, lines[li]), {
              x: cx + 4, y: cellTopBaseline - li * lineStep, size, font: rowFont, color: BLACK,
            });
          }
          cx += colWidths[c] ?? 0;
        }
        rowTop -= rowH;
      }
      break;
    }
    case 'box': {
      // Task 20: an unfilled bordered rectangle around the title-page/
      // divider text block (see BoxItem's doc comment in lib/volume/layout.ts).
      const { x, yTop, yBottom, width } = item;
      page.drawRectangle({ x, y: yBottom, width, height: yTop - yBottom, borderColor: BLACK, borderWidth: 0.75 });
      break;
    }
    case 'figure': {
      // A malformed/unsupported image must not abort the whole export — one
      // bad figure degrades to a labeled placeholder, the rest of the
      // document still paints and generateVolumePdf still resolves.
      try {
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
      } catch {
        drawFigurePlaceholder(page, item, fonts.regular);
      }
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
  const bold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const boldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const fonts: Fonts = { regular, bold, boldItalic };

  for (const laidOutPage of laidOut.pages) {
    const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    paintTemplate(page, laidOutPage, doc, fonts);
    for (const item of laidOutPage.items) {
      try {
        await paintItem(pdfDoc, page, item, fonts);
      } catch (error) {
        // Finding 10, defense in depth: `safeText` above removes the known
        // cause (an unencodable character reaching drawText/
        // widthOfTextAtSize), but one bad item must still never abort the
        // whole export - skip just this item and keep painting the rest of
        // the document.
        console.error('Volume PDF: failed to paint an item, skipping it', error);
      }
    }
  }

  const bytes = await pdfDoc.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
