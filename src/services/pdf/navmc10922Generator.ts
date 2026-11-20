/**
 * NAVMC 10922 fillable rebuild.
 *
 * History: build plan Phase 5 introduced this as a flattened,
 * layout-faithful redraw (Stephen, 2026-07-20). Owner decision
 * 2026-11-20 (docs/NAVMC_10922_SPEC.md section 11, decision 11): the
 * redraw becomes the ONLY 10922 export and preview, as a standard
 * AcroForm PDF, so it renders in the in-app preview and stays editable
 * in any viewer (Adobe, Edge, Chrome) the way the UPB and COLA do. The
 * official blank is dynamic XFA, which browsers cannot render, so its
 * export route is retired. This is a faithful REBUILD, not the
 * official form file.
 *
 * Layout comes from src/services/pdf/navmc10922-layout.json, which
 * tools/aa-forms/extract_10922_layout.py generates from the official
 * blank's OWN template.xml: every label, cell rectangle, radio option
 * box, unbindable checkbox, and master-page overlay (including the
 * form's CUI artwork) at its exact millimetre position. Values come
 * from navmc10922Values() - the same 102 positional selectors the XFA
 * emitter uses.
 *
 * Static artwork (labels, rules, captions, empty option squares, CUI
 * markings) is drawn into the page content. Every value cell is a live
 * AcroForm field at the cell's rectangle, prefilled from the document:
 * text fields, radio groups on the option squares, the five
 * unbindable checkboxes (START follows the reason; the other four stay
 * unchecked), and the three signature blocks as empty signature
 * fields. Appearance streams are generated so every viewer shows the
 * values without regenerating them. Nothing is flattened.
 *
 * Section 8 (approving authority, unit diary, CMC) is created EMPTY
 * and editable. The app never fills it (spec section 5 design
 * position): NAVMC10922_SECTION8_FIELDS lists those fields and the
 * test suite pins them empty.
 *
 * The redraw includes the form's own CUI markings because they are form
 * artwork - the app adds no markings of its own.
 */

import {
  PDFDocument, PDFFont, PDFForm, PDFName, PDFString, PDFPage, PDFOperator, PDFCheckBox, PDFRadioGroup, PDFWidgetAnnotation,
  StandardFonts, TextAlignment, LineCapStyle, degrees, rgb,
  pushGraphicsState, popGraphicsState, setLineWidth, setLineCap, setStrokingRgbColor,
  moveTo, lineTo, stroke,
} from 'pdf-lib';
import { FormData } from '@/types';
import { navmc10922Values } from '@/lib/navmc10922-xfa';
import { loadAssetBytes } from '@/lib/assets';
import { NAVMC10922_SWORN_MONTHS } from '@/lib/navmc10922-utils';
import { addSignatureFieldToDocument } from '@/lib/pdf-signature-field';
import layout from './navmc10922-layout.json';

const MM_TO_PT = 72 / 25.4;
const PAGE_H = 792;

const LABEL_SIZE = 5.4;
const TITLE_SIZE = 11;
const VALUE_SIZE = 8;
const CAPTION_SIZE = 4.6;
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

/**
 * Loads the background pages (an Adobe print of the official form,
 * supplied 2026-07-20 - exact lines, labels, and fonts by
 * construction). Null when unavailable: the programmatic redraw then
 * carries the full artwork itself.
 */
async function loadBackgroundPages(): Promise<Uint8Array[] | null> {
  try {
    return await Promise.all([1, 2, 3].map((n) => loadAssetBytes(`templates/navmc10922/page${n}.pdf`)));
  } catch {
    return null;
  }
}

/** Side of a printed option square, in points (the template's 2.8mm). */
const SQUARE = toPt(2.8);

