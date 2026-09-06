/**
 * Counseling Worksheet: the app's render (docs/COUNSELING_FORM_PLAN.md
 * section 6).
 *
 * No official blank exists, so the record is drawn: portrait letter,
 * Helvetica, PRIVACY SENSITIVE top and bottom of every page, sections in
 * the order the session runs, two signature lines, and the handling
 * statement of NAVMC 2795 para 3005.1.i. Long sections flow onto
 * further pages.
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import type { FormData } from '@/types';
import {
  AREA_STATUS_LABELS, COUNSELING_AREAS, COUNSELING_LIFE_EVENTS, HANDLING_STATEMENT, ICS_OBJECTIVES, PRIOR_TARGET_STATUS_LABELS,
  PRIVACY_MARKING, STANDARD_KINDS, counselingArea, counselingAreaEntries, counselingField, counselingIcsObjectives,
  counselingLifeEvents, counselingMarineDisplayName, counselingPriorTargets, counselingSeniorDisplayName, counselingSubjects,
  counselingTargets, gradeLabel, occasionLabel, targetSentence,
} from '@/lib/counseling';

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const TOP = PAGE_H - MARGIN;
const BOTTOM = MARGIN + 18;
const WIDTH = PAGE_W - MARGIN * 2;
const INK = rgb(0, 0, 0);
const RULE = rgb(0.55, 0.55, 0.55);
const BODY = 10;
const SMALL = 8;
const HEADING = 11;

export interface CounselingRecordLine {
  kind: 'title' | 'heading' | 'text' | 'pair' | 'small';
  text: string;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const hard of text.split(/\r?\n/)) {
    const words = hard.split(/\s+/).filter(Boolean);
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

function blank(value: string): string {
  return value.trim() || '—';
}

/**
 * The record as ordered lines, the way it prints. Tests read this to
 * check content without parsing the PDF; the renderer draws it.
 */
export function counselingRecordLines(formData: FormData): CounselingRecordLine[] {
  const get = (name: string) => counselingField(formData, name).trim();
  const lines: CounselingRecordLine[] = [];
  const push = (kind: CounselingRecordLine['kind'], text: string) => lines.push({ kind, text });

  push('title', 'COUNSELING WORKSHEET');
  push('pair', `Occasion: ${blank(occasionLabel(formData))}`);
  push('pair', `Date of session: ${blank(get('date'))}`);
  if (get('counselingIcsDate')) push('pair', `Date of initial counseling session: ${get('counselingIcsDate')}`);
  if (get('counselingLastSessionDate')) push('pair', `Date of last session: ${get('counselingLastSessionDate')}`);
  push('pair', `Target date for next session: ${blank(get('counselingNextSessionDate'))}`);
  const events = counselingLifeEvents(formData).map((v) => COUNSELING_LIFE_EVENTS.find((e) => e.value === v)?.label ?? v);
  if (get('counselingLifeEventsOther')) events.push(get('counselingLifeEventsOther'));
  if (events.length) push('pair', `Life events: ${events.join('; ')}`);
  if (get('counselingEventDescription')) push('pair', `Event: ${get('counselingEventDescription')}`);

  push('heading', 'MARINE COUNSELED');
  push('pair', `Name: ${blank(counselingMarineDisplayName(formData))}`);
  const marineBits = [
    get('counselingMarineGrade') ? `Grade: ${gradeLabel(get('counselingMarineGrade'))}` : '',
    get('counselingMarineComponent') ? `Component: ${get('counselingMarineComponent') === 'reserve' ? 'Reserve' : 'Active'}` : '',
    get('counselingMarineEdipi') ? `EDIPI: ${get('counselingMarineEdipi')}` : '',
    get('counselingMarineDor') ? `DOR: ${get('counselingMarineDor')}` : '',
    get('counselingMarinePmos') ? `PMOS: ${get('counselingMarinePmos')}` : '',
    get('counselingMarineBilletMos') ? `Billet MOS: ${get('counselingMarineBilletMos')}` : '',
  ].filter(Boolean);
  if (marineBits.length) push('pair', marineBits.join('    '));
  if (get('counselingBilletTitle') || get('counselingBilletDescription')) {
    push('pair', `Billet: ${[get('counselingBilletTitle'), get('counselingBilletDescription')].filter(Boolean).join('. ')}`);
  }

  push('heading', 'MARINE PERFORMING COUNSELING (SENIOR)');
  push('pair', `Name: ${blank(counselingSeniorDisplayName(formData))}`);
  const seniorBits = [
    get('counselingSeniorEdipi') ? `EDIPI: ${get('counselingSeniorEdipi')}` : '',
    get('counselingSeniorBillet') ? `Billet: ${get('counselingSeniorBillet')}` : '',
  ].filter(Boolean);
  if (seniorBits.length) push('pair', seniorBits.join('    '));

  const objectives = counselingIcsObjectives(formData);
  if (objectives.length) {
    push('heading', 'INITIAL COUNSELING SESSION OBJECTIVES COVERED');
    for (const o of ICS_OBJECTIVES) if (objectives.includes(o.id)) push('text', `• ${o.text}`);
  }
  const prior = counselingPriorTargets(formData).filter((t) => t.text.trim());
  if (prior.length) {
    push('heading', 'REVIEW OF TARGETS FROM LAST SESSION');
    prior.forEach((t, i) => push('text', `${i + 1}. ${t.text.trim()}${t.status ? ` (${PRIOR_TARGET_STATUS_LABELS[t.status]})` : ''}`));
  }

  push('heading', 'SUBJECTS DISCUSSED');
  const subjects = counselingSubjects(formData).filter((s) => s.text.trim());
  if (subjects.length === 0) push('text', '—');
  for (const s of subjects) {
    const area = s.area === 'duties' ? 'Duties' : counselingArea(s.area)?.title;
    push('text', `• ${s.text.trim()}${area ? ` [${area}]` : ''}`);
  }

  push('heading', 'FUNCTIONAL AREAS OF LEADER DEVELOPMENT');
  for (const entry of counselingAreaEntries(formData)) {
    const area = COUNSELING_AREAS.find((a) => a.id === entry.area)!;
    const status = entry.status ? AREA_STATUS_LABELS[entry.status] : 'Not answered';
    push('text', `${area.title}: ${status}${entry.notes.trim() ? `. ${entry.notes.trim()}` : ''}`);
  }

  if (get('counselingAccomplishments')) { push('heading', 'MAJOR ACCOMPLISHMENTS AND SIGNIFICANT EVENTS'); push('text', get('counselingAccomplishments')); }
  if (get('counselingStrengths')) { push('heading', 'STRENGTHS'); push('text', get('counselingStrengths')); }
  if (get('counselingDeficiencies')) { push('heading', 'DEFICIENCIES'); push('text', get('counselingDeficiencies')); }

  push('heading', 'TARGETS FOR THE COMING PERIOD');
  const targets = counselingTargets(formData).map(targetSentence).map((sentence, i) => ({ sentence, i }));
  const filled = counselingTargets(formData);
  if (targets.every((t) => !t.sentence)) push('text', '—');
  targets.forEach(({ sentence, i }) => {
    if (!sentence) return;
    const t = filled[i];
    const tags = [
      t.standardKinds.length ? `Standard: ${t.standardKinds.map((k) => STANDARD_KINDS.find((s) => s.value === k)?.label ?? k).join(', ')}` : '',
      t.area ? `Area: ${counselingArea(t.area)?.title ?? t.area}` : '',
    ].filter(Boolean);
    push('text', `${i + 1}. ${sentence}${tags.length ? ` (${tags.join('; ')})` : ''}`);
  });

  if (get('counselingSeniorComments')) { push('heading', "SENIOR'S COMMENTS"); push('text', get('counselingSeniorComments')); }
  const includeMarine = (formData as Record<string, unknown>).counselingIncludeMarineComments === true;
  if (includeMarine || get('counselingMarineComments')) { push('heading', "MARINE'S COMMENTS"); push('text', blank(get('counselingMarineComments'))); }

  push('heading', 'CERTIFICATION');
  push('pair', `Marine performing counseling: ${blank(counselingSeniorDisplayName(formData))}    Date: ${blank(get('counselingSeniorSignedDate'))}`);
  push('pair', `Marine counseled: ${blank(counselingMarineDisplayName(formData))}    Date: ${blank(get('counselingMarineSignedDate'))}`);
  push('small', HANDLING_STATEMENT);
  return lines;
}

