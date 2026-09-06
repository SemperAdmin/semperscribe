/**
 * DD Form 368, Request for Conditional Release: the app's render.
 *
 * The form's two faces are drawn from the form's own artwork
 * (public/forms/dd368-front.png and dd368-back.png, the AUG 2011
 * edition updated 20241126, rasterised at 180 dpi) with the values
 * placed by item at the coordinates of the printed labels. The supplied
 * edition carries no fillable fields, so this is the preview and the
 * export until the fillable blank is available; then the official-form
 * export fills it by field name and this stays the preview and the
 * fallback, the NAVMC 10922 arrangement.
 *
 * Coordinates are PDF points, origin bottom-left, on the 612 by 792
 * page, measured from the label positions in the form's text layer.
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { FormData } from '@/types';
import { loadAssetBytes } from '@/lib/assets';
import { dd368Field, dd368MemberCategory } from '@/lib/dd368';

const INK = rgb(0, 0, 0);
const VALUE_SIZE = 8.5;
const SMALL_SIZE = 7.5;

interface Slot { page: 1 | 2; x: number; y: number; w: number; size?: number; lines?: number }

/** Where each item's value prints. Widths bound wrapping. */
const SLOTS: Record<string, Slot> = {
  // Section I, item 1
  dd368MemberName: { page: 1, x: 22.5, y: 682, w: 210 },
  dd368PayGrade: { page: 1, x: 238.5, y: 682, w: 66 },
  dd368Edipi: { page: 1, x: 310.5, y: 682, w: 138 },
  dd368ServiceComponent: { page: 1, x: 454.5, y: 682, w: 130 },
  dd368CurrentUnit: { page: 1, x: 22.5, y: 645.5, w: 102, size: SMALL_SIZE, lines: 2 },
  dd368MemberStreet: { page: 1, x: 130.5, y: 641, w: 174 },
  dd368MemberCity: { page: 1, x: 310.5, y: 641, w: 138 },
  dd368MemberState: { page: 1, x: 454.5, y: 641, w: 56 },
  dd368MemberZip: { page: 1, x: 516, y: 641, w: 70 },
  // item 2
  dd368RecruiterStreet: { page: 1, x: 22.5, y: 605, w: 282 },
  dd368RecruiterCity: { page: 1, x: 310.5, y: 605, w: 138 },
  dd368RecruiterState: { page: 1, x: 454.5, y: 605, w: 56 },
  dd368RecruiterZip: { page: 1, x: 516, y: 605, w: 70 },
  // item 3.b blanks and 3.e
  dd368CurrentComponent: { page: 1, x: 272, y: 549.5, w: 110 },
  dd368GainingComponent3b: { page: 1, x: 224, y: 535, w: 104 },
  dd368MemberSignedDate: { page: 1, x: 516, y: 464, w: 70 },
  // item 4
  dd368GainingComponent4a: { page: 1, x: 252, y: 428.5, w: 130 },
  dd368RecruiterName: { page: 1, x: 22.5, y: 401, w: 280 },
  dd368RecruiterSignedDate: { page: 1, x: 516, y: 401, w: 70 },
  dd368RecruiterTitle: { page: 1, x: 22.5, y: 378, w: 280 },
  // Section II
  dd368ReleaseValidUntil: { page: 1, x: 414, y: 336.5, w: 168 },
  dd368OfficialName: { page: 1, x: 22.5, y: 272, w: 280 },
  dd368OfficialTitle: { page: 1, x: 310.5, y: 272, w: 276 },
  dd368OfficialPhone: { page: 1, x: 22.5, y: 240.5, w: 102, size: SMALL_SIZE },
  dd368OfficialStreet: { page: 1, x: 130.5, y: 236, w: 174 },
  dd368OfficialCity: { page: 1, x: 310.5, y: 236, w: 138 },
  dd368OfficialState: { page: 1, x: 454.5, y: 236, w: 56 },
  dd368OfficialZip: { page: 1, x: 516, y: 236, w: 70 },
  dd368OfficialSignedDate: { page: 1, x: 516, y: 212, w: 70 },
  // Section III
  dd368OathService: { page: 1, x: 298, y: 175, w: 256 },
  dd368CertifyingName: { page: 1, x: 22.5, y: 111, w: 210 },
  dd368CertifyingTitle: { page: 1, x: 238.5, y: 111, w: 210 },
  dd368CertifyingUnit: { page: 1, x: 454.5, y: 111, w: 132 },
  dd368CertifyingPhone: { page: 1, x: 22.5, y: 79.5, w: 102, size: SMALL_SIZE },
  dd368CertifyingStreet: { page: 1, x: 130.5, y: 75, w: 174 },
  dd368CertifyingCity: { page: 1, x: 310.5, y: 75, w: 138 },
  dd368CertifyingState: { page: 1, x: 454.5, y: 75, w: 56 },
  dd368CertifyingZip: { page: 1, x: 516, y: 75, w: 70 },
  dd368CertifyingSignedDate: { page: 1, x: 516, y: 52, w: 70 },
  // Section IV, the reverse. Bounded above by the heading and below by
  // the Privacy Act statement at 488 pt.
  dd368Remarks: { page: 2, x: 22.5, y: 744, w: 568, lines: 22 },
};

