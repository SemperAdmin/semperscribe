/**
 * The boxed, numbered form the app draws when no official blank exists:
 * label-over-value cells, check boxes, tables, section bars, and rows
 * which flow across pages. Moved out of the Counseling Worksheet
 * generator so the TLA Packet draws with the same parts.
 */
import { PDFDocument, PDFFont, PDFPage, rgb } from 'pdf-lib';

export interface FormCheck { label: string; on: boolean }

export const PAGE_W = 612;
export const PAGE_H = 792;
export const MARGIN = 36;
export const TOP = PAGE_H - 48;
export const BOTTOM = 44;
export const WIDTH = PAGE_W - MARGIN * 2;
export const INK = rgb(0, 0, 0);
export const SHADE = rgb(0.88, 0.88, 0.88);
export const LINE = 0.6;
export const LABEL = 6.5;
export const VALUE = 9;
export const SECTION = 8;
export const SMALL = 7;
export const PAD = 3;
export const LABEL_H = 9;
export const CHECK = 6.5;

export interface Fonts { body: PDFFont; bold: PDFFont }

/**
 * Break one word which is wider than the column into pieces which fit.
 * A name typed without spaces, a URL, or a long control number used to
 * run straight through the cell border into its neighbour, because the
 * word wrapper only breaks at spaces. Character-level breaking keeps
 * every glyph inside the box; the reader sees the break, which is the
 * lesser harm.
 */
function breakWord(word: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
  const out: string[] = [];
  let piece = '';
  for (const ch of word) {
    const probe = piece + ch;
    if (font.widthOfTextAtSize(probe, size) <= maxWidth || !piece) piece = probe;
    else { out.push(piece); piece = ch; }
  }
  if (piece) out.push(piece);
  return out;
}

