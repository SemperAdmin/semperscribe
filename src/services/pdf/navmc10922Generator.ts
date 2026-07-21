/**
 * NAVMC 10922 flattened renderer - build plan Phase 5, programmatic
 * variant approved 2026-07-20 (Stephen: layout-faithful redraw over
 * waiting for an Adobe-printed asset).
 *
 * Draws the form from src/services/pdf/navmc10922-layout.json, which
 * tools/aa-forms/extract_10922_layout.py generates from the official
 * blank's OWN template.xml: every label, cell rectangle, radio option
 * box, unbindable checkbox, and master-page overlay (including the
 * form's CUI artwork) at its exact millimetre position. Values come
 * from navmc10922Values() - the same 102 positional selectors the XFA
 * emitter uses, so the flattened print and the editable export always
 * agree.
 *
 * This path exists for the live preview, the START reason (the START
 * checkbox is unbindable in the XFA datasets), and exports carrying
 * signature fields or bound enclosures (the XFA renderer would drop
 * them). It is a faithful REDRAW, not the official form: fillable
 * fields do not survive, and pixel geometry differs from an Adobe
 * print. The redraw includes the form's own CUI markings because they
 * are form artwork - the app adds no markings of its own.
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, degrees, rgb } from 'pdf-lib';
import { FormData } from '@/types';
import { navmc10922Values } from '@/lib/navmc10922-xfa';
import { getBasePath } from '@/lib/path-utils';
import layout from './navmc10922-layout.json';

const MM_TO_PT = 72 / 25.4;
const PAGE_H = 792;

const LABEL_SIZE = 5.4;
const TITLE_SIZE = 11;
const VALUE_SIZE = 8;
const CAPTION_SIZE = 4.6;
const GRID = rgb(0.55, 0.55, 0.55);
const INK = rgb(0, 0, 0);

type EdgeSpec = [visible: boolean, thicknessMm: number];
type HAlign = 'left' | 'center' | 'right';
type VAlign = 'top' | 'middle' | 'bottom';
interface Box { x: number; y: number; w: number; h: number }
interface Aligned { ha?: HAlign; va?: VAlign }
interface LabelDef extends Box, Aligned { text: string; size: number | null; rotate?: number; edges?: EdgeSpec[] }
interface OptionDef extends Box { value: string | null; caption: string; cx?: number; cy?: number }
interface CellDef extends Box, Aligned {
  index: number | null; kind: string; caption: string;
  options?: OptionDef[]; edges?: EdgeSpec[];
  capPlace?: string; capReserve?: number; capHa?: HAlign;
}
interface CheckboxDef extends Box { caption: string; edges?: EdgeSpec[]; cx?: number; cy?: number }
interface PageDef { labels: LabelDef[]; cells: CellDef[]; checkboxes: CheckboxDef[] }

const toPt = (mm: number) => mm * MM_TO_PT;
/** top-left mm box -> pdf-lib bottom-left points */
const rect = (b: Box) => ({
  x: toPt(b.x), y: PAGE_H - toPt(b.y + b.h), w: toPt(b.w), h: toPt(b.h),
});

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const hard of text.split('\n')) {
    const words = hard.split(/\s+/).filter(Boolean);
    let line = '';
    for (const word of words) {
      const probe = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(probe, size) <= maxWidth || !line) line = probe;
      else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}

function drawTextBox(
  page: PDFPage, box: Box, text: string, font: PDFFont, size: number,
  opts: { ha?: HAlign; va?: VAlign; center?: boolean; padTop?: number } = {}
) {
  if (!text) return;
  const r = rect(box);
  const pad = 1.2;
  const lineH = size * 1.12;
  const lines = wrap(text, font, size, r.w - pad * 2);
  const ha: HAlign = opts.center ? 'center' : (opts.ha ?? 'left');
  const va: VAlign = opts.va ?? 'top';

  const blockH = lines.length * lineH;
  let y: number;
  if (va === 'middle') y = r.y + (r.h + blockH) / 2 - size;
  else if (va === 'bottom') y = r.y + blockH - size + 1;
  else y = r.y + r.h - size - (opts.padTop ?? 1);

  for (const line of lines) {
    if (y < r.y - lineH) break; // never bleed past the box row
    const lw = font.widthOfTextAtSize(line, size);
    const x = ha === 'center' ? r.x + (r.w - lw) / 2
      : ha === 'right' ? r.x + r.w - lw - pad
      : r.x + pad;
    page.drawText(line, { x, y, size, font, color: INK });
    y -= lineH;
  }
}

/** The form's table rules, exactly as the template declares them -
 *  per-edge visibility and thickness in XFA order top, right, bottom,
 *  left. This is what "missing lines" was: the earlier build drew one
 *  uniform light rectangle per field and nothing on label cells. */
