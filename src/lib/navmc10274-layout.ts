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
import type { FormData, ParagraphData } from '@/types';
import { generateCitation } from '@/lib/citation';
import { refLetterAt, startingEnclosureNumberFor, startingRefLetterFor } from '@/lib/reference-letters';
import { timesRomanWidth } from '@/lib/times-roman-widths';
import { wrapParagraph, type FlowLine } from '@/lib/page11-flow';

const MM = 72 / 25.4;

/** One text field of the official form, in millimetres as the XFA template states them. */
export interface AaField {
  /** XFA field name, also the datasets tag. */
  name: string;
  block: number;
  /** Form page the field sits on (the official form's page 1 is instructions). */
  page: 2 | 3;
  /** Position inside the page's content subform, in millimetres from its top-left corner. */
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  fontSize: number;
  /** Line pitch in points: the field's lineHeight, or Acrobat's default for the face. */
  lineHeight: number;
  insetsMm: { left: number; right: number; top: number; bottom: number };
  captionReserveMm: number;
  multiLine: boolean;
  /** Horizontal alignment the field's para sets; left when absent. */
  hAlign?: 'center';
}

const STD = { left: 0.762, right: 0.762, top: 0.762, bottom: 0.508 };

/** Acrobat's default pitch for 10 pt Times New Roman, the safe (larger) reading. */
export const AA_DEFAULT_LINE_HEIGHT = 11.5;

export const NAVMC10274_FIELDS: Record<string, AaField> = {
  Date: { name: 'Date', block: 3, page: 2, xMm: 133.35, yMm: 19.473, widthMm: 63.5, heightMm: 9.102, fontSize: 9, lineHeight: 9, insetsMm: { left: 1, right: 1, top: 1, bottom: 1 }, captionReserveMm: 2.8268, multiLine: false, hAlign: 'center' },
  ActNum: { name: 'ActNum', block: 1, page: 2, xMm: 133.35, yMm: 9.948, widthMm: 28.575, heightMm: 9.525, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 2.8268, multiLine: false },
  FileNum: { name: 'FileNum', block: 2, page: 2, xMm: 161.925, yMm: 9.948, widthMm: 34.925, heightMm: 9.525, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 3.0891, multiLine: false },
  NameFrom: { name: 'NameFrom', block: 4, page: 2, xMm: 0.298, yMm: 28.759, widthMm: 98.549, heightMm: 12.7, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 2.8268, multiLine: true },
  OrgStat: { name: 'OrgStat', block: 5, page: 2, xMm: 98.847, yMm: 28.575, widthMm: 98.113, heightMm: 25.4, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 3.1404, multiLine: true },
  Via1: { name: 'Via1', block: 6, page: 2, xMm: 0.11, yMm: 41.275, widthMm: 98.737, heightMm: 12.7, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 2.8268, multiLine: true },
  AddrTo: { name: 'AddrTo', block: 7, page: 2, xMm: 12.81, yMm: 57.15, widthMm: 95.25, heightMm: 28.575, fontSize: 10, lineHeight: 10, insetsMm: { left: 1.27, right: 1.27, top: 1.27, bottom: 0.508 }, captionReserveMm: 0, multiLine: true },
  NatOfAct: { name: 'NatOfAct', block: 8, page: 2, xMm: 114.41, yMm: 53.975, widthMm: 82.55, heightMm: 19.05, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 2.8268, multiLine: true },
  CopyTo: { name: 'CopyTo', block: 9, page: 2, xMm: 114.41, yMm: 73.025, widthMm: 82.55, heightMm: 15.875, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 2.8268, multiLine: true },
  RefAuth: { name: 'RefAuth', block: 10, page: 2, xMm: 0.11, yMm: 88.9, widthMm: 98.425, heightMm: 31.75, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 3.0891, multiLine: true },
  Encl1: { name: 'Encl1', block: 11, page: 2, xMm: 98.535, yMm: 88.9, widthMm: 98.425, heightMm: 31.75, fontSize: 9, lineHeight: 10, insetsMm: STD, captionReserveMm: 2.8268, multiLine: true },
  SuppInfo: { name: 'SuppInfo', block: 12, page: 2, xMm: 0, yMm: 120.86, widthMm: 196.96, heightMm: 129.965, fontSize: 10, lineHeight: AA_DEFAULT_LINE_HEIGHT, insetsMm: STD, captionReserveMm: 3.1404, multiLine: true },
  ProcAct: { name: 'ProcAct', block: 13, page: 3, xMm: 0, yMm: 12.7, widthMm: 196.85, heightMm: 244.475, fontSize: 10, lineHeight: AA_DEFAULT_LINE_HEIGHT, insetsMm: STD, captionReserveMm: 0, multiLine: true },
};

