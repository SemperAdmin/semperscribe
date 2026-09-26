/**
 * NAVMC 118(11) remarks flow: one entry, two columns a page, as many
 * pages as it takes.
 *
 * Measured 2026-09-26 on the official blank (public/forms/
 * navmc-118-11-blank.pdf, XFA template): Remarks1 is 94.026 mm by
 * 148.428 mm, Remarks2 95.25 mm by 148.077 mm, both Times New Roman
 * 9 pt on a 10 pt line with 0.762 mm insets, multiLine with scrolling
 * off and no growth. That is about 262 pt of line width and 41 lines a
 * column. Text past the 41st line is invisible on the printed form,
 * and the app's redraw clipped at the same place. The four MARADMIN
 * 192/26 shaving-accommodation entries run 45 to 50 lines each at that
 * width, so every one lost its tail (owner's screenshot, 2026-09-26).
 *
 * This module wraps the entry with Times-Roman metrics (the same
 * metrics pdf-lib embeds, so the redraw and the split agree), fills the
 * left column, then the right, then a continuation page, and hands
 * back per-column text. A column's text keeps the source paragraph
 * breaks and rejoins wrapped lines with single spaces, so the official
 * form re-wraps the same words to the same lines and nothing on the
 * form depends on this module's exact break positions. The lines per
 * column is set one under the measured capacity so a one-line metric
 * difference between Acrobat's Times New Roman and Times-Roman never
 * pushes a line off the bottom.
 *
 * The right column is a continuation of the left. Text a drafter types
 * there is a second entry and flows after the first, which is what the
 * ledger means (entries run left column first, then right).
 */
import type { FormData } from '@/types';
import type { ValidationIssue } from '@/lib/letter-validators';
import { timesRomanWidth } from '@/lib/times-roman-widths';

export const PAGE11_FLOW = {
  fontSize: 9,
  lineHeight: 10,
  /** Usable line width in points, the narrower column less its insets. */
  lineWidth: 260,
  /** One under the measured 41 so a metric difference never clips. */
  linesPerColumn: 40,
} as const;

export interface FlowLine {
  text: string;
  /** True on the first line of a source paragraph. */
  paraStart: boolean;
}

export interface Page11Column {
  lines: FlowLine[];
}

export interface Page11Page {
  left: Page11Column;
  right: Page11Column;
}

export interface Page11Flow {
  pages: Page11Page[];
  totalLines: number;
  /** Columns carrying at least one line. */
  columnsUsed: number;
}

export type Measure = (text: string) => number;

export const measureTimes: Measure = (text) => timesRomanWidth(text, PAGE11_FLOW.fontSize);

/**
 * Wraps one paragraph to `maxWidth`. Whitespace inside a line is kept
 * verbatim (signature rules use runs of spaces for alignment), and a
 * paragraph that fits on one line comes back untouched. A word wider
 * than the column stands on its own line rather than being cut.
 */
export function wrapParagraph(paragraph: string, measure: Measure, maxWidth: number): string[] {
  if (measure(paragraph) <= maxWidth) return [paragraph];
  const tokens = paragraph.split(/(\s+)/).filter((t) => t.length > 0);
  const lines: string[] = [];
  let line = '';
  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (line) line += token;
      continue;
    }
    const probe = line + token;
    if (!line || measure(probe) <= maxWidth) {
      line = probe;
    } else {
      lines.push(line.replace(/\s+$/, ''));
      line = token;
    }
  }
  if (line) lines.push(line.replace(/\s+$/, ''));
  return lines;
}

function wrapEntry(text: string, measure: Measure, maxWidth: number): FlowLine[] {
  const out: FlowLine[] = [];
  for (const paragraph of text.replace(/\r\n?/g, '\n').split('\n')) {
    const lines = paragraph.trim() ? wrapParagraph(paragraph, measure, maxWidth) : [''];
    lines.forEach((line, i) => out.push({ text: line, paraStart: i === 0 }));
  }
  return out;
}

/**
 * Lays the entry (and a second entry from the right column, if any)
 * across columns and pages. A column never opens on a blank line.
 */
export function flowPage11(
  remarksLeft: string,
  remarksRight: string,
  options: { measure?: Measure; lineWidth?: number; linesPerColumn?: number } = {},
): Page11Flow {
  const measure = options.measure ?? measureTimes;
  const lineWidth = options.lineWidth ?? PAGE11_FLOW.lineWidth;
  const perColumn = options.linesPerColumn ?? PAGE11_FLOW.linesPerColumn;

  const lines: FlowLine[] = wrapEntry(remarksLeft ?? '', measure, lineWidth);
  if ((remarksRight ?? '').trim()) {
    if (lines.length && lines[lines.length - 1].text.trim()) lines.push({ text: '', paraStart: true });
    lines.push(...wrapEntry(remarksRight, measure, lineWidth));
  }
  // Trailing blank lines carry nothing.
  while (lines.length && !lines[lines.length - 1].text.trim()) lines.pop();

  const columns: Page11Column[] = [];
  let index = 0;
  while (index < lines.length) {
    while (index < lines.length && !lines[index].text.trim()) index += 1;
    if (index >= lines.length) break;
    const take = lines.slice(index, index + perColumn);
    columns.push({ lines: take });
    index += take.length;
  }
  if (columns.length === 0) columns.push({ lines: [] });

  const pages: Page11Page[] = [];
  for (let i = 0; i < columns.length; i += 2) {
    pages.push({ left: columns[i], right: columns[i + 1] ?? { lines: [] } });
  }
  return { pages, totalLines: lines.length, columnsUsed: columns.filter((c) => c.lines.length > 0).length };
}

/** The flow for a Page 11 form. */
export function flowPage11FormData(formData: Record<string, unknown>): Page11Flow {
  return flowPage11(String(formData.remarksLeft ?? ''), String(formData.remarksRight ?? ''));
}

/**
 * A column as text for a form field: paragraph breaks kept, wrapped
 * lines of one paragraph rejoined with single spaces.
 */
export function columnText(column: Page11Column): string {
  let out = '';
  column.lines.forEach((line, i) => {
    if (i === 0) out = line.text;
    else out += (line.paraStart ? '\n' : ' ') + line.text;
  });
  return out;
}

/** The column as printed lines, for the redraw. */
export function columnLines(column: Page11Column): string[] {
  return column.lines.map((l) => l.text);
}

/**
 * The compliance note for an entry which runs past one page. A
 * warning, never a block: the continuation page is the app's own
 * redraw, and the official single-page form cannot carry it.
 */
export function validatePage11Flow(formData: FormData): ValidationIssue[] {
  if (formData.documentType !== 'page11') return [];
  const flow = flowPage11FormData(formData);
  if (flow.pages.length <= 1) return [];
  return [{
    id: 'page11-continuation',
    severity: 'warn',
    rule: `The entry runs to ${flow.pages.length} pages (${flow.totalLines} lines; a page holds two columns of ${PAGE11_FLOW.linesPerColumn}).`,
    citation: 'NAVMC 118(11) column capacity, measured on the official blank',
    detail: 'The PDF export adds continuation pages with the same name and DoD ID. The official fillable form is a single page, so this export uses the app\'s redraw. Shorten the entry to keep it on the official form.',
    field: 'remarksLeft',
  }];
}
