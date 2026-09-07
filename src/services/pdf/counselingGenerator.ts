/**
 * Counseling Worksheet: the app's render (docs/COUNSELING_FORM_PLAN.md
 * section 6, mock-up A of 2026-09-06).
 *
 * No official blank exists, so the record is drawn as a boxed,
 * numbered form the way DD and NAVMC forms read: a title block, ten
 * sections in session order, item numbers with the label in the top
 * left of each box, check boxes for the closed choices, a six-area
 * table, a five-row target table, a two-signer certification block,
 * the handling paragraph of NAVMC 2795 para 3005.1.i as the privacy
 * block, and PRIVACY SENSITIVE top and bottom of every page. No form
 * identifier prints (owner decision): a unit record kept by two people
 * and destroyed at relationship end has no edition to track.
 *
 * `counselingFormModel` holds every printed value by item number, so
 * tests check content without parsing the drawing.
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { FormData } from '@/types';
import {
  AREA_CITATION, COUNSELING_AREAS, COUNSELING_LIFE_EVENTS, HANDLING_STATEMENT, ICS_OBJECTIVES, PRIVACY_MARKING, STANDARD_KINDS,
  counselingArea, counselingAreaEntries, counselingField, counselingIcsObjectives, counselingLifeEvents, counselingOccasion,
  counselingPriorTargets, counselingSubjects, counselingTargets, rankAbbreviation, targetSentence,
  JEPES_ADVERSE_REASONS, JEPES_ATTRIBUTES, JEPES_CITATION, benchmarkHasMarks, counselingBenchmark, counselingPriorBenchmark,
  isJepesGrade, jepesBand,
  type CounselingAreaEntry, type CounselingPriorTarget, type CounselingSubject, type CounselingTarget,
} from '@/lib/counseling';

// --- the model ---

export interface FormCheck { label: string; on: boolean }

export interface FormItem {
  n: number;
  label: string;
  value?: string;
  checks?: FormCheck[];
}

export interface CounselingFormModel {
  title: string;
  subtitle: string;
  items: FormItem[];
  /** Section IV, by occasion: 'ics', 'event' or 'review'. */
  agenda: 'ics' | 'event' | 'review';
  areas: CounselingAreaEntry[];
  subjects: CounselingSubject[];
  priorTargets: CounselingPriorTarget[];
  targets: CounselingTarget[];
  marineCommentsIncluded: boolean;
  /**
   * Section VI-A. Present only when the grade on the worksheet is E-1
   * to E-4 AND at least one mark was entered: a blank benchmark prints
   * nothing, so a worksheet without one looks as it did before.
   */
  benchmark: BenchmarkRow[] | null;
  handling: string;
}

export interface BenchmarkRow {
  attribute: string;
  prior: string;
  mark: string;
  band: string;
  /** Justification, with the adverse reason and commendatory note folded in. */
  justification: string;
}

function benchmarkRows(formData: FormData): BenchmarkRow[] | null {
  if (!isJepesGrade(counselingField(formData, 'counselingMarineGrade'))) return null;
  const benchmark = counselingBenchmark(formData);
  if (!benchmarkHasMarks(benchmark)) return null;
  const prior = counselingPriorBenchmark(formData);
  return JEPES_ATTRIBUTES.map((a) => {
    const m = benchmark[a.id];
    const band = jepesBand(m.mark);
    const parts: string[] = [];
    if (band?.id === 'adverse' && m.adverseReason) parts.push(JEPES_ADVERSE_REASONS.find((r) => r.value === m.adverseReason)?.label ?? m.adverseReason);
    if (m.justification.trim()) parts.push(m.justification.trim());
    if (band?.id === 'exceptional') parts.push(m.commendatory ? 'Formal commendatory material on file.' : 'Formal commendatory material not confirmed.');
    return {
      attribute: a.title,
      prior: prior[a.id].trim(),
      mark: band ? m.mark.trim() : '',
      band: band?.label ?? '',
      justification: parts.join(' '),
    };
  });
}

