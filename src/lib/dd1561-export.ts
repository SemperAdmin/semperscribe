/**
 * DD Form 1561 (DEC 2017) official-form export: fills the prepared AcroForm
 * blank (public/forms/dd-1561-blank.pdf) from dd1561FieldValues and returns
 * it UNFLATTENED, so the member, the certifying official and finance can
 * still edit it in any PDF viewer. Preview and export share this path.
 * Spec: docs/DD1561_FSA_SPEC.md (P1a, P1b, P4, Q phase 4).
 *
 * Why this does not go through acroform-fill.ts:
 *  - acroform-fill skips '' values; this form's value map uses '' to CLEAR.
 *  - Every text field needs an explicit font size written into its /DA (the
 *    blank's sizes do not survive pdf-lib's appearance pass; block 7 came out
 *    about twice too large), and the size is chosen per value to fit the
 *    widget. acroform-fill has no per-field size.
 *  - The check boxes carry only an ON appearance (/1, the form's own ZapfDingbats
 *    cross) and no /Off stream. pdf-lib's check() would redraw them with its
 *    own tick, so they are written at the dictionary level (V and AS), the way
 *    acroform-fill writes radio groups.
 *
 * Fixed rules (owner decisions):
 *  - The two /Sig fields (9b nineB, 15d fifteenD) are never touched, so the
 *    member and the certifying official sign them with a CAC.
 *  - No SSN: identifiers are the 10-digit EDIPI (rules print nothing else),
 *    and any value shaped like an SSN refuses the export in plain words.
 *  - Never flattened.
 *  - Block 10 holds rows 1-3. Rows 4 onward go on an appended continuation
 *    page of static text (the form says "Attach a blank page for
 *    continuation if necessary").
 */