/**
 * Where an option square sits, in pdf-lib points. Caption-less squares
 * (START, the dissolution grid) center in their box; captioned ones sit
 * at the left inset with the caption to the right (XFA caption
 * placement="right"). On the Adobe-print background a calibrated
 * square center (cx/cy in pt, top-left origin - measured off the print
 * at extraction time) wins, so the widget lands on the printed square.
 */
function squareRect(box: Box & { cx?: number; cy?: number }, centerH: boolean, onBackground: boolean) {
  if (onBackground && box.cx !== undefined && box.cy !== undefined) {
    return { x: box.cx - SQUARE / 2, y: PAGE_H - box.cy - SQUARE / 2, w: SQUARE, h: SQUARE };
  }
  const r = rect(box);
  const px = centerH ? r.x + (r.w - SQUARE) / 2 : r.x + 1.5;
  const py = r.y + (r.h - SQUARE) / 2;
  return { x: px, y: py, w: SQUARE, h: SQUARE };
}

/** Empty option square - static artwork; the X is the field's own appearance. */
function drawSquare(page: PDFPage, sq: { x: number; y: number; w: number; h: number }) {
  page.drawRectangle({ x: sq.x, y: sq.y, width: sq.w, height: sq.h, borderColor: INK, borderWidth: 0.7 });
}

/** The value area of a cell: the cell less its caption reserve, on the caption's side. */
function valueBox(cell: CellDef): Box {
  if (!cell.caption) return cell;
  const reserve = cell.capReserve ?? 2.6;
  switch (cell.capPlace) {
    case 'top': return { ...cell, y: cell.y + reserve, h: cell.h - reserve };
    case 'bottom': return { ...cell, h: cell.h - reserve };
    case 'right': return { ...cell, w: cell.w - reserve };
    // XFA's default caption placement is left (the unit diary No. /
    // DATED / RUC cells carry a reserve and no placement).
    default: return { ...cell, x: cell.x + reserve, w: cell.w - reserve };
  }
}

/** The caption area of a cell, the complement of valueBox. */
function captionBox(cell: CellDef): Box {
  const reserve = cell.capReserve ?? 2.6;
  switch (cell.capPlace) {
    case 'top': return { ...cell, h: reserve };
    case 'bottom': return { ...cell, y: cell.y + cell.h - reserve, h: reserve };
    case 'right': return { ...cell, x: cell.x + cell.w - reserve, w: reserve };
    default: return { ...cell, w: reserve };
  }
}

// ---------------------------------------------------------------------------
// Field names. Readable and unique; the XFA map index is the key.
// ---------------------------------------------------------------------------

const DEP_KEYS = ['name', 'address', 'relationship', 'dob', 'allowanceClaimedFrom'];
const DISS_KEYS = ['formerMarriageOf', 'reason', 'spouseName', 'place', 'date'];

const NAMED: Record<number, string> = {
  0: 's1.dateOfApplication', 1: 's1.reason', 2: 's1.edipi', 3: 's1.organizationStation',
  4: 's1.futureAddressEta', 5: 's1.grade', 6: 's1.unitRuc', 7: 's1.ecc',
  8: 's1.dateEnlistmentOrAd', 9: 's1.dateLastDischarge', 10: 's1.typeOfService',
  41: 's3.custodian.depNo', 42: 's3.custodian.name', 43: 's3.custodian.address', 44: 's3.custodian.relationship',
  45: 's4.spousePrevMarried', 46: 's4.spousePrevMarriedTimes', 47: 's4.memberPrevMarried',
  48: 's4.memberPrevMarriedTimes', 49: 's4.marriageSpouseName', 50: 's4.marriagePlace', 51: 's4.marriageDate',
  72: 's4.courtOrderInEffect', 73: 's4.courtOrderDatePlace',
  74: 's5.naturalParentInfo', 75: 's5.naturalParentArmedForces',
  76: 's6.spouseArmedForces', 77: 's6.spouseEdipi', 78: 's6.spouseGrade', 79: 's6.spouseTypeOfService',
  80: 's6.spouseBranch', 81: 's6.spouseBaq', 82: 's6.spouseServiceDates',
  83: 's7.swornMonth', 84: 's7.swornYear', 85: 's7.swornDay',
  86: 's8.approvedDependentNumbers', 87: 's8.forwardedDependentNumbers',
  88: 's8.unitDiary.number', 89: 's8.unitDiary.dated', 90: 's8.unitDiary.ruc',
  91: 's8.unitDiary.remarks', 92: 's8.cmc.remarks',
  93: 's7.documentsViewed', 94: 's1.nameOfMarine', 95: 's7.marineSignature',
  96: 's7.edipi', 97: 's7.grade', 98: 's7.attestingOfficerSignature',
  99: 's8.unitDesignation', 100: 's8.coTypedNameGrade', 101: 's8.coSignature',
};