function gradeText(value: string): string {
  const abbr = rankAbbreviation(value);
  return value && abbr !== value ? `${abbr} ${value}` : value;
}

function name(formData: FormData, prefix: string): string {
  const get = (f: string) => counselingField(formData, `${prefix}${f}`).trim();
  const tail = [get('FirstName'), get('MiddleInitial') ? `${get('MiddleInitial').replace(/\.$/, '')}.` : ''].filter(Boolean).join(', ');
  return [get('LastName'), tail].filter(Boolean).join(', ');
}

export function counselingFormModel(formData: FormData): CounselingFormModel {
  const get = (f: string) => counselingField(formData, f).trim();
  const occasionValue = get('counselingOccasion');
  const occasion = counselingOccasion(occasionValue);
  const kind = occasion?.kind;
  const lifeEvents = counselingLifeEvents(formData);
  const objectives = new Set(counselingIcsObjectives(formData));
  const component = get('counselingMarineComponent');

  const items: FormItem[] = [
    {
      n: 1, label: 'OCCASION',
      checks: [
        { label: 'Initial (ICS)', on: kind === 'initial' },
        { label: 'Follow-on', on: kind === 'follow-on' },
        { label: '30-day (LCpl and below)', on: kind === 'thirty-day' },
        { label: 'Event-related', on: kind === 'event' },
        { label: `Other: ${kind === 'baseline' ? occasion!.label : ''}`, on: kind === 'baseline' },
      ],
    },
    { n: 2, label: 'DATE OF SESSION', value: get('date') },
    { n: 3, label: 'TARGET DATE, NEXT SESSION', value: get('counselingNextSessionDate') },
    { n: 4, label: 'DATE OF ICS', value: get('counselingIcsDate') },
    { n: 5, label: 'DATE OF LAST SESSION', value: get('counselingLastSessionDate') },
    {
      n: 6, label: 'LIFE EVENTS',
      checks: [
        ...COUNSELING_LIFE_EVENTS.map((e) => ({ label: e.label, on: lifeEvents.includes(e.value) })),
        { label: `Unit-specific: ${get('counselingLifeEventsOther')}`, on: !!get('counselingLifeEventsOther') },
      ],
    },
    { n: 7, label: 'NAME (Last, First, MI)', value: name(formData, 'counselingMarine') },
    { n: 8, label: 'GRADE', value: gradeText(get('counselingMarineGrade')) },
    { n: 9, label: 'EDIPI', value: get('counselingMarineEdipi') },
    { n: 10, label: 'DOR', value: get('counselingMarineDor') },
    { n: 11, label: 'PMOS', value: get('counselingMarinePmos') },
    { n: 12, label: 'BILLET TITLE AND DESCRIPTION', value: [get('counselingBilletTitle'), get('counselingBilletDescription')].filter(Boolean).join('. ') },
    { n: 13, label: 'BMOS', value: get('counselingMarineBilletMos') },
    { n: 14, label: 'COMP', checks: [{ label: 'AC', on: component === 'active' }, { label: 'RC', on: component === 'reserve' }] },
    { n: 15, label: 'NAME (Last, First, MI)', value: name(formData, 'counselingSenior') },
    { n: 16, label: 'GRADE', value: gradeText(get('counselingSeniorGrade')) },
    { n: 17, label: 'EDIPI', value: get('counselingSeniorEdipi') },
    { n: 18, label: 'BILLET', value: get('counselingSeniorBillet') },
    kind === 'initial'
      ? { n: 19, label: 'ICS OBJECTIVES COVERED', checks: ICS_OBJECTIVES.map((o) => ({ label: o.text.replace(/\.$/, ''), on: objectives.has(o.id) })) }
      : kind === 'event'
        ? { n: 19, label: 'EVENT', value: get('counselingEventDescription') }
        : { n: 19, label: 'AGENDA', value: occasion ? "Progress on the targets set last session (Section VII), strengths and deficiencies, problems since the last session and an agreed solution." : '' },
    { n: 20, label: 'AREA' },
    { n: 21, label: 'SUBJECTS DISCUSSED' },
    { n: 22, label: 'MAJOR ACCOMPLISHMENTS AND SIGNIFICANT EVENTS', value: get('counselingAccomplishments') },
    { n: 23, label: 'STRENGTHS', value: get('counselingStrengths') },
    { n: 24, label: 'DEFICIENCIES', value: get('counselingDeficiencies') },
    { n: 25, label: 'TARGET SET LAST SESSION' },
    { n: 26, label: 'TARGET (action, object, standard)' },
    { n: 27, label: "SENIOR'S COMMENTS", value: get('counselingSeniorComments') },
    { n: 28, label: "MARINE'S COMMENTS (optional)", value: get('counselingMarineComments') },
    { n: 29, label: 'MARINE PERFORMING COUNSELING', value: [rankAbbreviation(get('counselingSeniorGrade')), name(formData, 'counselingSenior')].filter(Boolean).join(' ') },
    { n: 30, label: 'DATE', value: get('counselingSeniorSignedDate') },
    { n: 31, label: 'MARINE COUNSELED', value: [rankAbbreviation(get('counselingMarineGrade')), name(formData, 'counselingMarine')].filter(Boolean).join(' ') },
    { n: 32, label: 'DATE', value: get('counselingMarineSignedDate') },
  ];

  return {
    title: 'COUNSELING WORKSHEET',
    subtitle: 'Unit record under MCO 1500.61 and NAVMC 2795 (App A). Not an official form.',
    items,
    agenda: kind === 'initial' ? 'ics' : kind === 'event' ? 'event' : 'review',
    areas: counselingAreaEntries(formData),
    subjects: counselingSubjects(formData).filter((s) => s.text.trim()),
    priorTargets: counselingPriorTargets(formData).filter((t) => t.text.trim()),
    targets: counselingTargets(formData),
    marineCommentsIncluded: (formData as Record<string, unknown>).counselingIncludeMarineComments === true || !!get('counselingMarineComments'),
    benchmark: benchmarkRows(formData),
    handling: HANDLING_STATEMENT,
  };
}