import {
  PDFDocument,
  PDFName,
  PDFDict,
  PDFTextField,
  PDFCheckBox,
  PDFSignature,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import type { FormData } from '@/types';
import { loadAssetBytes } from '@/lib/assets';
import { officialFormAsset } from '@/lib/xfa-form-fill';
import { DD1561_FIELDS, DD1561_FSA_R, DD1561_FSA_T_ROWS } from '@/lib/dd1561-fields';
import {
  DD1561_FORM_FSA_T_ROWS,
  DD1561_NEVER_SET_FIELDS,
  dd1561FieldValues,
  dd1561FsaTContinuationRows,
  dd1561Type,
  type Dd1561FsaTPrintedRow,
} from '@/lib/dd1561-rules';

/** Smallest size the filler will shrink a value to before refusing it. */
export const DD1561_MIN_FONT_SIZE = 5;
/** Title printed on the continuation page. */
export const DD1561_CONTINUATION_TITLE = 'DD FORM 1561 - CONTINUATION OF BLOCK 10 (FSA-T)';

/** SSN shapes: 123-45-6789, 123 45 6789, or nine bare digits not part of a longer number. */
const SSN_LIKE_RE = /(?<!\d)(?:\d{3}[- ]\d{2}[- ]\d{4}|\d{9})(?!\d)/;

/** Block label for each text field, for refusals. */
const BLOCK_LABELS: Record<string, string> = {
  [DD1561_FIELDS.memberName]: 'Block 1 Name',
  [DD1561_FIELDS.grade]: 'Block 2 Grade',
  [DD1561_FIELDS.dodId]: 'Block 3 DoD ID',
  [DD1561_FIELDS.branchOrganization]: 'Block 4 Branch and organization',
  [DD1561_FIELDS.mobilizedDepartureDate]: 'Block 6 Date departed residence',
  [DD1561_FIELDS.dependentAddresses]: 'Block 7 Dependent address(es)',
  [DD1561_FIELDS.spouseDodId]: "Block 8f Spouse's DoD ID",
  [DD1561_FIELDS.spouseBranchComponent]: 'Block 8f Spouse branch and component',
  [DD1561_FIELDS.memberSignedDate]: 'Block 9a Date',
  [DD1561_FIELDS.fsaSCommencingDate]: 'Block 12 Commencing date',
  [DD1561_FIELDS.fsaSShipUnit]: 'Block 12a Ship/unit',
  [DD1561_FIELDS.fsaSHomeport]: 'Block 12b Homeport',
  [DD1561_FIELDS.ordersAuthority]: 'Block 13 Orders',
  [DD1561_FIELDS.ordersDated]: 'Block 13 Dated',
  [DD1561_FIELDS.certifierName]: 'Block 15a Typed name',
  [DD1561_FIELDS.certifierTitle]: 'Block 15b Title',
  [DD1561_FIELDS.certifierOrganization]: 'Block 15c Organization',
  [DD1561_FIELDS.certifiedDate]: 'Block 16 Date',
  [DD1561_FSA_R.lastPermanentDutyStation]: 'Block 11 Last PDS',
  [DD1561_FSA_R.departedDate]: 'Block 11 Departed date',
  [DD1561_FSA_R.leaveDates]: 'Block 11 Leave dates',
  [DD1561_FSA_R.proceedDates]: 'Block 11 Proceed dates',
  [DD1561_FSA_R.reportedTo]: 'Block 11 Reported to',
  [DD1561_FSA_R.reportedDate]: 'Block 11 Reported date',
  ...Object.fromEntries(DD1561_FSA_T_ROWS.flatMap((r, i) => [
    [r.location, `Block 10a row ${i + 1} Location`],
    [r.inclusiveDates, `Block 10b row ${i + 1} Inclusive dates`],
    [r.days, `Block 10c row ${i + 1} No. of days`],
  ])),
};

/**
 * Starting (largest) font size for a text widget, from its height. The form's
 * own design size is 8 pt Times; the 13 pt-tall boxes take 9 pt, the 9.4 pt
 * table and line fields 8 pt, and the shallow block 11 fields (8.2-8.8 pt) 7 pt.
 */
export function dd1561BaseFontSize(widgetHeight: number): number {
  if (widgetHeight >= 12) return 9;
  if (widgetHeight >= 9.4) return 8;
  return 7;
}

/** Rows 4+ of block 10 that go on the continuation page; none unless FSA-T. */
export function dd1561ContinuationRows(formData: FormData): Dd1561FsaTPrintedRow[] {
  return dd1561Type(formData) === 'T' ? dd1561FsaTContinuationRows(formData) : [];
}

interface Problem { block: string; detail: string }

/** Characters the font cannot encode, in order, deduplicated. */
function unprintable(text: string, font: PDFFont): string[] {
  const set = new Set(font.getCharacterSet());
  const bad: string[] = [];
  for (const ch of text) {
    if (ch === '\n') continue;
    const cp = ch.codePointAt(0) ?? 0;
    if (!set.has(cp) && !bad.includes(ch)) bad.push(ch);
  }
  return bad;
}

/** Word-wrap the way pdf-lib's multiline layout does, closely enough to count lines. */
function wrappedLineCount(text: string, font: PDFFont, size: number, width: number): number {
  let count = 0;
  for (const para of text.split('\n')) {
    const words = para.split(' ');
    let line = '';
    count += 1;
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > width) {
        count += 1;
        line = word;
      } else {
        line = next;
      }
    }
  }
  return count;
}

/**
 * Largest size, from `base` down to the minimum in half-point steps, at which
 * the value fits the box: width for one line, wrapped line count times
 * pdf-lib's line height (1.2 x font height) for a multi-line box.
 * null when it does not fit even at the minimum.
 */
export function fitFontSize(
  text: string,
  font: PDFFont,
  box: { width: number; height: number; multiline: boolean },
  base: number,
): number | null {
  for (let size = base; size >= DD1561_MIN_FONT_SIZE; size -= 0.5) {
    if (box.multiline) {
      const lineHeight = font.heightAtSize(size) * 1.2;
      if (wrappedLineCount(text, font, size, box.width) * lineHeight <= box.height + 0.01) return size;
    } else if (text.split('\n').every((l) => font.widthOfTextAtSize(l, size) <= box.width)) {
      return size;
    }
  }
  return null;
}

function refusalMessage(problems: Problem[]): string {
  return `DD 1561 cannot be exported. ${problems.map((p) => `${p.block}: ${p.detail}`).join(' ')}`;
}

function checkPrintable(block: string, text: string, font: PDFFont, problems: Problem[]): boolean {
  const bad = unprintable(text, font);
  if (bad.length > 0) {
    problems.push({
      block,
      detail: `${bad.map((c) => `"${c}"`).join(', ')} ${bad.length > 1 ? 'are not characters' : 'is not a character'} the form can print. Enter the Latin spelling.`,
    });
    return false;
  }
  if (SSN_LIKE_RE.test(text)) {
    problems.push({
      block,
      detail: 'this looks like a Social Security number. The DD 1561 takes the 10-digit DoD ID (EDIPI), never an SSN. Remove it.',
    });
    return false;
  }
  return true;
}

