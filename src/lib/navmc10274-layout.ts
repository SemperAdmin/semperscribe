/**
 * NAVMC 10274 (Administrative Action form) layout: the one place both
 * renderers read the official form's geometry from.
 *
 * WHY THIS EXISTS. The live preview (a pdf-lib redraw) and the unsigned
 * export (the government's dynamic XFA blank with its datasets replaced)
 * formatted the same data independently, so the preview showed a
 * document the export did not produce: a different date format, a
 * signature the export dropped, different line breaks, and an overflow
 * page the official form does not have (owner's handoff, 2026-10-21).
 *
 * MEASURED 2026-10-21 on public/forms/navmc-10274-blank.pdf, XFA template
 * stream, with pikepdf. Every field is fixed height, no minH/maxH, text
 * past the box is clipped by Acrobat. Insets are 0.762 mm left/right/top
 * and 0.508 mm bottom except AddrTo (1.27 mm left/right/top) and Date
 * (1 mm all round). Captions sit on top and reserve their own height.
 * Fields with no explicit size take Acrobat's default, 10 pt Times New
 * Roman; SuppInfo and ProcAct set no lineHeight, so the pitch is
 * Acrobat's own. Ascent plus descent of Times New Roman is 1.107 em
 * (11.07 pt), and with the font's lineGap 1.15 em (11.5 pt). Block 12
 * holds 32 lines at the first pitch and 30 at the second. THE SAFE
 * NUMBER IS USED until the owner renders a 31-line and a 32-line file in
 * Acrobat and reports which clips (acceptance item 7); raise
 * `linesPerBlock` here and nowhere else.
 *
 * OWNER'S RULINGS, 2026-10-21:
 *   - Block 13 (Processing Action, page 3) is the continuation box. Text
 *     that overruns block 12 continues there on both paths, and the
 *     processing chain endorses on a separate page. Export blocks only
 *     when block 12 plus block 13 overflow.
 *   - Paragraphs print as the paper box takes them: citation, two
 *     spaces, text, with four spaces per sub-level, in both renderers.
 *   - The typed name goes three blank lines under the text, starting at
 *     the box's horizontal centre line (block 12's caption: "type name of
 *     orginiator and sign 3 lines below text", the form's own spelling).
 *   - The date is the form's own picture, YYYY-MM-DD, on both paths.
 */
import type { ParagraphData } from '@/types';
import { generateCitation } from '@/lib/citation';
import { timesRomanWidth } from '@/lib/times-roman-widths';
import { wrapParagraph, type FlowLine } from '@/lib/page11-flow';

const MM = 72 / 25.4;

/** One text field of the official form, in millimetres as the XFA template states them. */
export interface AaField {
  /** XFA field name, also the datasets tag. */
  name: string;
  block: number;
  widthMm: number;
  heightMm: number;
  fontSize: number;
  /** Line pitch in points: the field's lineHeight, or Acrobat's default for the face. */
  lineHeight: number;
  insetsMm: { left: number; right: number; top: number; bottom: number };
  captionReserveMm: number;
  multiLine: boolean;
}

const STD = { left: 0.762, right: 0.762, top: 0.762, bottom: 0.508 };

/** Acrobat's default pitch for 10 pt Times New Roman, the safe (larger) reading. */
export const AA_DEFAULT_LINE_HEIGHT = 11.5;