/** The AcroForm field name for an XFA map index. */
export function navmc10922FieldName(index: number): string {
  if (index >= 11 && index <= 40) {
    const n = index - 11;
    return `s2.dep${Math.floor(n / 5) + 1}.${DEP_KEYS[n % 5]}`;
  }
  if (index >= 52 && index <= 71) {
    const n = index - 52;
    return `s4.diss${Math.floor(n / 5) + 1}.${DISS_KEYS[n % 5]}`;
  }
  const name = NAMED[index];
  if (!name) throw new Error(`NAVMC 10922: no field name for index ${index}`);
  return name;
}

/** The five unbindable checkboxes, keyed by their template caption. */
const CHECKBOX_NAMES: Record<string, string> = {
  '': 's1.start',
  'Document Viewed': 's7.documentViewed',
  'APPROVED AS CLAIMED': 's8.approvedAsClaimed',
  'APPROVED FOR DEPENDENT NUMBERS:': 's8.approvedForDependentNumbers',
  'FORWARDED TO CMC (CODE MFP-1) FOR APPROVAL FOR DEPENDENT NUMBERS:': 's8.forwardedToCmc',
};

/** Section 7: the attesting officer's typed name, grade and title. */
export const ATTESTING_OFFICER_FIELD = 's7.attestingOfficerTypedNameGradeTitle';

/** XFA indices the app never fills: Section 8 approving authority,
 *  unit diary and CMC block (spec section 5 design position). */
const SECTION8_INDICES = new Set([86, 87, 88, 89, 90, 91, 92, 99, 100, 101]);

/** Every Section 8 field. Created empty and editable; never prefilled. */
export const NAVMC10922_SECTION8_FIELDS: readonly string[] = [
  ...[...SECTION8_INDICES].map(navmc10922FieldName),
  's8.approvedAsClaimed', 's8.approvedForDependentNumbers', 's8.forwardedToCmc',
];

const MONTHS: string[] = [...NAVMC10922_SWORN_MONTHS];

/** "SSGT STEWART, THOMAS J / ADMIN CHIEF" - empty when all three are blank. */
export function attestingOfficerLine(formData: FormData): string {
  const name = String(formData.attestingOfficerName ?? '').trim();
  const grade = String(formData.attestingOfficerGrade ?? '').trim();
  const title = String(formData.attestingOfficerTitle ?? '').trim();
  const who = [grade, name].filter(Boolean).join(' ');
  return [who, title].filter(Boolean).join(' / ');
}

/** X mark appearance for checkbox and radio widgets - the form's own
 *  mark, not pdf-lib's tick (checkbox) or dot (radio). */
function xMark(width: number, height: number): PDFOperator[] {
  const side = Math.min(width, height);
  const inset = side * 0.22;
  const x0 = (width - side) / 2 + inset;
  const y0 = (height - side) / 2 + inset;
  const x1 = (width + side) / 2 - inset;
  const y1 = (height + side) / 2 - inset;
  return [
    pushGraphicsState(),
    setStrokingRgbColor(0, 0, 0),
    setLineWidth(0.9),
    setLineCap(LineCapStyle.Round),
    moveTo(x0, y0), lineTo(x1, y1), stroke(),
    moveTo(x0, y1), lineTo(x1, y0), stroke(),
    popGraphicsState(),
  ];
}