/** Write a check box at the dictionary level so the form's own cross appearance is kept. */
function setCheckBox(box: PDFCheckBox, on: boolean): void {
  const state = PDFName.of(on ? onValueOf(box) : 'Off');
  box.acroField.dict.set(PDFName.of('V'), state);
  for (const widget of box.acroField.getWidgets()) widget.setAppearanceState(state);
}

function onValueOf(box: PDFCheckBox): string {
  const on = box.acroField.getWidgets()[0]?.getOnValue();
  return on ? on.decodeText() : 'Yes';
}

/** Put a font in the AcroForm /DR so the /DA a viewer reads resolves to it. */
function addToDefaultResources(doc: PDFDocument, font: PDFFont): void {
  const acro = doc.getForm().acroForm.dict;
  let dr = acro.lookupMaybe(PDFName.of('DR'), PDFDict);
  if (!dr) {
    dr = doc.context.obj({});
    acro.set(PDFName.of('DR'), dr);
  }
  let fonts = dr.lookupMaybe(PDFName.of('Font'), PDFDict);
  if (!fonts) {
    fonts = doc.context.obj({});
    dr.set(PDFName.of('Font'), fonts);
  }
  fonts.set(PDFName.of(font.name), font.ref);
}

// ---------------------------------------------------------------------------
// Continuation page
// ---------------------------------------------------------------------------

const PAGE_MARGIN = 36;
const ROW_H = 16;
const COLS = [
  { label: 'ROW', x: 36, w: 36, align: 'center' as const },
  { label: 'a. LOCATION', x: 72, w: 276, align: 'left' as const },
  { label: 'b. INCLUSIVE DATES (FROM - TO) (DDMMYY)', x: 348, w: 150, align: 'center' as const },
  { label: 'c. NO. OF DAYS', x: 498, w: 78, align: 'center' as const },
];
const TABLE_RIGHT = 576;

interface ContinuationCell { text: string; size: number }

/**
 * Draw the continuation page(s): title, member name and DoD ID, and a ruled
 * table of rows 4 onward. Static text, not fields. Values were checked and
 * sized before any drawing.
 */