interface Cursor { page: PDFPage; y: number }

export async function generateCounseling(formData: FormData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Counseling Worksheet');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const marking = (page: PDFPage) => {
    const w = bold.widthOfTextAtSize(PRIVACY_MARKING, SMALL);
    page.drawText(PRIVACY_MARKING, { x: (PAGE_W - w) / 2, y: PAGE_H - 30, size: SMALL, font: bold, color: INK });
    page.drawText(PRIVACY_MARKING, { x: (PAGE_W - w) / 2, y: 22, size: SMALL, font: bold, color: INK });
  };
  const newPage = (): Cursor => {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    marking(page);
    return { page, y: TOP };
  };
  let cursor = newPage();
  const ensure = (height: number) => {
    if (cursor.y - height < BOTTOM) cursor = newPage();
  };

  for (const line of counselingRecordLines(formData)) {
    if (line.kind === 'title') {
      ensure(24);
      const w = bold.widthOfTextAtSize(line.text, 14);
      cursor.page.drawText(line.text, { x: (PAGE_W - w) / 2, y: cursor.y - 14, size: 14, font: bold, color: INK });
      cursor.y -= 26;
      continue;
    }
    if (line.kind === 'heading') {
      ensure(HEADING * 2.6);
      cursor.y -= 8;
      cursor.page.drawText(line.text, { x: MARGIN, y: cursor.y - HEADING, size: HEADING, font: bold, color: INK });
      cursor.y -= HEADING + 3;
      cursor.page.drawLine({ start: { x: MARGIN, y: cursor.y }, end: { x: MARGIN + WIDTH, y: cursor.y }, thickness: 0.5, color: RULE });
      cursor.y -= 5;
      continue;
    }
    if (line.kind === 'small') {
      cursor.y -= 10;
      const rows = wrap(line.text, font, SMALL, WIDTH);
      for (const row of rows) {
        ensure(SMALL * 1.3);
        cursor.page.drawText(row, { x: MARGIN, y: cursor.y - SMALL, size: SMALL, font, color: INK });
        cursor.y -= SMALL * 1.3;
      }
      continue;
    }
    const rows = wrap(line.text, font, BODY, WIDTH);
    for (const row of rows) {
      ensure(BODY * 1.35);
      cursor.page.drawText(row, { x: MARGIN, y: cursor.y - BODY, size: BODY, font, color: INK });
      cursor.y -= BODY * 1.35;
    }
    if (line.kind === 'text') cursor.y -= 2;
  }

  return doc.save();
}