function xMarkAppearance(_field: unknown, widget: PDFWidgetAnnotation) {
  const { width, height } = widget.getRectangle();
  const on = xMark(width, height);
  const off: PDFOperator[] = [];
  return { normal: { on, off }, down: { on, off } };
}

/** Transparent, borderless widget: the drawn artwork stays the look. */
const NO_CHROME = { borderWidth: 0, borderColor: undefined, backgroundColor: undefined } as const;

type FieldRect = { x: number; y: number; w: number; h: number };

function addTextField(
  form: PDFForm, page: PDFPage, name: string, r: FieldRect, value: string, font: PDFFont,
  opts: { multiline?: boolean; ha?: HAlign; size?: number } = {},
) {
  const existing = form.getFieldMaybe(name);
  const field = existing ? form.getTextField(name) : form.createTextField(name);
  // addToPage first: it writes the /DA the font size is set into.
  field.addToPage(page, { x: r.x, y: r.y, width: r.w, height: r.h, font, textColor: INK, ...NO_CHROME });
  if (existing) return; // a second widget of the same field (name of Marine, page 2)
  const fit = fitText(value, font, r, opts.size ?? VALUE_SIZE, Boolean(opts.multiline));
  if (fit.multiline) field.enableMultiline();
  field.disableRichFormatting();
  field.setFontSize(fit.size);
  if (opts.ha === 'center') field.setAlignment(TextAlignment.Center);
  else if (opts.ha === 'right') field.setAlignment(TextAlignment.Right);
  const text = fit.multiline ? value : value.replace(/\s*\n\s*/g, ' ');
  if (text) field.setText(text);
}

/**
 * The size (and line mode) a prefilled value takes in its cell, the
 * way the flattened redraw used to wrap it: a one-line cell shrinks the
 * value a little, then wraps it onto two lines rather than clip it at
 * the cell edge; a multi-line cell shrinks until its lines fit.
 */
function fitText(value: string, font: PDFFont, r: FieldRect, base: number, multiline: boolean) {
  const avail = r.w - 4; // pdf-lib's text inset, both sides
  const lineH = (size: number) => size * 1.2;
  const linesFit = (size: number) => wrap(value, font, size, avail).length * lineH(size) <= r.h - 2;
  if (!value) return { size: base, multiline };
  if (!multiline) {
    let size = base;
    const oneLine = value.replace(/\s*\n\s*/g, ' ');
    while (size > 6.5 && font.widthOfTextAtSize(oneLine, size) > avail) size -= 0.25;
    if (font.widthOfTextAtSize(oneLine, size) <= avail) return { size, multiline: false };
    multiline = true;
  }
  let size = base;
  while (size > 4.5 && !linesFit(size)) size -= 0.25;
  return { size, multiline };
}

/** Renders the NAVMC 10922 fillable rebuild from the document state.
 *  `backgrounds` overrides the asset load (tests, node harnesses);
 *  null forces the programmatic redraw of the artwork. */