function drawContinuation(
  doc: PDFDocument,
  pageSize: [number, number],
  fonts: { body: PDFFont; bold: PDFFont },
  member: { name: string; dodId: string },
  rows: ContinuationCell[][],
): number {
  const [width, height] = pageSize;
  const black = rgb(0, 0, 0);
  const tableTop = height - 150;
  const perPage = Math.max(1, Math.floor((tableTop - ROW_H - 60) / ROW_H));
  const pages = Math.max(1, Math.ceil(rows.length / perPage));

  for (let p = 0; p < pages; p++) {
    const page: PDFPage = doc.addPage([width, height]);
    const line = (x1: number, y1: number, x2: number, y2: number, thickness = 0.6) =>
      page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color: black });
    const text = (t: string, x: number, y: number, size: number, font = fonts.body) =>
      page.drawText(t, { x, y, size, font, color: black });
    const centered = (t: string, cx: number, y: number, size: number, font = fonts.body) =>
      text(t, cx - font.widthOfTextAtSize(t, size) / 2, y, size, font);

    centered(DD1561_CONTINUATION_TITLE, width / 2, height - 54, 12, fonts.bold);
    centered('STATEMENT TO SUBSTANTIATE PAYMENT OF FAMILY SEPARATION ALLOWANCE (FSA)', width / 2, height - 68, 8);
    centered('PART II, BLOCK 10. TYPE II FSA-T - rows 4 onward. Rows 1-3 are on the form.', width / 2, height - 79, 8);

    // Identification boxes, ruled like the form's block 1 and 3.
    const idTop = height - 92;
    const idBottom = idTop - 26;
    const split = 396;
    line(PAGE_MARGIN, idTop, TABLE_RIGHT, idTop, 0.9);
    line(PAGE_MARGIN, idBottom, TABLE_RIGHT, idBottom, 0.9);
    line(PAGE_MARGIN, idTop, PAGE_MARGIN, idBottom);
    line(split, idTop, split, idBottom);
    line(TABLE_RIGHT, idTop, TABLE_RIGHT, idBottom);
    text('1. NAME OF MEMBER (Last, First, Middle Initial)', PAGE_MARGIN + 3, idTop - 8, 6.5);
    text('3. DoD ID NUMBER', split + 3, idTop - 8, 6.5);
    text(member.name, PAGE_MARGIN + 3, idBottom + 5, 9);
    text(member.dodId, split + 3, idBottom + 5, 9);

    // Table header.
    const headTop = tableTop;
    const headBottom = headTop - ROW_H;
    const pageRows = rows.slice(p * perPage, (p + 1) * perPage);
    const tableBottom = headBottom - pageRows.length * ROW_H;
    line(PAGE_MARGIN, headTop, TABLE_RIGHT, headTop, 0.9);
    line(PAGE_MARGIN, headBottom, TABLE_RIGHT, headBottom, 0.9);
    for (const col of COLS) {
      const lx = col.align === 'left' ? col.x + 3 : col.x + col.w / 2 - fonts.body.widthOfTextAtSize(col.label, 6.5) / 2;
      text(col.label, lx, headBottom + 5.5, 6.5);
      line(col.x, headTop, col.x, tableBottom);
    }
    line(TABLE_RIGHT, headTop, TABLE_RIGHT, tableBottom);

    pageRows.forEach((cells, i) => {
      const bottom = headBottom - (i + 1) * ROW_H;
      line(PAGE_MARGIN, bottom, TABLE_RIGHT, bottom, i === pageRows.length - 1 ? 0.9 : 0.6);
      cells.forEach((cell, c) => {
        const col = COLS[c];
        if (!cell.text) return;
        const w = fonts.body.widthOfTextAtSize(cell.text, cell.size);
        const x = col.align === 'left' ? col.x + 3 : col.x + col.w / 2 - w / 2;
        text(cell.text, x, bottom + (ROW_H - cell.size * 0.68) / 2, cell.size);
      });
    });

    text(
      `DD FORM 1561, DEC 2017 - CONTINUATION PAGE ${p + 1} OF ${pages}`,
      PAGE_MARGIN,
      30,
      7,
      fonts.bold,
    );
    const note = 'Both signature blocks (9b, 15d) are on page 1 of the form.';
    text(note, TABLE_RIGHT - fonts.body.widthOfTextAtSize(note, 7), 30, 7);
  }
  return pages;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export interface Dd1561ExportResult {
  blob: Blob;
  /** Continuation pages appended for block 10 rows 4+ (0 when none). */
  continuationPages: number;
  /** Rows printed on the continuation page(s). */
  continuationRows: number;
}