/** Block numbers to the form's own captions, for messages. */
export const AA_BLOCK_LABELS: Record<number, string> = {
  1: 'Action No.', 2: 'SSIC/File No.', 3: 'Date', 4: 'From', 5: 'Organization and Station',
  6: 'Via', 7: 'To', 8: 'Nature of Action/Subject', 9: 'Copy To', 10: 'Reference or Authority',
  11: 'Enclosures', 12: 'Supplemental Information', 13: 'Processing Action',
};

/**
 * Page geometry. The XFA page is US Letter; its one content area starts
 * 9.525 mm in from the top-left corner, and the page 2 and page 3
 * subforms fill it, so a field's position inside its subform plus that
 * origin is its position on the page.
 */
export const AA_PAGE = { widthPt: 612, heightPt: 792, contentOriginMm: 9.525 } as const;

/** A rectangle in PDF points, bottom-left origin, `top` the y of the top edge. */
export interface AaRect { left: number; top: number; width: number; height: number }

/** The whole field, caption included, on its page. */
export function aaFieldFrame(field: AaField): AaRect {
  const left = (AA_PAGE.contentOriginMm + field.xMm) * MM;
  const top = AA_PAGE.heightPt - (AA_PAGE.contentOriginMm + field.yMm) * MM;
  return { left, top, width: field.widthMm * MM, height: field.heightMm * MM };
}

/** The area the text occupies: the frame less the caption reserve and the insets. */
export function aaTextBox(field: AaField): AaRect {
  const frame = aaFieldFrame(field);
  const { left, right, top, bottom } = field.insetsMm;
  return {
    left: frame.left + left * MM,
    top: frame.top - (field.captionReserveMm + top) * MM,
    width: frame.width - (left + right) * MM,
    height: frame.height - (field.captionReserveMm + top + bottom) * MM,
  };
}

/**
 * Baseline of the first line below the text box's top edge. Times New
 * Roman's ascent is 0.891 em; Acrobat sets the first line's ascender on
 * the top inset, so the baseline sits that far down.
 */
export const AA_ASCENT_EM = 0.891;
export function aaFirstBaselineOffset(field: AaField): number {
  return field.fontSize * AA_ASCENT_EM;
}

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

/** A multi-paragraph value as the field's lines (each newline a paragraph, a blank one a blank line). */
export function wrapAaValue(value: string, field: AaField): string[] {
  const paragraphs = value.replace(/\r\n?/g, '\n').split('\n');
  return paragraphs.flatMap((p) => (p.trim() ? wrapAaText(p, field) : ['']));
}

/** Lines a multi-paragraph value takes in a field. */
export function aaLinesFor(value: string, field: AaField): number {
  return wrapAaValue(value, field).length;
}

/** The code points above 0x7E that WinAnsi carries besides Latin-1. */
const WINANSI_EXTRAS = '\u20AC\u201A\u0192\u201E\u2026\u2020\u2021\u02C6\u2030\u0160\u2039\u0152\u017D\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u02DC\u2122\u0161\u203A\u0153\u017E\u0178';

/**
 * The preview draws with pdf-lib's standard Times-Roman, which encodes
 * WinAnsi and throws on anything else, taking the whole preview down for
 * one character. The official export carries the full string (Acrobat's
 * Times New Roman has the glyphs). A character outside WinAnsi is drawn
 * as "?" and reported, so a silent alteration is impossible; a no-break
 * space becomes a space.
 */
export function sanitizeForTimesRoman(text: string): { text: string; replaced: string[] } {
  const replaced: string[] = [];
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (code === 0xa0) { out += ' '; continue; }
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff) || WINANSI_EXTRAS.includes(ch)) {
      out += ch;
      continue;
    }
    replaced.push(ch);
    out += '?';
  }
  return { text: out, replaced };
}

/**
 * The form's own date picture, YYYY-MM-DD. "today" is the local date; an
 * ISO date passes through; anything the engine can parse is converted;
 * anything else is returned as typed so the drafter sees what was wrong.
 */
const AA_MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

const isoPicture = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * The Date field's picture is YYYY-MM-DD. The app's own date text is
 * "D Mon YY" or "D Mon YYYY" (a two-digit year is 20YY); that form and the
 * picture itself are read by hand, so no engine's Date parser and no time
 * zone touches them. Only an unrecognised string falls through to the
 * engine, and then a string carrying its own zone (a trailing Z or offset)
 * is read in UTC so the calendar day it names is the day written. A string
 * nothing can read is written as typed. "today" is the local calendar day.
 */
