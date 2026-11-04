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
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { FormData } from '@/types';
import { INK, LABEL, MARGIN, PAGE_H, PAGE_W, SMALL, Sheet, VALUE, WIDTH, type Cell, type Fonts, type FormCheck } from '@/services/pdf/boxedFormSheet';
import {
  AREA_CITATION, COUNSELING_AREAS, COUNSELING_LIFE_EVENTS, HANDLING_STATEMENT, ICS_OBJECTIVES, PRIVACY_MARKING, STANDARD_KINDS,
  counselingArea, counselingAreaEntries, counselingField, counselingIcsObjectives, counselingLifeEvents, counselingOccasion,
  counselingPriorTargets, counselingSubjects, counselingTargets, rankAbbreviation, gradeText, targetSentence,
  JEPES_ADVERSE_REASONS, JEPES_ATTRIBUTES, JEPES_CITATION, benchmarkHasMarks, counselingBenchmark, counselingPriorBenchmark,
  isJepesGrade, jepesBand,
  type CounselingAreaEntry, type CounselingPriorTarget, type CounselingSubject, type CounselingTarget, dutyLines,
} from '@/lib/counseling';

// --- the model ---

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
    // An initial session IS the ICS, so block 4 is the session date and
    // there is no last session to date (handoff D-01, D-03, 22 Oct 26).
    { n: 4, label: 'DATE OF ICS', value: kind === 'initial' ? get('date') : get('counselingIcsDate') },
    kind === 'initial'
      ? { n: 5, label: 'PRIOR SESSION', value: 'None. Initial session.' }
      : { n: 5, label: 'DATE OF LAST SESSION', value: get('counselingLastSessionDate') },
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
    {
      n: 12, label: 'BILLET TITLE AND DESCRIPTION',
      // Primary and collateral duties on page 1 under the billet, one
      // list each, the record of ICS objective 7 (handoff D-05, 22 Oct 26).
      value: [
        [get('counselingBilletTitle'), get('counselingBilletDescription')].filter(Boolean).join('. '),
        dutyLines(get('counselingPrimaryDuties')).length ? `Primary duties: ${dutyLines(get('counselingPrimaryDuties')).join('; ')}.` : '',
        dutyLines(get('counselingCollateralDuties')).length ? `Collateral duties: ${dutyLines(get('counselingCollateralDuties')).join('; ')}.` : '',
      ].filter(Boolean).join('\n'),
    },
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

  // Section VII. Review of targets from last session. Not on an initial
  // session, which has none to review (handoff D-02, 22 Oct 26); the
  // section numbers after it stay as they are so block 26 is block 26 on
  // every occasion.
  if (model.agenda !== 'ics') {
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
  } else {
    // Handoff N-01 (22 Oct 26 retest): leaving the heading out made the
    // record read VI then VIII. One line keeps the numbering whole and
    // says why the section is empty.
    // section() waits for a block to keep the bar with; there is none here.
    s.section('SECTION VII. NOT USED ON AN INITIAL SESSION (NAVMC 2795 para 2001.2.b)');
    s.flushSection(0);
  }

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
