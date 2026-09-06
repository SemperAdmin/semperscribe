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