export function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const hard of text.split(/\r?\n/)) {
    const words = hard.split(/\s+/).filter(Boolean).flatMap((w) => breakWord(w, font, size, maxWidth));
    if (words.length === 0) { out.push(''); continue; }
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

/** A cell's content: a label line, then a value or a list of checks. */
export interface Cell {
  w: number;
  label?: string;
  value?: string;
  checks?: FormCheck[];
  /** Checks per line; defaults to one. */
  perLine?: number;
  minLines?: number;
  bold?: boolean;
  size?: number;
}

export class Sheet {
  readonly doc: PDFDocument;
  readonly fonts: Fonts;
  page!: PDFPage;
  y = TOP;
  pages: PDFPage[] = [];

  constructor(doc: PDFDocument, fonts: Fonts) {
    this.doc = doc;
    this.fonts = fonts;
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.pages.push(this.page);
    this.y = TOP;
  }

  ensure(height: number) {
    if (this.y - height < BOTTOM) this.newPage();
  }

  text(x: number, y: number, s: string, size: number, bold = false) {
    this.page.drawText(s, { x, y, size, font: bold ? this.fonts.bold : this.fonts.body, color: INK });
  }

  rect(x: number, y: number, w: number, h: number, fill = false) {
    this.page.drawRectangle({ x, y, width: w, height: h, borderColor: INK, borderWidth: LINE, color: fill ? SHADE : undefined, opacity: fill ? 1 : 0, borderOpacity: 1 });
  }

  checkbox(x: number, y: number, on: boolean) {
    this.page.drawRectangle({ x, y, width: CHECK, height: CHECK, borderColor: INK, borderWidth: 0.5, opacity: 0, borderOpacity: 1 });
    if (on) {
      this.page.drawLine({ start: { x: x + 1, y: y + 1 }, end: { x: x + CHECK - 1, y: y + CHECK - 1 }, thickness: 0.8, color: INK });
      this.page.drawLine({ start: { x: x + 1, y: y + CHECK - 1 }, end: { x: x + CHECK - 1, y: y + 1 }, thickness: 0.8, color: INK });
    }
  }

  /**
   * The check rows of a cell, each with its wrapped labels and the line
   * count the tallest label needs. A label wider than its column used to
   * run into the next column or off the page; it now wraps under itself.
   */
  checkRows(cell: Cell): { checks: { check: FormCheck; lines: string[] }[]; lines: number }[] {
    const per = cell.perLine ?? 1;
    const size = (cell.size ?? VALUE) - 1;
    const colW = (cell.w - PAD * 2) / per;
    const labelW = colW - CHECK - 3 - 2;
    const rows: { checks: { check: FormCheck; lines: string[] }[]; lines: number }[] = [];
    (cell.checks ?? []).forEach((check, i) => {
      if (i % per === 0) rows.push({ checks: [], lines: 1 });
      const row = rows[rows.length - 1];
      const lines = wrap(check.label, this.fonts.body, size, labelW);
      row.checks.push({ check, lines });
      row.lines = Math.max(row.lines, lines.length);
    });
    return rows;
  }

  /** Height a cell needs at its width. */
  cellHeight(cell: Cell): number {
    const size = cell.size ?? VALUE;
    const lineH = size * 1.25;
    let lines = 0;
    if (cell.checks) {
      lines = this.checkRows(cell).reduce((sum, r) => sum + r.lines, 0);
    } else {
      lines = cell.value ? wrap(cell.value, this.fonts.body, size, cell.w - PAD * 2).length : 0;
    }
    lines = Math.max(lines, cell.minLines ?? 1);
    return (cell.label ? LABEL_H : PAD) + lines * lineH + PAD;
  }

  /** Draws one cell in a box of the given height at (x, top). */
  drawCell(x: number, top: number, h: number, cell: Cell) {
    this.rect(x, top - h, cell.w, h);
    let y = top;
    if (cell.label) {
      this.text(x + PAD, top - LABEL, cell.label, LABEL, true);
      y = top - LABEL_H;
    } else {
      y = top - PAD;
    }
    const size = cell.size ?? VALUE;
    const lineH = size * 1.25;
    if (cell.checks) {
      const per = cell.perLine ?? 1;
      const colW = (cell.w - PAD * 2) / per;
      let rowTop = y;
      for (const row of this.checkRows(cell)) {
        row.checks.forEach(({ check, lines }, col) => {
          const cx = x + PAD + col * colW;
          const cy = rowTop - lineH + (lineH - CHECK) / 2;
          this.checkbox(cx, cy, check.on);
          lines.forEach((line, li) => this.text(cx + CHECK + 3, cy + 0.8 - li * lineH, line, size - 1, cell.bold));
        });
        rowTop -= row.lines * lineH;
      }
    } else if (cell.value) {
      wrap(cell.value, this.fonts.body, size, cell.w - PAD * 2).forEach((line, i) => {
        this.text(x + PAD, y - (i + 1) * lineH + 2, line, size, cell.bold);
      });
    }
  }

  /**
   * A table: header row, body rows, and a note, kept on one page when
   * the whole fits on a fresh page, else flowing row by row.
   */
  table(header: Cell[], rows: Cell[][], note?: string) {
    const rowH = (cells: Cell[]) => Math.max(...cells.map((c) => this.cellHeight(c)));
    const noteH = note ? wrap(note, this.fonts.body, SMALL, WIDTH - PAD * 2).length * SMALL * 1.3 + PAD * 2 : 0;
    const total = rowH(header) + rows.reduce((sum, r) => sum + rowH(r), 0) + noteH;
    const keep = total <= TOP - BOTTOM - 12 ? total : rowH(header) + (rows[0] ? rowH(rows[0]) : 0);
    this.flushSection(keep);
    this.ensure(keep);
    this.row(header);
    for (const r of rows) this.row(r);
    if (note) this.note(note);
  }

  /**
   * One row of cells, x from the left margin, with a shared height.
   *
   * A ROW TALLER THAN A PAGE IS SPLIT, NOT OVERFLOWED. The comments and
   * narrative cells grow with their text, and a long entry used to run
   * off the bottom of the page through the footer marking, because the
   * page break only ever moved a whole row. A row which fits on a fresh
   * page still moves whole. One which cannot fit on any page is drawn in
   * slices: each slice takes the lines which fit above the bottom margin,
   * and the continuation on the next page repeats every label with
   * "(continued)". Check cells are never split; they are short.
   */
  row(cells: Cell[], fixedHeight?: number): number {
    const h = fixedHeight ?? Math.max(...cells.map((c) => this.cellHeight(c)));
    const pageCapacity = TOP - BOTTOM;
    if (fixedHeight !== undefined || h <= pageCapacity) {
      this.flushSection(h);
      this.ensure(h);
      let x = MARGIN;
      for (const c of cells) {
        this.drawCell(x, this.y, h, c);
        x += c.w;
      }
      this.y -= h;
      return h;
    }
    return this.splitRow(cells);
  }

  /** The slicing half of row(): see the note there. */
  private splitRow(cells: Cell[]): number {
    // Each cell's remaining lines. Check cells carry no lines to slice and
    // are drawn whole in the first slice only.
    const pending = cells.map((c) => ({
      cell: c,
      lines: c.checks || !c.value ? [] : wrap(c.value, this.fonts.body, c.size ?? VALUE, c.w - PAD * 2),
    }));
    let drawn = 0;
    let first = true;
    while (true) {
      const labelledCells = pending.map((p) => ({
        ...p.cell,
        label: first || !p.cell.label || p.lines.length === 0 ? p.cell.label : `${p.cell.label} (continued)`,
        checks: first ? p.cell.checks : undefined,
      }));
      const chrome = (c: Cell) => (c.label ? LABEL_H : PAD) + PAD;
      const lineH = (c: Cell) => (c.size ?? VALUE) * 1.25;
      // Lines which fit per cell in the space left on this page. The
      // section bar, if one is waiting, takes its 12pt first.
      const sectionH = this.pendingSection ? 12 : 0;
      let avail = this.y - BOTTOM - sectionH;
      const minSlice = Math.max(...labelledCells.map((c) => chrome(c) + lineH(c)));
      if (avail < minSlice) { this.newPage(); avail = this.y - BOTTOM - sectionH; }
      const take = pending.map((p, i) => {
        const c = labelledCells[i];
        if (c.checks) return 0;
        return Math.max(0, Math.min(p.lines.length, Math.floor((avail - chrome(c)) / lineH(c))));
      });
      const last = pending.every((p, i) => take[i] >= p.lines.length);
      const sliceCells = labelledCells.map((c, i) => ({
        ...c,
        value: c.checks ? undefined : pending[i].lines.slice(0, take[i]).join('\n'),
        minLines: last ? c.minLines : 1,
      }));
      const sliceH = last
        ? Math.max(...sliceCells.map((c) => this.cellHeight(c)))
        : Math.min(avail, Math.max(...sliceCells.map((c) => this.cellHeight(c))));
      this.flushSection(sliceH);
      let x = MARGIN;
      sliceCells.forEach((c) => { this.drawCell(x, this.y, sliceH, c); x += c.w; });
      this.y -= sliceH;
      drawn += sliceH;
      pending.forEach((p, i) => { p.lines = p.lines.slice(take[i]); });
      if (last) return drawn;
      first = false;
      this.newPage();
    }
  }

  /** A section bar waits for the block under it, so it never ends a page alone. */
  pendingSection: string | null = null;

  section(title: string) {
    this.pendingSection = title;
  }

  /** Draws the waiting section bar, keeping it with a block of the given height. */
  flushSection(blockHeight: number) {
    if (!this.pendingSection) return;
    const h = 12;
    // A block taller than the page never fits after the bar anywhere, so
    // asking for the whole of it would orphan the bar on a fresh page and
    // then break again. Keep the bar with as much as one page holds.
    this.ensure(h + Math.min(blockHeight, TOP - BOTTOM - h));
    this.rect(MARGIN, this.y - h, WIDTH, h, true);
    this.text(MARGIN + PAD, this.y - 8.5, this.pendingSection, SECTION, true);
    this.y -= h;
    this.pendingSection = null;
  }

  note(text: string) {
    const lines = wrap(text, this.fonts.body, SMALL, WIDTH - PAD * 2);
    const h = lines.length * SMALL * 1.3 + PAD * 2;
    this.flushSection(h);
    this.ensure(h);
    this.rect(MARGIN, this.y - h, WIDTH, h);
    lines.forEach((line, i) => this.text(MARGIN + PAD, this.y - PAD - (i + 1) * SMALL * 1.3 + 2, line, SMALL));
    this.y -= h;
  }
}