export async function generateNavmc10922(
  formData: FormData,
  backgrounds?: ArrayBuffer[] | Uint8Array[] | null
): Promise<Uint8Array> {
  const values = navmc10922Values(formData);
  const doc = await PDFDocument.create();
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const form = doc.getForm();

  const pages = layout.pages as unknown as PageDef[];
  const bg = backgrounds === undefined ? await loadBackgroundPages() : backgrounds;
  const bgPages = bg
    ? await Promise.all(bg.map(async (bytes) => {
        const src = await PDFDocument.load(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
        return doc.embedPage(src.getPage(0));
      }))
    : null;
  const onBackground = Boolean(bgPages);

  const xWidgets: Array<PDFCheckBox | PDFRadioGroup> = [];
  const signatures: Array<{ page: PDFPage; name: string; r: FieldRect }> = [];

  pages.forEach((pageDef, pageIndex) => {
    const page = doc.addPage([layout.pageSize.wPt, layout.pageSize.hPt]);

    if (bgPages) {
      // Background mode: the printed official form IS the artwork.
      page.drawPage(bgPages[pageIndex], { x: 0, y: 0 });
    } else {
      drawArtwork(page, pageDef, pageIndex, { helv, helvBold });
    }

    // --- Fields: one per value cell, at the cell's own rectangle. ---
    for (const cell of pageDef.cells) {
      if (cell.index === null) continue;
      const name = navmc10922FieldName(cell.index);
      const value = SECTION8_INDICES.has(cell.index) ? '' : values[cell.index];

      if (cell.kind === 'radio') {
        // Get-or-create, like addTextField: a group whose index appears on
        // two pages gains widgets instead of throwing on a duplicate name.
        const existing = form.getFieldMaybe(name);
        const group = existing ? form.getRadioGroup(name) : form.createRadioGroup(name);
        if (!existing) group.enableOffToggling();
        for (const opt of cell.options ?? []) {
          if (opt.value === null) continue;
          const sq = squareRect({ ...opt, x: cell.x + opt.x, y: cell.y + opt.y }, !opt.caption, onBackground);
          group.addOptionToPage(opt.value, page, { x: sq.x, y: sq.y, width: sq.w, height: sq.h, ...NO_CHROME });
        }
        if (value && group.getOptions().includes(value)) group.select(value);
        if (!existing) xWidgets.push(group);
        continue;
      }

      const r = rect(valueBox(cell));
      if (cell.kind === 'signature') {
        signatures.push({ page, name, r });
        if (cell.index === 98) {
          // Section 7: the attesting officer's typed name, grade and
          // title. The cell is the signature area over its caption, with
          // the next row's rule 2mm under the caption, so the line goes
          // in that strip: inside the cell, under the caption, clear of
          // the signature area. Small type is the price of the room.
          const line = attestingOfficerLine(formData);
          const stripH = toPt(1.75);
          const cellR = rect(cell);
          const strip = { x: cellR.x, y: cellR.y + 0.15, w: cellR.w, h: stripH };
          let size = 5;
          while (line && size > 3.5 && times.widthOfTextAtSize(line, size) > strip.w - 4) size -= 0.25;
          addTextField(form, page, ATTESTING_OFFICER_FIELD, strip, line, times, { ha: 'center', size });
        }
        continue;
      }

      if (cell.kind === 'choiceList') {
        const dd = form.createDropdown(name);
        dd.setOptions(MONTHS);
        dd.enableEditing();
        if (value) {
          if (!MONTHS.includes(value)) dd.addOptions(value);
          dd.select(value);
        }
        dd.addToPage(page, { x: r.x, y: r.y, width: r.w, height: r.h, font: times, textColor: INK, ...NO_CHROME });
        dd.setFontSize(VALUE_SIZE);
        continue;
      }

      // Text and date cells. Multi-line where the cell holds three lines
      // (or the XFA field is multiLine, as 93 is), single otherwise.
      const multiline = cell.kind === 'textEdit' && (r.h >= VALUE_SIZE * 1.12 * 3 || cell.index === 93);
      addTextField(form, page, name, r, value, times, { multiline, ha: cell.ha });
    }

    // Unbindable checkboxes. START follows the reason; the approving
    // authority boxes and Document Viewed belong to the command and
    // stay unchecked - but clickable.
    for (const cb of pageDef.checkboxes) {
      const isStart = !cb.caption;
      const name = CHECKBOX_NAMES[cb.caption];
      if (!name) throw new Error(`NAVMC 10922: unknown checkbox "${cb.caption}"`);
      const sq = squareRect(cb, isStart, onBackground);
      if (!bgPages) drawSquare(page, sq);
      const box = form.createCheckBox(name);
      box.addToPage(page, { x: sq.x, y: sq.y, width: sq.w, height: sq.h, ...NO_CHROME });
      if (isStart && formData.reason === 'start') box.check();
      xWidgets.push(box);
    }

    // Option squares are artwork in redraw mode (the background prints its own).
    if (!bgPages) {
      for (const cell of pageDef.cells) {
        if (cell.kind !== 'radio') continue;
        for (const opt of cell.options ?? []) {
          drawSquare(page, squareRect({ ...opt, x: cell.x + opt.x, y: cell.y + opt.y }, !opt.caption, false));
        }
      }
    }
  });

  // Appearance streams for every text and choice field, in the value
  // font, then the form's X mark on every check and radio widget.
  form.updateFieldAppearances(times);
  for (const w of xWidgets) {
    if (w instanceof PDFCheckBox) w.updateAppearances(xMarkAppearance);
    else w.updateAppearances(xMarkAppearance);
  }

  // The three signature blocks: empty signature fields, no drawn cue.
  for (const { page, name, r } of signatures) {
    await addSignatureFieldToDocument(doc, page, { x: r.x, y: r.y, width: r.w, height: r.h }, name, { cue: false });
  }
  // Nothing is signed yet; the helper's SigFlags would claim otherwise.
  form.acroForm.dict.delete(PDFName.of('SigFlags'));
  // Default resources: the font every /DA names, so a viewer that
  // redraws a field after an edit (Acrobat, Chrome, Edge) keeps Times.
  form.acroForm.dict.set(PDFName.of('DR'), doc.context.obj({ Font: { [times.name]: times.ref } }));
  form.acroForm.dict.set(PDFName.of('DA'), PDFString.of(`/${times.name} ${VALUE_SIZE} Tf 0 g`));

  return doc.save({ updateFieldAppearances: false });
}

/** Static artwork for the programmatic redraw: master overlays, labels,
 *  cell rules and captions. Values are fields, never drawn here. */
function drawArtwork(
  page: PDFPage, pageDef: PageDef, pageIndex: number,
  { helv, helvBold }: { helv: PDFFont; helvBold: PDFFont },
) {
  const master = layout.master as unknown as LabelDef[];
  const total = (layout.pages as unknown as PageDef[]).length;

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

  // Field cells: the template's own edge rules and in-cell caption.
  // Radio option captions; the squares are drawn with the fields.
  for (const cell of pageDef.cells) {
    drawEdges(page, cell, cell.edges);
    if (cell.kind === 'radio') {
      for (const opt of cell.options ?? []) {
        if (!opt.caption) continue;
        const obox = { x: cell.x + opt.x, y: cell.y + opt.y, w: opt.w, h: opt.h };
        drawTextBox(page, { x: obox.x + 3.6, y: obox.y, w: obox.w - 3.6, h: obox.h }, opt.caption, helv, CAPTION_SIZE, { va: 'middle' });
      }
      continue;
    }
    if (cell.caption) {
      // The template's own caption reserve and placement govern the
      // caption/value split (valueBox / captionBox).
      const place = cell.capPlace;
      drawTextBox(page, captionBox(cell), cell.caption, helv, CAPTION_SIZE, {
        ha: cell.capHa ?? (place === 'right' ? 'right' : undefined),
        va: place === 'top' ? 'top' : 'middle',
      });
    }
  }

  // Unbindable checkbox rules and captions; the squares are drawn with the fields.
  for (const cb of pageDef.checkboxes) {
    drawEdges(page, cb, cb.edges);
    if (cb.caption) {
      drawTextBox(page, { x: cb.x + 3.6, y: cb.y, w: cb.w - 3.6, h: cb.h }, cb.caption, helv, CAPTION_SIZE, { va: 'middle' });
    }
  }
}