export async function exportDd1561FormWithReport(formData: FormData): Promise<Dd1561ExportResult> {
  const asset = officialFormAsset('dd1561');
  if (!asset) throw new Error('No official blank registered for DD 1561.');
  const doc = await PDFDocument.load(await loadAssetBytes(asset));
  const form = doc.getForm();
  const body = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  addToDefaultResources(doc, body);
  addToDefaultResources(doc, bold);

  const values = dd1561FieldValues(formData);
  const problems: Problem[] = [];
  const planned: Array<{ field: PDFTextField; text: string; size: number; font: PDFFont; write: boolean }> = [];

  // 1. Plan every text field: its value (if the map has one) and an explicit
  //    size. Fields the map leaves out (15a-c and 16 when not typed) still get
  //    a fixed size, so a viewer typing into them later does not auto-size.
  for (const field of form.getFields()) {
    if (!(field instanceof PDFTextField)) continue;
    const name = field.getName();
    const font = name === DD1561_FIELDS.memberSignedDate ? bold : body;
    const widget = field.acroField.getWidgets()[0];
    const rect = widget.getRectangle();
    const border = widget.getBorderStyle()?.getWidth() ?? 0;
    const pad = border + 1;
    const box = { width: rect.width - pad * 2, height: rect.height - pad * 2, multiline: field.isMultiline() };
    const base = dd1561BaseFontSize(rect.height);
    const raw = values[name];
    const write = typeof raw === 'string';
    let text = write ? raw.replace(/\r\n?/g, '\n') : '';
    const block = BLOCK_LABELS[name] ?? name;
    if (text && !checkPrintable(block, text, font, problems)) continue;
    // A multi-line box starts from 8 pt, the form's design size. Block 7 is
    // two lines tall: three or more one-per-line addresses would print at
    // 5 pt, so when joining them with "; " and wrapping prints larger, join.
    let size = text ? fitFontSize(text, font, box, box.multiline ? 8 : base) : (box.multiline ? 8 : base);
    if (box.multiline && text.includes('\n') && (size === null || size < 7)) {
      const joined = text.split('\n').map((l) => l.trim()).filter(Boolean).join('; ');
      const joinedSize = fitFontSize(joined, font, box, 8);
      if (joinedSize !== null && (size === null || joinedSize > size)) {
        text = joined;
        size = joinedSize;
      }
    }
    if (size === null) {
      problems.push({ block, detail: `"${text.length > 40 ? `${text.slice(0, 40)}...` : text}" does not fit the block even at ${DD1561_MIN_FONT_SIZE} pt. Shorten it.` });
      continue;
    }
    planned.push({ field, text, size, font, write });
  }

  // 2. Continuation rows: same checks, sized to their cells.
  const contRows = dd1561ContinuationRows(formData);
  const contCells: ContinuationCell[][] = [];
  contRows.forEach((r, i) => {
    const rowNo = DD1561_FORM_FSA_T_ROWS + i + 1;
    const texts = [String(rowNo), r.location, r.inclusiveDates, r.days === null ? '' : String(r.days)];
    const cells: ContinuationCell[] = [];
    texts.forEach((t, c) => {
      const block = `Block 10 continuation row ${rowNo} ${['', 'Location', 'Inclusive dates', 'No. of days'][c]}`.trim();
      if (t && !checkPrintable(block, t, body, problems)) return;
      const size = t ? fitFontSize(t, body, { width: COLS[c].w - 6, height: ROW_H - 4, multiline: false }, 9) : 9;
      if (size === null) problems.push({ block, detail: `"${t.slice(0, 40)}..." does not fit even at ${DD1561_MIN_FONT_SIZE} pt. Shorten it.` });
      cells.push({ text: t, size: size ?? 9 });
    });
    contCells.push(cells);
  });

  if (problems.length > 0) throw new Error(refusalMessage(problems));

  // 3. Text fields: fixed /DA, value, appearance drawn with the embedded font.
  for (const p of planned) {
    const da = `/${p.font.name} ${p.size} Tf 0 g`;
    p.field.acroField.setDefaultAppearance(da);
    for (const w of p.field.acroField.getWidgets()) {
      if (w.dict !== p.field.acroField.dict && w.dict.has(PDFName.of('DA'))) w.setDefaultAppearance(da);
    }
    if (p.write) {
      p.field.setText(p.text || undefined);
      p.field.updateAppearances(p.font);
    }
  }

  // 4. Check boxes, at the dictionary level. Signatures are never touched.
  for (const [name, value] of Object.entries(values)) {
    if (typeof value !== 'boolean') continue;
    if (DD1561_NEVER_SET_FIELDS.includes(name)) continue;
    const field = form.getFieldMaybe(name);
    if (field instanceof PDFCheckBox) setCheckBox(field, value);
    else if (!(field instanceof PDFSignature)) throw new Error(`DD 1561 fill failed. ${name}: not a check box on the blank.`);
  }

  // 5. Continuation page(s) for block 10 rows 4+.
  let continuationPages = 0;
  if (contCells.length > 0) {
    const first = doc.getPage(0).getSize();
    const member = {
      name: String(values[DD1561_FIELDS.memberName] ?? ''),
      dodId: String(values[DD1561_FIELDS.dodId] ?? ''),
    };
    continuationPages = drawContinuation(doc, [first.width, first.height], { body, bold }, member, contCells);
  }

  // Appearances were drawn above; a second pass at save would redraw the
  // check boxes with pdf-lib's own glyph and auto-size the untouched fields.
  const bytes = await doc.save({ useObjectStreams: false, updateFieldAppearances: false });
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
    continuationPages,
    continuationRows: contCells.length,
  };
}

/** The filled, unflattened DD 1561 (plus any block 10 continuation page). */
export async function exportDd1561Form(formData: FormData): Promise<Blob> {
  return (await exportDd1561FormWithReport(formData)).blob;
}