function drawEdges(page: PDFPage, box: Box, edges: EdgeSpec[] | undefined) {
  if (!edges) return;
  const r = rect(box);
  const seg: Array<[number, number, number, number]> = [
    [r.x, r.y + r.h, r.x + r.w, r.y + r.h], // top
    [r.x + r.w, r.y, r.x + r.w, r.y + r.h], // right
    [r.x, r.y, r.x + r.w, r.y],             // bottom
    [r.x, r.y, r.x, r.y + r.h],             // left
  ];
  edges.forEach(([visible, thickness], i) => {
    if (!visible || i > 3) return;
    const [x1, y1, x2, y2] = seg[i];
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: Math.max(toPt(thickness), 0.4),
      color: INK,
    });
  });
}

/** X mark only - for overlaying the background's OWN printed squares.
 *  When the layout carries a calibrated square center (cx/cy in pt,
 *  top-left origin - measured off the Adobe print at extraction time),
 *  the X snaps to it; otherwise falls back to template geometry. */
function drawCheckMark(page: PDFPage, box: Box & { cx?: number; cy?: number }, font: PDFFont, centerH: boolean) {
  const size = 7;
  if (box.cx !== undefined && box.cy !== undefined) {
    const w = font.widthOfTextAtSize('X', size);
    page.drawText('X', { x: box.cx - w / 2, y: PAGE_H - box.cy - size * 0.36, size, font, color: INK });
    return;
  }
  const r = rect(box);
  const side = toPt(2.8);
  const px = centerH ? r.x + (r.w - side) / 2 : r.x + 1.5;
  const py = r.y + (r.h - side) / 2;
  page.drawText('X', { x: px + side * 0.16, y: py + side * 0.14, size, font, color: INK });
}

/**
 * Square + optional X, vertically centered in a box. `centerH` centers
 * the square horizontally (caption-less widgets like START); otherwise
 * the square sits at the left inset with the caption area to its right,
 * matching XFA caption placement="right".
 */
function drawCheckboxIn(page: PDFPage, box: Box, checked: boolean, font: PDFFont, centerH: boolean) {
  const r = rect(box);
  const side = toPt(2.8);
  const px = centerH ? r.x + (r.w - side) / 2 : r.x + 1.5;
  const py = r.y + (r.h - side) / 2;
  page.drawRectangle({ x: px, y: py, width: side, height: side, borderColor: INK, borderWidth: 0.7 });
  if (checked) {
    page.drawText('X', { x: px + side * 0.16, y: py + side * 0.14, size: 7, font, color: INK });
  }
  return px + side; // caption start x (pt)
}

/**
 * Loads the flattened background pages (an Adobe print of the official
 * form, supplied 2026-07-20 - exact lines, labels, and fonts by
 * construction). Null when unavailable: the programmatic redraw below
 * then carries the full form itself.
 */
async function loadBackgroundPages(): Promise<ArrayBuffer[] | null> {
  try {
    const basePath = getBasePath();
    return await Promise.all([1, 2, 3].map((n) =>
      fetch(`${basePath}/templates/navmc10922/page${n}.pdf`).then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.arrayBuffer();
      })
    ));
  } catch {
    return null;
  }
}

/** Renders the flattened NAVMC 10922 from the document state.
 *  `backgrounds` overrides the fetch (tests, node harnesses). */
