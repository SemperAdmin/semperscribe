// @vitest-environment node
/**
 * Counseling Worksheet: the vocabulary, the interval rule, targets, the
 * suggestion engine and the render (docs/COUNSELING_FORM_PLAN.md).
 * Nothing blocks: every issue is a warning.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { registerNodeAssets } from './node-assets';
import { extractPdfTextLayout } from './golden/helpers';
import {
  COUNSELING_AREAS, COUNSELING_GRADES, COUNSELING_OCCASIONS, ICS_OBJECTIVES, HANDLING_STATEMENT, PRIVACY_MARKING,
  computedNextSessionDate, counselingSuggestions, emptyTarget, isLcplOrBelow, nextSessionInterval, parseNavalDate,
  runCounselingValidators, targetIsWellFormed, targetSentence, toNavalDate,
  JEPES_ATTRIBUTES, JEPES_BANDS, counselingBenchmark, isJepesGrade, jepesBand, type JepesAttributeId, type JepesMark,
} from '@/lib/counseling';
import { counselingFormModel, generateCounseling } from '@/services/pdf/counselingGenerator';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { runLetterValidators } from '@/lib/letter-validators';
import { DOCUMENT_TYPES, CounselingSchema } from '@/lib/schemas';
import { getExportFilename } from '@/lib/naval-format-utils';
import type { FormData } from '@/types';

beforeAll(() => {
  registerNodeAssets();
});

function form(overrides: Partial<FormData> = {}): FormData {
  return {
    documentType: 'counseling',
    date: '6 Sep 26',
    counselingOccasion: 'initial',
    counselingMarineLastName: 'SAMPLE',
    counselingMarineFirstName: 'MARINE',
    counselingMarineGrade: 'E-5',
    counselingMarineComponent: 'active',
    counselingSeniorLastName: 'LEADER',
    counselingSeniorGrade: 'E-7',
    ...overrides,
  } as FormData;
}

describe('vocabulary', () => {
  it('names the six functional areas in the order of MCO 1500.61 para 4.a(1)(d)', () => {
    expect(COUNSELING_AREAS.map((a) => a.title)).toEqual(['Fidelity', 'Fighter', 'Fitness', 'Family', 'Finances', 'Future']);
    for (const area of COUNSELING_AREAS) expect(area.prompts.length).toBeGreaterThanOrEqual(3);
  });

  it('lists the four session types and the eight baseline occasions of MCO 1500.61 para 4.b(2)', () => {
    expect(COUNSELING_OCCASIONS.filter((o) => o.kind === 'baseline')).toHaveLength(8);
    expect(COUNSELING_OCCASIONS.map((o) => o.value).slice(0, 4)).toEqual(['initial', 'follow-on', 'thirty-day', 'event-related']);
  });

  it('lists the seven objectives of an initial counseling session', () => {
    expect(ICS_OBJECTIVES).toHaveLength(7);
  });

  it('runs E-1 through O-6 with the warrant grades (owner decision)', () => {
    expect(COUNSELING_GRADES.map((g) => g.value)).toContain('W-3');
    expect(COUNSELING_GRADES[0].value).toBe('E-1');
    expect(COUNSELING_GRADES[COUNSELING_GRADES.length - 1].value).toBe('O-6');
    expect(isLcplOrBelow('E-3')).toBe(true);
    expect(isLcplOrBelow('E-4')).toBe(false);
    expect(isLcplOrBelow('W-1')).toBe(false);
  });

  it('registers the type under its own category with the pdf pipeline and no DOCX', () => {
    const def = DOCUMENT_TYPES.counseling;
    expect(def.features.category).toBe('counseling-worksheets');
    expect(def.features.pdfPipeline).toBe('counseling');
    expect(def.features.exportFormats).toEqual(['pdf']);
    expect(def.features.showClassification).toBe(false);
    expect(CounselingSchema.safeParse({ documentType: 'counseling' }).success).toBe(true);
  });
});

describe('dates and the interval rule (NAVMC 2795 para 2001)', () => {
  it('parses and prints the naval date', () => {
    const d = parseNavalDate('6 Sep 26')!;
    expect(d.getFullYear()).toBe(2026);
    expect(toNavalDate(d)).toBe('6 Sep 26');
    expect(parseNavalDate('2026-09-06')!.getDate()).toBe(6);
    expect(parseNavalDate('soon')).toBeNull();
    expect(parseNavalDate('31 Feb 26')).toBeNull();
    expect(parseNavalDate('0 Jan 26')).toBeNull();
    expect(parseNavalDate('1 Jan 0026')).toBeNull();
  });

  it('gives lance corporals and below 30 days active, 3 months reserve', () => {
    expect(nextSessionInterval('E-3', 'active', 'thirty-day')).toMatchObject({ days: 30, citation: 'NAVMC 2795 para 2001.3.a' });
    expect(nextSessionInterval('E-2', 'reserve', 'thirty-day')).toMatchObject({ months: 3, citation: 'NAVMC 2795 para 2001.3.f' });
  });

  it('gives corporal through colonel 90 days after the ICS, then 6 months, warrant officers included', () => {
    expect(nextSessionInterval('E-4', 'active', 'initial')).toMatchObject({ days: 90 });
    expect(nextSessionInterval('O-3', 'active', 'follow-on')).toMatchObject({ months: 6 });
    expect(nextSessionInterval('W-2', 'active', 'follow-on')).toMatchObject({ months: 6 });
  });

  it('computes the next-session date from the session date', () => {
    expect(computedNextSessionDate(form())).toBe('5 Dec 26');
    expect(computedNextSessionDate(form({ counselingMarineGrade: 'E-3', counselingOccasion: 'thirty-day' }))).toBe('6 Oct 26');
    expect(computedNextSessionDate(form({ counselingOccasion: 'follow-on' }))).toBe('6 Mar 27');
    expect(computedNextSessionDate(form({ date: '' }))).toBe('');
    // "No more than 6 months": month arithmetic clamps to the end of the target month (P5-4).
    expect(computedNextSessionDate(form({ date: '31 Aug 26', counselingOccasion: 'follow-on' }))).toBe('28 Feb 27');
  });
});

describe('targets (NAVMC 2795 para 4002)', () => {
  it('reads as one sentence: action, object, standard, due date', () => {
    expect(targetSentence({ ...emptyTarget(), action: 'To achieve', object: 'a 95 percent NCI completion rate', dueDate: '31 Dec 26' }))
      .toBe('To achieve a 95 percent NCI completion rate by 31 Dec 26.');
    expect(targetSentence({ ...emptyTarget(), action: 'To complete', object: 'personnel records', standard: 'with no open discrepancies' }))
      .toBe('To complete personnel records, with no open discrepancies.');
    expect(targetSentence(emptyTarget())).toBe('');
  });

  it('is well formed with an action, an object, and a standard or a date', () => {
    expect(targetIsWellFormed({ ...emptyTarget(), action: 'To pass', object: 'the PFT', standard: 'first class' })).toBe(true);
    expect(targetIsWellFormed({ ...emptyTarget(), action: 'To pass', object: 'the PFT' })).toBe(false);
    expect(targetIsWellFormed({ ...emptyTarget(), action: 'To improve', standard: 'a lot' })).toBe(false);
  });
});

describe('the suggestion engine', () => {
  const ids = (fd: FormData) => counselingSuggestions(fd).map((s) => s.id);

  it('is silent for every other document type', () => {
    expect(counselingSuggestions({ documentType: 'basic' } as FormData)).toEqual([]);
    expect(runCounselingValidators({ documentType: 'basic' } as FormData)).toEqual([]);
  });

  it('suggests the four documentation minimums when they are missing', () => {
    const list = ids(form({ date: '', counselingMarineLastName: '', counselingSeniorLastName: '' }));
    expect(list).toEqual(expect.arrayContaining(['date', 'marine-name', 'senior-name', 'content']));
  });

  it('offers the computed next-session date and flags a later one', () => {
    const open = counselingSuggestions(form()).find((s) => s.id === 'next-session')!;
    expect(open.action!.apply(form())).toEqual({ counselingNextSessionDate: '5 Dec 26' });
    expect(ids(form({ counselingNextSessionDate: '1 Feb 27' }))).toContain('next-session-late');
    expect(ids(form({ counselingNextSessionDate: '1 Dec 26' }))).not.toContain('next-session-late');
  });

  it('lists the ICS objectives still open for an initial session', () => {
    const s = counselingSuggestions(form({ counselingIcsObjectives: ['expectations'] })).find((x) => x.id === 'ics-agenda')!;
    expect(s.text).toContain('Still open');
    expect(s.text).not.toContain("Make the senior's expectations clear");
    expect(ids(form({ counselingIcsObjectives: ICS_OBJECTIVES.map((o) => o.id) }))).not.toContain('ics-agenda');
  });

  it('asks a follow-on session for the prior-target review and carries a missed target forward', () => {
    expect(ids(form({ counselingOccasion: 'follow-on' }))).toContain('follow-on-review');
    const fd = form({ counselingOccasion: 'follow-on', counselingPriorTargets: [{ text: 'To pass the PFT', status: 'not-met' }] });
    const s = counselingSuggestions(fd).find((x) => x.id === 'target-not-met-0')!;
    const patch = s.action!.apply(fd);
    expect((patch.counselingTargets as { object: string }[])[0].object).toBe('To pass the PFT');
  });

  it('walks the six areas and marks the open ones not this session in one click', () => {
    const fd = form({ counselingAreas: [{ area: 'fitness', status: 'discussed', notes: '' }] });
    const s = counselingSuggestions(fd).find((x) => x.id === 'area-unanswered')!;
    expect(s.text).toContain('Fidelity');
    expect(s.text).not.toContain('Fitness');
    const patch = s.action!.apply(fd);
    const entries = patch.counselingAreas as { area: string; status: string }[];
    expect(entries).toHaveLength(6);
    expect(entries.find((e) => e.area === 'fitness')!.status).toBe('discussed');
    expect(entries.filter((e) => e.status === 'not-this-session')).toHaveLength(5);
  });

  it('seeds a target for an area marked target set', () => {
    const fd = form({ counselingAreas: [{ area: 'finances', status: 'target-set', notes: '' }] });
    const s = counselingSuggestions(fd).find((x) => x.id === 'area-target-finances')!;
    expect((s.action!.apply(fd).counselingTargets as { area: string }[])[0].area).toBe('finances');
  });

  it('keys life events to subjects and areas (MCO 1500.61 para 4.b(1)(b))', () => {
    const fd = form({ counselingLifeEvents: ['birth-of-child'] });
    const s = counselingSuggestions(fd).find((x) => x.id === 'life-child')!;
    expect(s.text).toContain('NAVMC 10922');
    const subjects = s.action!.apply(fd).counselingSubjects as { area: string }[];
    expect(subjects[0].area).toBe('family');
    expect(ids(form())).not.toContain('life-child');
  });

  it('brings the 30-day topics for a lance corporal', () => {
    const fd = form({ counselingMarineGrade: 'E-3', counselingOccasion: 'thirty-day' });
    const s = counselingSuggestions(fd).find((x) => x.id === 'thirty-day-topics')!;
    expect((s.action!.apply(fd).counselingSubjects as unknown[]).length).toBe(6);
    expect(ids(form())).not.toContain('thirty-day-topics');
  });

  it('counts targets, checks their form and their due dates', () => {
    expect(ids(form())).toContain('target-count-low');
    const six = Array.from({ length: 6 }, () => ({ ...emptyTarget(), action: 'To pass', object: 'the PFT', standard: 'first class' }));
    expect(ids(form({ counselingTargets: six }))).toContain('target-count-high');
    expect(ids(form({ counselingTargets: [{ ...emptyTarget(), object: 'the PFT' }] }))).toContain('target-form-0');
    const late = form({ counselingNextSessionDate: '5 Dec 26', counselingTargets: [{ ...emptyTarget(), action: 'To pass', object: 'the PFT', dueDate: '1 Jan 27' }] });
    const s = counselingSuggestions(late).find((x) => x.id === 'target-due-0')!;
    expect((s.action!.apply(late).counselingTargets as { dueDate: string }[])[0].dueDate).toBe('5 Dec 26');
  });

  it('flags a mentor label and a new-unit occasion', () => {
    expect(ids(form({ counselingSeniorBillet: 'Counseling Mentor' }))).toContain('mentor-label');
    const s = counselingSuggestions(form({ counselingOccasion: 'new-unit' })).find((x) => x.id === 'new-unit')!;
    expect(s.action!.apply(form())).toEqual({ counselingNextSessionDate: '6 Oct 26' });
  });

  it('always carries the handling note and drops dismissed suggestions', () => {
    expect(ids(form())).toContain('handling');
    expect(ids(form({ counselingDismissed: ['target-count-low', 'handling'] }))).not.toContain('target-count-low');
  });

  it('feeds the compliance panel warnings only, without the handling note', () => {
    const issues = runCounselingValidators(form({ date: '' }));
    expect(issues.every((i) => i.severity === 'warn')).toBe(true);
    expect(issues.some((i) => i.id === 'counseling-handling')).toBe(false);
    expect(issues.find((i) => i.id === 'counseling-date')?.field).toBe('date');
    const all = runLetterValidators(form({ date: '' }), [], [], []);
    expect(all.filter((i) => i.severity === 'block')).toHaveLength(0);
  });
});

describe('the record', () => {
  it('names the file after the Marine and the session date', () => {
    expect(getExportFilename(form(), 'pdf')).toBe('Counseling - SAMPLE - 6 Sep 26.pdf');
  });

  it('models the form by item number: the four minimums, the areas, the targets, the handling block', () => {
    const fd = form({
      counselingSubjects: [{ text: 'Unit mission', area: 'duties' }],
      counselingAreas: [{ area: 'fitness', status: 'discussed', notes: 'PFT first class' }],
      counselingTargets: [{ ...emptyTarget(), action: 'To pass', object: 'the PFT', standard: 'first class', dueDate: '1 Dec 26', area: 'fitness', standardKinds: ['quality'] }],
      counselingLifeEvents: ['birth-of-child'],
      counselingIncludeMarineComments: true,
      counselingMarineComments: 'Agreed.',
    });
    const model = counselingFormModel(fd);
    const item = (n: number) => model.items.find((i) => i.n === n)!;
    expect(model.items.map((i) => i.n)).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
    expect(item(1).checks!.find((c) => c.label === 'Initial (ICS)')!.on).toBe(true);
    expect(item(2).value).toBe('6 Sep 26');
    expect(item(6).checks!.find((c) => c.label === 'Birth of a child')!.on).toBe(true);
    expect(item(7).value).toBe('SAMPLE, MARINE');
    expect(item(8).value).toBe('Sgt E-5');
    expect(item(14).checks).toEqual([{ label: 'AC', on: true }, { label: 'RC', on: false }]);
    expect(model.agenda).toBe('ics');
    expect(item(19).checks).toHaveLength(7);
    expect(model.areas.find((a) => a.area === 'fitness')).toEqual({ area: 'fitness', status: 'discussed', notes: 'PFT first class' });
    expect(model.subjects).toEqual([{ text: 'Unit mission', area: 'duties' }]);
    expect(model.targets[0].object).toBe('the PFT');
    expect(model.marineCommentsIncluded).toBe(true);
    expect(item(29).value).toBe('GySgt LEADER');
    expect(item(31).value).toBe('Sgt SAMPLE, MARINE');
    expect(model.handling).toBe(HANDLING_STATEMENT);
    expect(counselingFormModel(form({ counselingOccasion: 'follow-on' })).agenda).toBe('review');
    expect(counselingFormModel(form({ counselingOccasion: 'event-related', counselingEventDescription: 'Range incident' })).items.find((i) => i.n === 19)!.value).toBe('Range incident');
  });

  it('renders through the pipeline with the marking on the page', async () => {
    const blob = await generatePdfForDocType({ formData: form(), vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [] });
    const items = await extractPdfTextLayout(blob);
    const text = items.map((i) => i.text).join(' ');
    expect(text).toContain('COUNSELING WORKSHEET');
    expect(text).toContain(PRIVACY_MARKING);
    expect(text).toContain('7. NAME (Last, First, MI)');
    expect(text).toContain('SAMPLE, MARINE');
    expect(text).toContain('SECTION V. FUNCTIONAL AREAS OF LEADER DEVELOPMENT');
    expect(text).toContain('TARGET (action, object, standard)');
    expect(text).toContain('HANDLING.');
    expect(text).toContain('Page 1 of');
  });

  it('flows a long record onto a second page', async () => {
    const long = form({ counselingAccomplishments: Array.from({ length: 40 }, (_, i) => `Accomplishment ${i + 1} described at length for the record.`).join('\n') });
    const bytes = await generateCounseling(long);
    const items = await extractPdfTextLayout(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
    expect(Math.max(...items.map((i) => i.page))).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Containers grow with their text and never let it escape. Measured
 * defects, 2026-09-06, from a stress render: a name typed without spaces
 * ran through the cell border into item 8; a long life-event label ran
 * off the page; a comment longer than a page ran through the footer
 * marking. Every assertion here is on the PDF text layer's positions.
 */