export const NAVMC10274_FIELDS: Record<string, AaField> = {
  Date: { name: 'Date', block: 3, widthMm: 63.5, heightMm: 9.102, fontSize: 9, lineHeight: 9, insetsMm: { left: 1, right: 1, top: 1, bottom: 1 }, captionReserveMm: 2.8268, multiLine: false },
  ActNum: { name: 'ActNum', block: 1, widthMm: 28.575, heightMm: 9.525, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 2.8268, multiLine: false },
  FileNum: { name: 'FileNum', block: 2, widthMm: 34.925, heightMm: 9.525, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 3.0891, multiLine: false },
  NameFrom: { name: 'NameFrom', block: 4, widthMm: 98.549, heightMm: 12.7, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 2.8268, multiLine: true },
  OrgStat: { name: 'OrgStat', block: 5, widthMm: 98.113, heightMm: 25.4, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 3.1404, multiLine: true },
  Via1: { name: 'Via1', block: 6, widthMm: 98.737, heightMm: 12.7, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 2.8268, multiLine: true },
  AddrTo: { name: 'AddrTo', block: 7, widthMm: 95.25, heightMm: 28.575, fontSize: 10, lineHeight: 10, insetsMm: { left: 1.27, right: 1.27, top: 1.27, bottom: 0.508 }, captionReserveMm: 0, multiLine: true },
  NatOfAct: { name: 'NatOfAct', block: 8, widthMm: 82.55, heightMm: 19.05, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 2.8268, multiLine: true },
  CopyTo: { name: 'CopyTo', block: 9, widthMm: 82.55, heightMm: 15.875, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 2.8268, multiLine: true },
  RefAuth: { name: 'RefAuth', block: 10, widthMm: 98.425, heightMm: 31.75, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 3.0891, multiLine: true },
  Encl1: { name: 'Encl1', block: 11, widthMm: 98.425, heightMm: 31.75, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 2.8268, multiLine: true },
  SuppInfo: { name: 'SuppInfo', block: 12, widthMm: 196.96, heightMm: 129.965, fontSize: 10, lineHeight: AA_DEFAULT_LINE_HEIGHT, insetsMm: STD, captionReserveMm: 3.1404, multiLine: true },
  ProcAct: { name: 'ProcAct', block: 13, widthMm: 196.85, heightMm: 244.475, fontSize: 10, lineHeight: AA_DEFAULT_LINE_HEIGHT, insetsMm: STD, captionReserveMm: 0, multiLine: true },
};

/** Usable line width of a field in points, inside its insets. */
export function aaUsableWidth(field: AaField): number {
  return (field.widthMm - field.insetsMm.left - field.insetsMm.right) * MM;
}

/** Lines a field holds: usable height over its pitch, floored. */
export function aaLineCapacity(field: AaField): number {
  const usable = (field.heightMm - field.captionReserveMm - field.insetsMm.top - field.insetsMm.bottom) * MM;
  return Math.max(1, Math.floor(usable / field.lineHeight));
}

/** Wraps one paragraph for a field with the face's own metrics. */
export function wrapAaText(text: string, field: AaField): string[] {
  return wrapParagraph(text, (t) => timesRomanWidth(t, field.fontSize), aaUsableWidth(field));
}

/** Lines a multi-paragraph value takes in a field (each newline a paragraph). */
export function aaLinesFor(value: string, field: AaField): number {
  const paragraphs = value.replace(/\r\n?/g, '\n').split('\n');
  return paragraphs.reduce((sum, p) => sum + (p.trim() ? wrapAaText(p, field).length : 1), 0);
}

/**
 * The form's own date picture, YYYY-MM-DD. "today" is the local date; an
 * ISO date passes through; anything the engine can parse is converted;
 * anything else is returned as typed so the drafter sees what was wrong.
 */
export function normalizeAaDate(dateStr: string): string {
  if (!dateStr) return '';
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (dateStr.trim().toLowerCase() === 'today') return iso(new Date());
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) return dateStr.trim();
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? dateStr : iso(parsed);
}

/**
 * The paragraphs as block 12 prints them, in order: citation, two
 * spaces, text, four spaces per sub-level, continuation lines unindented
 * (a plain text box cannot hang-indent). Citations are generated on the
 * UNFILTERED index, so a blank paragraph never renumbers its neighbours;
 * a paragraph with neither text nor title is left out; a title-only
 * paragraph prints its title under its number, as the preview always did.
 */
