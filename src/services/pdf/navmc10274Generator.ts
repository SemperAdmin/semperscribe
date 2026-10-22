/**
 * NAVMC 10274 preview: a pdf-lib redraw of the official form's three
 * pages, every box drawn at the form's own position, width, face size
 * and line pitch, read from src/lib/navmc10274-layout.ts. The official
 * export fills the government's XFA blank from the same module, so what
 * this shows is what Acrobat lays out (owner's handoff of 2026-10-21).
 *
 * Nothing is clipped in silence. A box whose text does not fit shows the
 * lines that fit and a red count of the lines that did not; text past
 * block 13 shows the same mark, and the export gate refuses it
 * (src/lib/navmc10274-fit.ts). A character the standard Times-Roman
 * cannot encode draws as "?" instead of throwing.
 */
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import type { Navmc10274Data } from '@/types/navmc';
import type { ParagraphData } from '@/types';
import { loadAssetBytes } from '@/lib/assets';
import {
  NAVMC10274_FIELDS,
  aaFirstBaselineOffset,
  aaLineCapacity,
  aaTextBox,
  flowAaBody,
  sanitizeForTimesRoman,
  wrapAaValue,
  type AaField,
  type AaRect,
} from '@/lib/navmc10274-layout';
import type { FlowLine } from '@/lib/page11-flow';

/** Data key for each small box, in the form's own order. */
const SMALL_BOXES: Array<[keyof Navmc10274Data, AaField]> = [
  ['actionNo', NAVMC10274_FIELDS.ActNum],
  ['ssic', NAVMC10274_FIELDS.FileNum],
  ['date', NAVMC10274_FIELDS.Date],
  ['from', NAVMC10274_FIELDS.NameFrom],
  ['orgStation', NAVMC10274_FIELDS.OrgStat],
  ['via', NAVMC10274_FIELDS.Via1],
  ['to', NAVMC10274_FIELDS.AddrTo],
  ['subject', NAVMC10274_FIELDS.NatOfAct],
  ['copyTo', NAVMC10274_FIELDS.CopyTo],
  ['reference', NAVMC10274_FIELDS.RefAuth],
  ['enclosure', NAVMC10274_FIELDS.Encl1],
];

const INK = rgb(0, 0, 0);
const MARK = rgb(0.8, 0, 0);
const MARK_SIZE = 6;

async function loadTemplates() {
  const [page1Bytes, page2Bytes, page3Bytes] = await Promise.all([
    loadAssetBytes('templates/navmc10274/page1.pdf'),
    loadAssetBytes('templates/navmc10274/page2.pdf'),
    loadAssetBytes('templates/navmc10274/page3.pdf'),
  ]);
  return { page1Bytes, page2Bytes, page3Bytes };
}

async function addTemplatePage(doc: PDFDocument, bytes: Uint8Array): Promise<PDFPage> {
  const [embedded] = await doc.embedPdf(bytes, [0]);
  const page = doc.addPage([embedded.width, embedded.height]);
  page.drawPage(embedded);
  return page;
}

/**
 * Draws `lines` into a field's text box at its pitch, the first baseline
 * an ascent below the top edge, and marks the count of lines past the
 * box. Returns the characters replaced for WinAnsi.
 */
function drawLines(page: PDFPage, field: AaField, lines: readonly string[], font: PDFFont): string[] {
  const box = aaTextBox(field);
  const capacity = aaLineCapacity(field);
  const replaced: string[] = [];
  const shown = lines.slice(0, capacity);
  const baseline0 = box.top - aaFirstBaselineOffset(field);
  shown.forEach((raw, i) => {
    const { text, replaced: r } = sanitizeForTimesRoman(raw);
    replaced.push(...r);
    if (!text) return;
    const width = font.widthOfTextAtSize(text, field.fontSize);
    const x = field.hAlign === 'center' ? box.left + (box.width - width) / 2 : box.left;
    page.drawText(text, { x, y: baseline0 - i * field.lineHeight, size: field.fontSize, font, color: INK });
  });
  if (lines.length > capacity) {
    drawOverflowMark(page, box, `${lines.length - capacity} line${lines.length - capacity === 1 ? '' : 's'} past block ${field.block}`, font);
  }
  return replaced;
}

/** Red count in the box's bottom-right corner, where the clipped text would have run. */
function drawOverflowMark(page: PDFPage, box: AaRect, text: string, font: PDFFont) {
  const width = font.widthOfTextAtSize(text, MARK_SIZE);
  page.drawText(text, {
    x: box.left + box.width - width - 1,
    y: box.top - box.height + 1.5,
    size: MARK_SIZE,
    font,
    color: MARK,
  });
}

/** A legacy caller with no paragraph list gets one paragraph per line, numbered as the form numbers them. */
function paragraphsFor(data: Navmc10274Data): ParagraphData[] {
  if (data.supplementalInfoParagraphs) return data.supplementalInfoParagraphs;
  return (data.supplementalInfo || '')
    .split('\n')
    .filter(line => line.trim())
    .map((content, i) => ({ id: i + 1, level: 1, content }) as ParagraphData);
}

const texts = (lines: readonly FlowLine[]) => lines.map(l => l.text);

export async function generateNavmc10274(data: Navmc10274Data): Promise<Uint8Array> {
  const templates = await loadTemplates();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);

  // The official form is three pages: instructions, the form, and block
  // 13's reverse. All three always, as the government file has them.
  await addTemplatePage(doc, templates.page1Bytes);
  const page2 = await addTemplatePage(doc, templates.page2Bytes);
  const page3 = await addTemplatePage(doc, templates.page3Bytes);

  for (const [key, field] of SMALL_BOXES) {
    const value = data[key];
    if (typeof value !== 'string' || !value.trim()) continue;
    drawLines(page2, field, wrapAaValue(value, field), font);
  }

  // Block 12 then block 13, the typed name three blank lines under the
  // text at the box's centre line, by the one flow the export uses. The
  // flow's capacity is the form's, so block 12 never overflows here; a
  // tail past block 13 draws the mark and the export gate refuses it.
  const flow = flowAaBody(paragraphsFor(data), data.signature || '');
  drawLines(page2, NAVMC10274_FIELDS.SuppInfo, texts(flow.block12), font);
  if (flow.block13.length > 0) {
    drawLines(page3, NAVMC10274_FIELDS.ProcAct, texts(flow.block13), font);
  }

  return doc.save();
}