/** Item 5 boxes, marked with an X. */
const DECISION_MARKS = { approved: { x: 24.3, y: 335.6 }, disapproved: { x: 24.3, y: 314 } } as const;

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const hard of text.split(/\r?\n/)) {
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

function draw(page: PDFPage, slot: Slot, text: string, font: PDFFont) {
  const value = text.trim();
  if (!value) return;
  const size = slot.size ?? VALUE_SIZE;
  const lineH = size * 1.18;
  const lines = wrap(value, font, size, slot.w).slice(0, slot.lines ?? 1);
  lines.forEach((line, i) => {
    page.drawText(line, { x: slot.x, y: slot.y - i * lineH, size, font, color: INK });
  });
}

/** The values as they print, by slot, from the form data. */
export function dd368PrintedValues(formData: FormData): Record<string, string> {
  const get = (name: string) => dd368Field(formData, name).trim();
  const category = dd368MemberCategory(get('dd368PayGrade'));
  const gaining = get('dd368GainingComponent');
  const out: Record<string, string> = {};
  for (const name of Object.keys(SLOTS)) {
    if (name === 'dd368GainingComponent3b') {
      // 3.b is the officer's tender of resignation; an enlisted member
      // uses 3.c, which carries no blank.
      out[name] = category === 'officer' ? gaining : '';
    } else if (name === 'dd368GainingComponent4a') {
      out[name] = gaining;
    } else if (name === 'dd368CurrentComponent') {
      out[name] = category === 'officer' ? (get(name) || get('dd368ServiceComponent')) : '';
    } else if (name === 'dd368ReleaseValidUntil') {
      out[name] = get('dd368Decision') === 'approved' ? get(name) : '';
    } else {
      out[name] = get(name);
    }
  }
  return out;
}

export async function generateDd368(formData: FormData): Promise<Uint8Array> {
  const [front, back] = await Promise.all([
    loadAssetBytes('forms/dd368-front.png'),
    loadAssetBytes('forms/dd368-back.png'),
  ]);
  const doc = await PDFDocument.create();
  doc.setTitle('DD Form 368, Request for Conditional Release');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages: [PDFPage, PDFPage] = [doc.addPage([612, 792]), doc.addPage([612, 792])];
  const [frontImage, backImage] = await Promise.all([doc.embedPng(front), doc.embedPng(back)]);
  pages[0].drawImage(frontImage, { x: 0, y: 0, width: 612, height: 792 });
  pages[1].drawImage(backImage, { x: 0, y: 0, width: 612, height: 792 });

  const values = dd368PrintedValues(formData);
  for (const [name, slot] of Object.entries(SLOTS)) {
    draw(pages[slot.page - 1], slot, values[name] ?? '', font);
  }

  const decision = dd368Field(formData, 'dd368Decision').trim();
  if (decision === 'approved' || decision === 'disapproved') {
    const mark = DECISION_MARKS[decision];
    pages[0].drawText('X', { x: mark.x, y: mark.y, size: 9, font: bold, color: INK });
  }

  return doc.save();
}