export async function generateNavmc10922(
  formData: FormData,
  backgrounds?: ArrayBuffer[] | Uint8Array[] | null
): Promise<Uint8Array> {
  const values = navmc10922Values(formData);
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const times = await doc.embedFont(StandardFonts.TimesRoman);

  const pages = layout.pages as unknown as PageDef[];
  const master = layout.master as unknown as LabelDef[];
  const total = pages.length;

  const bg = backgrounds === undefined ? await loadBackgroundPages() : backgrounds;
  const bgPages = bg
    ? await Promise.all(bg.map(async (bytes) => {
        const src = await PDFDocument.load(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
        return doc.embedPage(src.getPage(0));
      }))
    : null;

  pages.forEach((pageDef, pageIndex) => {
    const page = doc.addPage([layout.pageSize.wPt, layout.pageSize.hPt]);

    // --- Background mode: the printed official form IS the page; ---
    // --- overlay values and check marks only.                     ---
    if (bgPages) {
      page.drawPage(bgPages[pageIndex], { x: 0, y: 0 });
      for (const cell of pageDef.cells) {
        const value = cell.index !== null ? values[cell.index] : '';
        if (!value) continue;
        if (cell.kind === 'radio') {
          for (const opt of cell.options ?? []) {
            if (opt.value !== value) continue;
            // spread keeps the calibrated cx/cy riding on the option
            drawCheckMark(page, { ...opt, x: cell.x + opt.x, y: cell.y + opt.y }, helvBold, !opt.caption);
          }
          continue;
        }
        const reserve = cell.caption ? (cell.capReserve ?? 2.6) : 0;
        const valBox = cell.capPlace === 'bottom'
          ? { ...cell, h: cell.h - reserve }
          : { ...cell, y: cell.y + reserve, h: cell.h - reserve };
        drawTextBox(page, valBox, value, times, VALUE_SIZE, { ha: cell.ha, va: cell.va ?? 'middle' });
      }
      for (const cb of pageDef.checkboxes) {
        if (!cb.caption && formData.reason === 'start') {
          drawCheckMark(page, cb, helvBold, true);
        }
      }
      return;
    }

    // Master-page overlays (form number, CUI artwork) on every page.
    for (const m of master) {
      if (m.text === 'Page of') {
        drawTextBox(page, m, `Page ${pageIndex + 1} of ${total}`, helv, 6, { center: true });
        continue;
      }
      const bold = m.text.startsWith('CUI');
      drawTextBox(page, m, m.text, bold ? helvBold : helv, 6, { center: bold });
    }

    // Static labels.
    for (const l of pageDef.labels) {
      if (l.rotate === 90) {
        // Section sidebar headers. XFA rotate="90" keeps w/h in the
        // PRE-rotation frame: w is the text run (vertical span on the
        // page), h the band width (6.35mm). The rotated bounding box
        // hangs DOWN from y, so the text starts at y+w and runs upward.
        // Long titles wrap into stacked vertical lines INSIDE the band
        // (Adobe does the same) instead of overrunning the section.
        const run = toPt(l.w) - 4;
        let size = LABEL_SIZE;
        let vLines = [l.text];
        if (helvBold.widthOfTextAtSize(l.text, size) > run) {
          size = 4.6;
          if (helvBold.widthOfTextAtSize(l.text, size) > run) {
            vLines = wrap(l.text, helvBold, size, run);
          }
        }
        const bandW = toPt(l.h);
        const lineGap = bandW / (vLines.length + 0.2);
        vLines.slice(0, 2).forEach((line, i) => {
          const lw = helvBold.widthOfTextAtSize(line, size);
          page.drawText(line, {
            x: toPt(l.x) + bandW - lineGap * i - lineGap * 0.35,
            y: PAGE_H - toPt(l.y + l.w) + (run - lw) / 2 + 2,
            size,
            font: helvBold,
            color: INK,
            rotate: degrees(90),
          });
        });
        continue;
      }
      const isTitle = l.text === 'DEPENDENCY APPLICATION' || l.text === 'PRIVACY ACT STATEMENT';
      const size = l.size ?? (isTitle ? TITLE_SIZE : LABEL_SIZE);
      drawEdges(page, l, l.edges);
      drawTextBox(page, l, l.text, isTitle ? helvBold : helv, size, { center: isTitle, ha: l.ha, va: l.va });
    }

    // Field cells: the template's own edge rules, in-cell caption, value.
    for (const cell of pageDef.cells) {
      drawEdges(page, cell, cell.edges);
      const value = cell.index !== null ? values[cell.index] : '';

      if (cell.kind === 'radio') {
        for (const opt of cell.options ?? []) {
          const obox = { x: cell.x + opt.x, y: cell.y + opt.y, w: opt.w, h: opt.h };
          // Caption-less option squares center in their box (the
          // dissolution grid); captioned ones sit left with the
          // caption to the right (XFA placement="right").
          drawCheckboxIn(page, obox, value !== '' && opt.value === value, helvBold, !opt.caption);
          if (opt.caption) {
            drawTextBox(page, { x: obox.x + 3.6, y: obox.y, w: obox.w - 3.6, h: obox.h }, opt.caption, helv, CAPTION_SIZE, { va: 'middle' });
          }
        }
        continue;
      }

      if (cell.caption) {
        // The template's own caption reserve and placement govern the
        // caption/value split; values default to vAlign middle, the
        // XFA default across this form (277 declarations).
        const reserve = cell.capReserve ?? 2.6;
        const place = cell.capPlace ?? 'top';
        const capBox = place === 'bottom'
          ? { ...cell, y: cell.y + cell.h - reserve, h: reserve }
          : { ...cell, h: reserve };
        const valBox = place === 'bottom'
          ? { ...cell, h: cell.h - reserve }
          : { ...cell, y: cell.y + reserve, h: cell.h - reserve };
        drawTextBox(page, capBox, cell.caption, helv, CAPTION_SIZE, { ha: cell.capHa, va: place === 'bottom' ? 'middle' : 'top' });
        drawTextBox(page, valBox, value, times, VALUE_SIZE, { ha: cell.ha, va: cell.va ?? 'middle' });
      } else {
        drawTextBox(page, cell, value, times, VALUE_SIZE, { ha: cell.ha, va: cell.va ?? 'middle' });
      }
    }

    // Unbindable checkboxes. START follows the reason; the approving
    // authority boxes and Document Viewed belong to the command and
    // stay unchecked - the app never populates Section 8.
    for (const cb of pageDef.checkboxes) {
      const isStart = !cb.caption; // the START box has an empty template caption
      drawEdges(page, cb, cb.edges);
      drawCheckboxIn(page, cb, isStart && formData.reason === 'start', helvBold, isStart);
      if (cb.caption) {
        drawTextBox(page, { x: cb.x + 3.6, y: cb.y, w: cb.w - 3.6, h: cb.h }, cb.caption, helv, CAPTION_SIZE, { va: 'middle' });
      }
    }
  });

  return doc.save();
}