describe('containers expand and text stays inside them', () => {
  const LONG = 'This is a deliberately long entry which keeps going so the cell must wrap across several lines and the row must grow to hold it. ';
  const NOSPACE = 'https://example.mil/a/very/long/path/without/any/spaces/at/all/which/cannot/wrap/normally/1234567890';
  const PAGE_W = 612;
  const MARGIN = 36;
  const BOTTOM = 44;

  async function layout(overrides: Partial<FormData>) {
    const bytes = await generateCounseling(form(overrides));
    return extractPdfTextLayout(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
  }

  it('breaks a word wider than its cell instead of running through the border', async () => {
    const items = await layout({ counselingMarineLastName: 'VERYLONGLASTNAMEWITHOUTSPACESXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' });
    // Item 7 is 200pt wide from the left margin. Every fragment of the name
    // starts inside it, and none is the whole unbroken string.
    const fragments = items.filter((i) => i.page === 1 && /WITHOUTSPACES|X{5,}/.test(i.text));
    expect(fragments.length).toBeGreaterThanOrEqual(2);
    for (const f of fragments) expect(f.x).toBeLessThan(MARGIN + 200);
    expect(fragments.some((f) => f.text.includes('VERYLONGLASTNAMEWITHOUTSPACESXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'))).toBe(false);
  });

  it('wraps a check label wider than its column under the checkbox', async () => {
    const items = await layout({ counselingLifeEvents: ['other'], counselingLifeEventsOther: LONG + LONG });
    const words = items.filter((i) => i.page === 1 && i.text.includes('deliberately'));
    expect(words.length).toBeGreaterThanOrEqual(2);
    // Nothing starts past the right margin, and the wrapped lines share the
    // right-hand column's x.
    for (const w of words) expect(w.x).toBeLessThan(PAGE_W - MARGIN);
  });

  it('splits a comment longer than a page across pages with a continued label, above the footer', async () => {
    const items = await layout({ counselingSeniorComments: LONG.repeat(45), counselingIncludeMarineComments: true, counselingMarineComments: LONG.repeat(3) });
    const body = items.filter((i) => i.text.includes('deliberately'));
    for (const b of body) expect(b.y, `text on page ${b.page} below the bottom margin`).toBeGreaterThanOrEqual(BOTTOM);
    expect(items.some((i) => i.text.includes("27. SENIOR'S COMMENTS (continued)"))).toBe(true);
    // The Marine's comments finished on their first page and are not marked continued.
    expect(items.some((i) => i.text.includes("28. MARINE'S COMMENTS (optional) (continued)"))).toBe(false);
    // The certification block still follows, on the last page.
    const last = Math.max(...items.map((i) => i.page));
    expect(items.some((i) => i.page === last && i.text.includes('SECTION X. CERTIFICATION'))).toBe(true);
  });

  it('keeps a target with an unbreakable URL inside its column', async () => {
    const items = await layout({ counselingOccasion: 'follow-on', counselingPriorTargets: [{ text: NOSPACE, status: 'not-met', note: '' }] as never });
    const pieces = items.filter((i) => /example\.mil|\/[a-z]+\/|1234567890/.test(i.text));
    expect(pieces.length).toBeGreaterThanOrEqual(2);
    for (const p of pieces) expect(p.x).toBeLessThan(MARGIN + 30 + 380);
  });
});

/**
 * The provisional JEPES benchmark (docs/COUNSELING_JEPES_BENCHMARK_PLAN.md).
 * Band edges from Figure 1-2, rules from para 3.a, grade scope from
 * MCO 1616.1 para 1.
 */
describe('JEPES benchmark: bands, scope, suggestions', () => {
  const cpl = (extra: Partial<FormData> = {}) => form({ counselingMarineGrade: 'E-4', ...extra });
  const bench = (marks: Partial<Record<JepesAttributeId, Partial<JepesMark>>>) =>
    ({ counselingBenchmark: marks } as unknown as Partial<FormData>);
  const ids = (fd: FormData) => counselingSuggestions(fd).map((s) => s.id);

  it('places every band edge of Figure 1-2', () => {
    const at = (m: string) => jepesBand(m)?.id;
    expect(at('0.0')).toBe('adverse');
    expect(at('0.1')).toBe('below');
    expect(at('0.9')).toBe('below');
    expect(at('1.0')).toBe('working');
    expect(at('1.9')).toBe('working');
    expect(at('2.0')).toBe('meets');
    expect(at('2.5')).toBe('meets');
    expect(at('3.0')).toBe('meets');
    expect(at('3.1')).toBe('exceeds');
    expect(at('4.0')).toBe('exceeds');
    expect(at('4.1')).toBe('exceptional');
    expect(at('5.0')).toBe('exceptional');
    expect(jepesBand('')).toBeNull();
    expect(jepesBand('5.1')).toBeNull();
    expect(jepesBand('abc')).toBeNull();
    // Two decimals are accepted and rounded to tenths for banding (P5-11).
    expect(jepesBand('2.55')?.id).toBe('meets');
    expect(jepesBand('4.50')?.id).toBe('exceptional');
    expect(jepesBand('2.555')).toBeNull();
  });

  it('covers Private through Corporal only (MCO 1616.1 para 1)', () => {
    expect(isJepesGrade('E-1')).toBe(true);
    expect(isJepesGrade('E-4')).toBe(true);
    expect(isJepesGrade('E-5')).toBe(false);
    expect(isJepesGrade('W-1')).toBe(false);
    expect(isJepesGrade('')).toBe(false);
  });

  it('carries three attributes with six band lists each, in figure order', () => {
    expect(JEPES_ATTRIBUTES.map((a) => a.title)).toEqual(['Individual Character', 'MOS Proficiency and/or Mission Accomplishment', 'Leadership']);
    for (const a of JEPES_ATTRIBUTES) for (const b of JEPES_BANDS) expect(a.bands[b.id].length).toBeGreaterThanOrEqual(3);
  });

  it('offers the 2.5 baseline when all three are blank, and applies it to all three', () => {
    const fd = cpl();
    const start = counselingSuggestions(fd).find((s) => s.id === 'benchmark-start');
    expect(start).toBeDefined();
    const applied = { ...fd, ...start!.action!.apply(fd) };
    const b = counselingBenchmark(applied);
    expect([b.character.mark, b.mos.mark, b.leadership.mark]).toEqual(['2.5', '2.5', '2.5']);
    expect(ids(applied)).not.toContain('benchmark-start');
  });

  it('is silent for a Sergeant', () => {
    expect(ids(form({ counselingMarineGrade: 'E-5' })).some((id) => id.startsWith('benchmark'))).toBe(false);
    expect(ids(form({ counselingMarineGrade: 'E-5', ...bench({ mos: { mark: '4.5' } }) })).some((id) => id.startsWith('benchmark'))).toBe(false);
  });

  it('requires a justification at 4.1 and above and at 0.9 and below, not in between (para 3.a(1), 3.a(5))', () => {
    expect(ids(cpl(bench({ mos: { mark: '4.1' } })))).toContain('benchmark-justify-mos');
    expect(ids(cpl(bench({ mos: { mark: '0.9' } })))).toContain('benchmark-justify-mos');
    expect(ids(cpl(bench({ mos: { mark: '0.0' } })))).toContain('benchmark-justify-mos');
    expect(ids(cpl(bench({ mos: { mark: '4.0' } })))).not.toContain('benchmark-justify-mos');
    expect(ids(cpl(bench({ mos: { mark: '1.0' } })))).not.toContain('benchmark-justify-mos');
    expect(ids(cpl(bench({ mos: { mark: '4.1', justification: 'MUC and a NAM this period.' } })))).not.toContain('benchmark-justify-mos');
  });

  it('asks for commendatory material at 4.1 and above only (para 3.a(1))', () => {
    expect(ids(cpl(bench({ leadership: { mark: '4.1' } })))).toContain('benchmark-commendatory-leadership');
    expect(ids(cpl(bench({ leadership: { mark: '4.0' } })))).not.toContain('benchmark-commendatory-leadership');
    expect(ids(cpl(bench({ leadership: { mark: '4.1', commendatory: true } })))).not.toContain('benchmark-commendatory-leadership');
  });

  it('asks for the adverse reason at 0.0 only', () => {
    expect(ids(cpl(bench({ character: { mark: '0.0' } })))).toContain('benchmark-adverse-character');
    expect(ids(cpl(bench({ character: { mark: '0.1' } })))).not.toContain('benchmark-adverse-character');
    expect(ids(cpl(bench({ character: { mark: '0.0', adverseReason: 'njp' } })))).not.toContain('benchmark-adverse-character');
  });

  it('flags a move of more than a full point from the prior session when unexplained', () => {
    const prior = { counselingPriorBenchmark: { character: '2.5', mos: '2.5', leadership: '2.5', date: '1 Mar 26' } } as unknown as Partial<FormData>;
    expect(ids(cpl({ ...prior, ...bench({ mos: { mark: '3.6' } }) }))).toContain('benchmark-swing-mos');
    expect(ids(cpl({ ...prior, ...bench({ mos: { mark: '3.5' } }) }))).not.toContain('benchmark-swing-mos');
    expect(ids(cpl({ ...prior, ...bench({ mos: { mark: '1.4' } }) }))).toContain('benchmark-swing-mos');
    expect(ids(cpl({ ...prior, ...bench({ mos: { mark: '3.6', justification: 'Ran the section for six weeks during the SNCOIC gap.' } }) }))).not.toContain('benchmark-swing-mos');
    expect(ids(cpl(bench({ mos: { mark: '3.6' } })))).not.toContain('benchmark-swing-mos');
  });

  it('parses a document with the benchmark and one without', () => {
    expect(CounselingSchema.safeParse({ ...cpl(), counselingBenchmark: { mos: { mark: '2.5', justification: '', commendatory: false, adverseReason: '' } } }).success).toBe(true);
    expect(CounselingSchema.safeParse(cpl()).success).toBe(true);
  });
});

describe('JEPES benchmark on the record', () => {
  const bench = (marks: Record<string, Partial<JepesMark>>) => ({ counselingBenchmark: marks } as unknown as Partial<FormData>);
  async function text(overrides: Partial<FormData>) {
    const bytes = await generateCounseling(form(overrides));
    const items = await extractPdfTextLayout(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
    return { items, all: items.map((i) => i.text).join(' ') };
  }

  it('prints nothing for a blank benchmark, and nothing for a Sergeant even when marked', async () => {
    expect((await text({ counselingMarineGrade: 'E-4' })).all).not.toContain('SECTION VI-A');
    expect((await text({ counselingMarineGrade: 'E-5', ...bench({ mos: { mark: '4.5', justification: 'x' } }) })).all).not.toContain('SECTION VI-A');
    expect(counselingFormModel(form({ counselingMarineGrade: 'E-5', ...bench({ mos: { mark: '4.5' } }) })).benchmark).toBeNull();
  });

  it('prints attribute, prior, mark, band and justification, and never the rubric descriptors', async () => {
    const { all } = await text({
      counselingMarineGrade: 'E-4',
      counselingPriorBenchmark: { character: '2.5', mos: '2.5', leadership: '2.5', date: '8 Jun 26' },
      ...bench({
        character: { mark: '2.8' },
        mos: { mark: '4.2', justification: 'NAM for the field exercise.', commendatory: true },
        leadership: { mark: '0.0', adverseReason: 'njp', justification: 'NJP on 3 Aug 26 for UA.' },
      }),
    } as Partial<FormData>);
    expect(all).toContain('SECTION VI-A. JEPES BENCHMARK (provisional, not the mark of record');
    expect(all).toContain('PRIOR (8 Jun 26)');
    expect(all).toContain('Individual Character');
    expect(all).toContain('Meets Expectations');
    expect(all).toContain('4.2');
    expect(all).toContain('Exceptional');
    expect(all).toContain('NAM for the field exercise. Formal commendatory material on file.');
    expect(all).toContain('Non Rec / Adverse');
    expect(all).toContain('NJP or court-martial during the reporting period NJP on 3 Aug 26 for UA.');
    expect(all).toContain('not adverse and do not by themselves NOT REC');
    // Descriptors are editor-only (owner decision).
    expect(all).not.toContain('bias for action');
    expect(all).not.toContain('Competency Review Board (CRB). Documented');
  });

  it('places the section between Performance and the targets review', () => {
    const model = counselingFormModel(form({ counselingMarineGrade: 'E-4', ...bench({ mos: { mark: '2.5' } }) }));
    expect(model.benchmark).toHaveLength(3);
    expect(model.benchmark![1]).toMatchObject({ attribute: 'MOS Proficiency and/or Mission Accomplishment', mark: '2.5', band: 'Meets Expectations', prior: '', justification: '' });
    expect(model.benchmark![0].mark).toBe('');
  });
});