export function normalizeAaDate(dateStr: string): string {
  if (!dateStr) return '';
  const text = dateStr.trim();
  if (text.toLowerCase() === 'today') {
    const d = new Date();
    return isoPicture(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const dmy = /^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{2}|\d{4})$/.exec(text);
  if (dmy) {
    const month = AA_MONTHS[dmy[2].slice(0, 3).toLowerCase()];
    const day = Number(dmy[1]);
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    // A day the month does not have ("31 Feb 26") is returned as typed,
    // so the drafter sees the slip instead of a picture no calendar holds.
    if (month && new Date(Date.UTC(year, month - 1, day)).getUTCDate() === day) {
      return isoPicture(year, month, day);
    }
    return dateStr;
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(text) && /\d{4}-\d{2}-\d{2}T/.test(text)
    ? isoPicture(parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate())
    : isoPicture(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

/**
 * Via lines as both renderers print them: the empty entries dropped, a
 * single via bare, two or more numbered "(1) ", "(2) ". One function so
 * the official export and the preview cannot number differently.
 */
export function aaViaLines(vias: readonly string[]): string[] {
  const list = vias.map(v => v.trim()).filter(Boolean);
  return list.length <= 1 ? list : list.map((v, i) => `(${i + 1}) ${v}`);
}

/**
 * The paragraphs as block 12 prints them, in order: citation, two
 * spaces, text, four spaces per sub-level, continuation lines unindented
 * (a plain text box cannot hang-indent). Citations are generated on the
 * UNFILTERED index, so a blank paragraph never renumbers its neighbours;
 * a paragraph with neither text nor title is left out; a title-only
 * paragraph prints its title under its number, as the preview always did.
 * Whitespace runs inside a paragraph, a pasted newline among them,
 * collapse to one space: the box takes a paragraph as one run of words,
 * and a hard break inside one used to throw in the preview and break a
 * line in Acrobat that the flow had not counted.
 */
export function aaBodyParagraphs(paragraphs: readonly ParagraphData[]): string[] {
  const all = paragraphs as ParagraphData[];
  const out: string[] = [];
  paragraphs.forEach((p, index) => {
    const content = (p.content ?? '').replace(/\s+/g, ' ').trim();
    const title = (p.title ?? '').replace(/\s+/g, ' ').trim();
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

/**
 * The text each small box carries, built once for every consumer: the
 * official export, the preview's data builder and the fit validator read
 * this table, so a box cannot hold different words on different paths.
 * `formField` is the form input an overflow message points at; the lists
 * (via, reference, enclosure, copy to) have no single input and carry none.
 */
export interface AaFieldValue {
  field: AaField;
  value: string;
  formField?: string;
}

export interface AaFieldInputs {
  formData: FormData;
  vias: readonly string[];
  references: readonly string[];
  enclosures: readonly string[];
  copyTos: readonly string[];
}

export function aaFieldValues({ formData, vias, references, enclosures, copyTos }: AaFieldInputs): AaFieldValue[] {
  const refStart = startingRefLetterFor(formData.documentType, formData.startingReferenceLevel);
  const enclStart = startingEnclosureNumberFor(formData.documentType, formData.startingEnclosureNumber);
  const f = NAVMC10274_FIELDS;
  return [
    { field: f.ActNum, value: formData.actionNo || '', formField: 'actionNo' },
    { field: f.FileNum, value: formData.ssic || '', formField: 'ssic' },
    { field: f.Date, value: normalizeAaDate(formData.date || ''), formField: 'date' },
    { field: f.NameFrom, value: formData.from || '', formField: 'from' },
    { field: f.OrgStat, value: formData.orgStation || '', formField: 'orgStation' },
    { field: f.Via1, value: aaViaLines(vias).join('\n') },
    { field: f.AddrTo, value: formData.to || '', formField: 'to' },
    { field: f.NatOfAct, value: formData.subj || '', formField: 'subj' },
    { field: f.CopyTo, value: copyTos.map(c => c.trim()).filter(Boolean).join('\n') },
    {
      field: f.RefAuth,
      value: references.filter(r => r.trim()).map((r, i) => `(${refLetterAt(refStart, i)}) ${r}`).join('\n'),
    },
    {
      field: f.Encl1,
      value: enclosures.filter(e => e.trim()).map((e, i) => `(${enclStart + i}) ${e}`).join('\n'),
    },
  ];
}