// --- the drawing ---

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const TOP = PAGE_H - 48;
const BOTTOM = 44;
const WIDTH = PAGE_W - MARGIN * 2;
const INK = rgb(0, 0, 0);
const SHADE = rgb(0.88, 0.88, 0.88);
const LINE = 0.6;
const LABEL = 6.5;
const VALUE = 9;
const SECTION = 8;
const SMALL = 7;
const PAD = 3;
const LABEL_H = 9;
const CHECK = 6.5;

interface Fonts { body: PDFFont; bold: PDFFont }

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

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
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
interface Cell {
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

class Sheet {
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

function item(model: CounselingFormModel, n: number): FormItem {
  return model.items.find((i) => i.n === n)!;
}

function labelled(i: FormItem): string {
  return `${i.n}. ${i.label}`;
}

export async function generateCounseling(formData: FormData): Promise<Uint8Array> {
  const model = counselingFormModel(formData);
  const doc = await PDFDocument.create();
  doc.setTitle('Counseling Worksheet');
  const fonts: Fonts = { body: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const s = new Sheet(doc, fonts);
  const it = (n: number) => item(model, n);
  const cell = (n: number, w: number, extra: Partial<Cell> = {}): Cell => {
    const i = it(n);
    return { w, label: labelled(i), value: i.value, checks: i.checks, ...extra };
  };

  // Title block.
  {
    const h = 30;
    s.rect(MARGIN, s.y - h, WIDTH, h);
    const tw = fonts.bold.widthOfTextAtSize(model.title, 13);
    s.text((PAGE_W - tw) / 2, s.y - 13, model.title, 13, true);
    const sw = fonts.body.widthOfTextAtSize(model.subtitle, SMALL);
    s.text((PAGE_W - sw) / 2, s.y - 25, model.subtitle, SMALL);
    s.y -= h;
  }

  // Section I. Session: item 1 tall on the left, items 2 to 5 as two rows on the right.
  s.section('SECTION I. SESSION');
  {
    const leftW = 190;
    const rightW = (WIDTH - leftW) / 2;
    const left = cell(1, leftW);
    const r1 = [cell(2, rightW), cell(3, rightW)];
    const r2 = [cell(4, rightW), cell(5, rightW)];
    const leftH = s.cellHeight(left);
    const h1 = Math.max(...r1.map((c) => s.cellHeight(c)));
    const h2 = Math.max(...r2.map((c) => s.cellHeight(c)));
    const rightH = h1 + h2;
    const total = Math.max(leftH, rightH);
    const extra = total - rightH;
    s.flushSection(total);
    s.ensure(total);
    s.drawCell(MARGIN, s.y, total, left);
    let x = MARGIN + leftW;
    for (const c of r1) { s.drawCell(x, s.y, h1 + extra, c); x += c.w; }
    x = MARGIN + leftW;
    for (const c of r2) { s.drawCell(x, s.y - h1 - extra, h2, c); x += c.w; }
    s.y -= total;
  }
  s.row([cell(6, WIDTH, { perLine: 2 })]);

  // Section II. Marine counseled.
  s.section('SECTION II. MARINE COUNSELED');
  s.row([cell(7, 200), cell(8, 70), cell(9, 100), cell(10, 90), cell(11, 80)]);
  s.row([cell(12, 360), cell(13, 80), cell(14, 100, { perLine: 2 })]);

  // Section III. Senior.
  s.section('SECTION III. MARINE PERFORMING COUNSELING (SENIOR)');
  s.row([cell(15, 200), cell(16, 70), cell(17, 100), cell(18, 170)]);

  // Section IV. Agenda, by occasion.
  const agendaCite = model.agenda === 'ics' ? 'initial: NAVMC 2795 para 2001.1.b' : model.agenda === 'event' ? 'event-related: NAVMC 2795 para 2001.4' : 'follow-on and 30-day: NAVMC 2795 para 2001.2.b, 2001.3';
  s.section(`SECTION IV. AGENDA (${agendaCite})`);
  s.row([cell(19, WIDTH, model.agenda === 'ics' ? { perLine: 2 } : { minLines: 2 })]);

  // Section V. The six areas.
  s.section(`SECTION V. FUNCTIONAL AREAS OF LEADER DEVELOPMENT (${AREA_CITATION})`);
  const areaCols = [80, 40, 40, 40, WIDTH - 200];
  s.table(
    [
      { w: areaCols[0], value: labelled(it(20)), bold: true, size: LABEL + 0.5 },
      { w: areaCols[1], value: 'DIS', bold: true, size: LABEL + 0.5 },
      { w: areaCols[2], value: 'N/S', bold: true, size: LABEL + 0.5 },
      { w: areaCols[3], value: 'TGT', bold: true, size: LABEL + 0.5 },
      { w: areaCols[4], value: 'NOTES', bold: true, size: LABEL + 0.5 },
    ],
    model.areas.map((entry) => {
      const area = COUNSELING_AREAS.find((a) => a.id === entry.area)!;
      return [
        { w: areaCols[0], value: area.title },
        { w: areaCols[1], checks: [{ label: '', on: entry.status === 'discussed' }] },
        { w: areaCols[2], checks: [{ label: '', on: entry.status === 'not-this-session' }] },
        { w: areaCols[3], checks: [{ label: '', on: entry.status === 'target-set' }] },
        { w: areaCols[4], value: entry.notes.trim() },
      ];
    }),
    'DIS = discussed.  N/S = not this session.  TGT = target set (Section VIII).',
  );

  // 21. Subjects discussed.
  {
    const lines = model.subjects.map((sub, i) => {
      const tag = sub.area === 'duties' ? 'Duties' : counselingArea(sub.area)?.title ?? '';
      return `${String.fromCharCode(97 + (i % 26))}. ${sub.text.trim()}${tag ? `  [${tag}]` : ''}`;
    });
    s.row([{ w: WIDTH, label: `${labelled(it(21))} (NAVMC 2795 para 3005.1.j)`, value: lines.join('\n'), minLines: 2 }]);
  }

  // Section VI. Performance.
  s.section('SECTION VI. PERFORMANCE THIS PERIOD');
  s.row([cell(22, WIDTH, { minLines: 2 })]);
  s.row([cell(23, WIDTH / 2, { minLines: 2 }), cell(24, WIDTH / 2, { minLines: 2 })]);

  // Section VI-A. The provisional JEPES benchmark, only when marked.
  if (model.benchmark) {
    s.section(`SECTION VI-A. JEPES BENCHMARK (provisional, not the mark of record; ${JEPES_CITATION})`);
    const priorDate = counselingPriorBenchmark(formData).date.trim();
    const benchCols = [150, 50, 50, 110, WIDTH - 150 - 50 - 50 - 110];
    s.table(
      [
        { w: benchCols[0], value: 'ATTRIBUTE', bold: true, size: LABEL + 0.5 },
        { w: benchCols[1], value: priorDate ? `PRIOR (${priorDate})` : 'PRIOR', bold: true, size: LABEL + 0.5 },
        { w: benchCols[2], value: 'THIS SESSION', bold: true, size: LABEL + 0.5 },
        { w: benchCols[3], value: 'BAND', bold: true, size: LABEL + 0.5 },
        { w: benchCols[4], value: 'JUSTIFICATION', bold: true, size: LABEL + 0.5 },
      ],
      model.benchmark.map((r) => [
        { w: benchCols[0], value: r.attribute },
        { w: benchCols[1], value: r.prior },
        { w: benchCols[2], value: r.mark },
        { w: benchCols[3], value: r.band },
        { w: benchCols[4], value: r.justification },
      ]),
      'The senior\'s mark at this session, entered on the counseling worksheet. The mark of record is entered in JEPES by the reporting chain at period end. Working Toward and Below Expectations are not adverse and do not by themselves NOT REC (MCO 1616.1 encl (1) para 3.a(4), 3.a(5)).',
    );
  }

  // Section VII. Review of targets from last session.
  s.section('SECTION VII. REVIEW OF TARGETS FROM LAST SESSION (follow-on only, NAVMC 2795 para 2001.2.b)');
  const reviewCols = [24, WIDTH - 24 - 150, 150];
  const reviewRows = model.priorTargets.length >= 2 ? model.priorTargets : [...model.priorTargets, ...Array.from({ length: 2 - model.priorTargets.length }, () => ({ text: '', status: '' as const }))];
  s.table(
    [
      { w: reviewCols[0], value: '25.', bold: true, size: LABEL + 0.5 },
      { w: reviewCols[1], value: it(25).label, bold: true, size: LABEL + 0.5 },
      { w: reviewCols[2], value: 'RESULT', bold: true, size: LABEL + 0.5 },
    ],
    reviewRows.map((t, i) => [
      { w: reviewCols[0], value: `${String.fromCharCode(97 + (i % 26))}.` },
      { w: reviewCols[1], value: t.text.trim(), minLines: 2 },
      {
        w: reviewCols[2], perLine: 3, size: VALUE - 1,
        checks: [
          { label: 'Met', on: t.status === 'met' }, { label: 'Part', on: t.status === 'partly-met' }, { label: 'Not', on: t.status === 'not-met' },
          { label: 'Dropped', on: t.status === 'dropped' }, { label: 'Carried', on: t.status === 'carried-forward' }, { label: '', on: false },
        ],
      },
    ]),
  );

  // Section VIII. Targets, five rows always.
  s.section('SECTION VIII. TARGETS FOR THE COMING PERIOD (NAVMC 2795 para 4002)');
  const targetCols = [24, 300, 60, 66, WIDTH - 450];
  const stdCode: Record<string, string> = { quantity: 'Qn', quality: 'Ql', timeliness: 'T', manner: 'M' };
  const targetRows = model.targets.length >= 5 ? model.targets : [...model.targets, ...Array.from({ length: 5 - model.targets.length }, () => ({ action: '', object: '', standardKinds: [], standard: '', dueDate: '', area: '' as const }))];
  s.table(
    [
      { w: targetCols[0], value: '26.', bold: true, size: LABEL + 0.5 },
      { w: targetCols[1], value: it(26).label, bold: true, size: LABEL + 0.5 },
      { w: targetCols[2], value: 'STD', bold: true, size: LABEL + 0.5 },
      { w: targetCols[3], value: 'DUE', bold: true, size: LABEL + 0.5 },
      { w: targetCols[4], value: 'AREA', bold: true, size: LABEL + 0.5 },
    ],
    targetRows.map((t, i) => {
      const sentence = targetSentence(t);
      const body = sentence ? sentence.replace(/ by [^,]+\.$/, '.') : '';
      return [
        { w: targetCols[0], value: `${String.fromCharCode(97 + (i % 26))}.` },
        { w: targetCols[1], value: body, minLines: 1 },
        { w: targetCols[2], value: t.standardKinds.map((k) => stdCode[k] ?? k).join(', ') },
        { w: targetCols[3], value: t.dueDate.trim() },
        { w: targetCols[4], value: t.area ? counselingArea(t.area)?.title ?? t.area : '' },
      ];
    }),
    `STD: ${STANDARD_KINDS.map((k) => `${stdCode[k.value]} = ${k.label.toLowerCase()}`).join(', ')} (NAVMC 2795 para 4002.1.h).`,
  );

  // Section IX. Comments.
  s.section('SECTION IX. COMMENTS');
  s.row([cell(27, WIDTH / 2, { minLines: 3 }), cell(28, WIDTH / 2, { minLines: 3, value: model.marineCommentsIncluded ? it(28).value : '' })]);

  // Section X. Certification.
  s.section('SECTION X. CERTIFICATION');
  const sigCols = [300, 150, WIDTH - 450];
  s.row([cell(29, sigCols[0], { minLines: 2 }), { w: sigCols[1], label: 'SIGNATURE', minLines: 2 }, cell(30, sigCols[2], { minLines: 2 })]);
  s.row([cell(31, sigCols[0], { minLines: 2 }), { w: sigCols[1], label: 'SIGNATURE', minLines: 2 }, cell(32, sigCols[2], { minLines: 2 })]);
  s.note(`HANDLING. ${model.handling}`);

  // Marking and page numbers, once the count is known.
  const total = s.pages.length;
  const mw = fonts.bold.widthOfTextAtSize(PRIVACY_MARKING, SMALL + 1);
  s.pages.forEach((page, i) => {
    page.drawText(PRIVACY_MARKING, { x: (PAGE_W - mw) / 2, y: PAGE_H - 30, size: SMALL + 1, font: fonts.bold, color: INK });
    page.drawText(PRIVACY_MARKING, { x: (PAGE_W - mw) / 2, y: 26, size: SMALL + 1, font: fonts.bold, color: INK });
    const pn = `Page ${i + 1} of ${total}`;
    page.drawText(pn, { x: PAGE_W - MARGIN - fonts.body.widthOfTextAtSize(pn, SMALL), y: 26, size: SMALL, font: fonts.body, color: INK });
  });

  return doc.save();
}