export function aaBodyParagraphs(paragraphs: readonly ParagraphData[]): string[] {
  const all = paragraphs as ParagraphData[];
  const out: string[] = [];
  paragraphs.forEach((p, index) => {
    const content = (p.content ?? '').trim();
    const title = (p.title ?? '').trim();
    const text = content || title;
    if (!text) return;
    const { citation } = generateCitation(p, index, all);
    const indent = '    '.repeat(Math.max(0, (p.level || 1) - 1));
    out.push(`${indent}${citation}  ${text}`.replace(/\s+$/, ''));
  });
  return out;
}

/** Blank lines between the last text line and the typed name (block 12 caption). */
export const AA_SIGNATURE_BLANK_LINES = 3;

/** Leading spaces that put the typed name's first letter at the box's centre line. */
export function aaSignatureLead(field: AaField = NAVMC10274_FIELDS.SuppInfo): number {
  const space = timesRomanWidth(' ', field.fontSize);
  return Math.round(aaUsableWidth(field) / 2 / space);
}

export interface AaBodyFlow {
  /** Block 12, Supplemental Information. */
  block12: FlowLine[];
  /** Block 13, Processing Action, used as the continuation box (owner's ruling). */
  block13: FlowLine[];
  totalLines: number;
  /** False when block 12 plus block 13 cannot hold the text. */
  fits: boolean;
  /** Which block the typed name landed in, or null without a signature. */
  signatureBlock: 12 | 13 | null;
}

/**
 * Lays the body and the typed name across block 12 then block 13, each
 * at the official form's width and pitch. A block never opens on a blank
 * line, and the signature group (its blank lines plus the name) is never
 * split across the boundary.
 */
export function flowAaBody(paragraphs: readonly ParagraphData[], signature: string): AaBodyFlow {
  const supp = NAVMC10274_FIELDS.SuppInfo;
  const proc = NAVMC10274_FIELDS.ProcAct;
  const lines: FlowLine[] = [];
  aaBodyParagraphs(paragraphs).forEach((paragraph, i) => {
    if (i > 0) lines.push({ text: '', paraStart: true });
    wrapAaText(paragraph, supp).forEach((text, j) => lines.push({ text, paraStart: j === 0 }));
  });
  const name = signature.trim();
  const group: FlowLine[] = name
    ? [
        ...Array.from({ length: AA_SIGNATURE_BLANK_LINES }, () => ({ text: '', paraStart: true })),
        { text: `${' '.repeat(aaSignatureLead(supp))}${name}`, paraStart: true },
      ]
    : [];

  const cap12 = aaLineCapacity(supp);
  const cap13 = aaLineCapacity(proc);
  let block12 = lines.slice(0, cap12);
  let rest = lines.slice(cap12);
  let signatureBlock: 12 | 13 | null = null;
  if (group.length > 0) {
    if (rest.length === 0 && block12.length + group.length <= cap12) {
      block12 = [...block12, ...group];
      signatureBlock = 12;
    } else {
      rest = [...rest, ...group];
      signatureBlock = 13;
    }
  }
  while (rest.length > 0 && !rest[0].text.trim()) rest.shift();
  while (block12.length > 0 && !block12[block12.length - 1].text.trim()) block12.pop();
  const fits = rest.length <= cap13;
  return {
    block12,
    block13: rest,
    totalLines: block12.length + rest.length,
    fits,
    signatureBlock,
  };
}

/**
 * A block's lines as one XFA field value: paragraph breaks kept, wrapped
 * lines rejoined with spaces so Acrobat re-wraps the same words to the
 * same lines (the Page 11 rule, src/lib/page11-flow.ts). Trailing
 * whitespace on a line is dropped; the signature's leading spaces are kept.
 */
export function aaBlockText(lines: readonly FlowLine[]): string {
  let out = '';
  lines.forEach((line, i) => {
    if (i === 0) out = line.text;
    else out += (line.paraStart ? '\n' : ' ') + line.text;
  });
  return out;
}
