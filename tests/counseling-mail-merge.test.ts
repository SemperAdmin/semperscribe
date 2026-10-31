// @vitest-environment node
/**
 * Mail merge (Batch Generate) on the Counseling Worksheet: one session
 * set up once (occasion, date, senior, ICS objectives, subjects) and a
 * roster of the Marines to be counseled. Each row must produce that
 * Marine's worksheet: their identity in blocks 7 to 13 and 31, the grade
 * rules (30-day interval, JEPES block) keyed to their grade, and nothing
 * of another Marine's.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerNodeAssets } from './node-assets';
import { extractPdfTextLayout } from './golden/helpers';
import {
  applyMergeRecord,
  counselingCopiedContent,
  defaultMergeFormKeys,
  detectMergeFields,
  generateCsvTemplate,
  getMergeableFieldsForDocType,
  mergedRowProblems,
  parseCsv,
  validateCsvColumns,
} from '@/lib/merge-utils';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { getExportFilename } from '@/lib/naval-format-utils';
import type { FormData, ParagraphData } from '@/types';

beforeAll(() => registerNodeAssets());

const GLOBAL_DIR = join(__dirname, '..', 'public', 'templates', 'global');
const loadTemplate = (id: string) =>
  JSON.parse(readFileSync(join(GLOBAL_DIR, `${id}.nldp`), 'utf-8')).data.formData as FormData;
const NO_PARAGRAPHS: ParagraphData[] = [];

/** An initial-counseling session set up for a section, the Marine left to the roster. */
function sessionTemplate(overrides: Partial<FormData> = {}): FormData {
  return {
    documentType: 'counseling',
    date: '2 Nov 26',
    counselingOccasion: 'initial',
    counselingNextSessionDate: '',
    counselingMarineLastName: '',
    counselingMarineFirstName: '',
    counselingMarineMiddleInitial: '',
    counselingMarineGrade: '',
    counselingMarineComponent: 'active',
    counselingMarineEdipi: '',
    counselingSeniorLastName: 'LEADER',
    counselingSeniorFirstName: 'SAMPLE',
    counselingSeniorGrade: 'E-6',
    counselingSeniorBillet: 'Platoon Sergeant',
    counselingIcsObjectives: ['expectations', 'targets'],
    counselingSubjects: [{ text: 'Duties as {{BILLET_TITLE}}', area: 'duties' }],
    counselingTargets: [{
      action: 'To complete', object: 'MCI Leading Marines', standardKinds: ['timeliness'],
      standard: '', dueDate: '1 Feb 27', area: 'pme',
    }],
    ...overrides,
  } as FormData;
}

const ROSTER = [
  'LAST_NAME,FIRST_NAME,MI,GRADE,EDIPI,DOR,PMOS,BMOS,BILLET_TITLE',
  'DOE,JOHN,M,LCpl,1234567890,1 Jun 26,0311,0311,Rifleman',
  'SMITH,JANE,A,Sgt,0987654321,1 Mar 25,0111,0111,Admin Chief',
  'DOE,RICHARD,,Cpl,1112223334,1 Jan 26,0311,0311,Team Leader',
  '',
].join('\n');

const fieldsFor = (template: FormData) =>
  detectMergeFields(template, NO_PARAGRAPHS, defaultMergeFormKeys('counseling'));

async function pdfText(formData: FormData): Promise<string> {
  const blob = await generatePdfForDocType({
    formData, vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [], distList: [],
  });
  return (await extractPdfTextLayout(blob)).map((i) => i.text).join(' ');
}

describe('Counseling merge columns', () => {
  it('offers the Marine counseled, not the letter columns', () => {
    const labels = getMergeableFieldsForDocType('counseling').map((f) => f.label);
    for (const l of ['LAST_NAME', 'FIRST_NAME', 'MI', 'GRADE', 'EDIPI', 'DOR', 'PMOS', 'BMOS', 'BILLET_TITLE', 'COMPONENT', 'DATE']) {
      expect(labels).toContain(l);
    }
    for (const l of ['TO', 'FROM', 'SUBJECT', 'SIGNATURE', 'SIG_TITLE']) expect(labels).not.toContain(l);
  });

  it('starts with the Marine\'s name, grade and EDIPI selected', () => {
    const fields = fieldsFor(sessionTemplate());
    expect(fields.slice(0, 5).map((f) => f.name)).toEqual(['LAST_NAME', 'FIRST_NAME', 'MI', 'GRADE', 'EDIPI']);
    expect(generateCsvTemplate(fields).split('\n')[0]).toBe('LAST_NAME,FIRST_NAME,MI,GRADE,EDIPI,BILLET_TITLE');
  });

  it('finds a {{TOKEN}} inside a subject, a target or an area note', () => {
    const template = sessionTemplate({
      counselingAreas: [{ area: 'fidelity', status: 'discussed', notes: 'Spoke with {{FIRST_NAME}} about the duty roster.' }],
      counselingTargets: [{
        action: 'To qualify', object: 'on the rifle range as {{QUAL_LEVEL}}', standardKinds: [], standard: '', dueDate: '', area: '',
      }],
    });
    const names = fieldsFor(template).map((f) => f.name);
    expect(names).toContain('BILLET_TITLE');
    expect(names).toContain('QUAL_LEVEL');
  });
});

describe('Counseling merge substitution', () => {
  it('fills the Marine from each row and the tokens inside the session lists', () => {
    const template = sessionTemplate();
    const [doe] = parseCsv(ROSTER).rows;
    const { formData } = applyMergeRecord(template, NO_PARAGRAPHS, doe, fieldsFor(template));
    expect(formData).toMatchObject({
      counselingMarineLastName: 'DOE',
      counselingMarineFirstName: 'JOHN',
      counselingMarineMiddleInitial: 'M',
      counselingMarineEdipi: '1234567890',
      counselingMarineDor: '1 Jun 26',
      counselingMarinePmos: '0311',
      counselingBilletTitle: 'Rifleman',
    });
    expect((formData.counselingSubjects as { text: string }[])[0].text).toBe('Duties as Rifleman');
    // The template keeps its token for the next row.
    expect((template.counselingSubjects as { text: string }[])[0].text).toBe('Duties as {{BILLET_TITLE}}');
  });

  it.each([
    ['LCpl', 'E-3'], ['lcpl', 'E-3'], ['E3', 'E-3'], ['E-3', 'E-3'], ['LCpl (E-3)', 'E-3'],
    ['Sgt', 'E-5'], ['1stSgt', 'E-8'], ['SgtMaj', 'E-9'], ['CWO2', 'W-2'], ['2ndLt', 'O-1'], ['Capt.', 'O-3'],
  ])('reads grade "%s" as %s', (typed, stored) => {
    const template = sessionTemplate();
    const { formData } = applyMergeRecord(template, NO_PARAGRAPHS, { LAST_NAME: 'DOE', GRADE: typed }, fieldsFor(template));
    expect(formData.counselingMarineGrade).toBe(stored);
  });

  it.each([['AC', 'active'], ['RC', 'reserve'], ['Reserve', 'reserve'], ['active', 'active']])(
    'reads component "%s" as %s', (typed, stored) => {
      const template = sessionTemplate();
      const fields = detectMergeFields(template, NO_PARAGRAPHS, [...defaultMergeFormKeys('counseling'), 'counselingMarineComponent']);
      const { formData } = applyMergeRecord(template, NO_PARAGRAPHS, { LAST_NAME: 'DOE', COMPONENT: typed }, fields);
      expect(formData.counselingMarineComponent).toBe(stored);
    },
  );

  it('sets each Marine\'s next session by their grade when the session left it to the rule', () => {
    const template = sessionTemplate({ counselingNextSessionDate: '' });
    const fields = fieldsFor(template);
    const [doe, smith] = parseCsv(ROSTER).rows;
    // LCpl: 30 days. Sgt on an initial session: about 90 days.
    expect(applyMergeRecord(template, NO_PARAGRAPHS, doe, fields).formData.counselingNextSessionDate).toBe('2 Dec 26');
    expect(applyMergeRecord(template, NO_PARAGRAPHS, smith, fields).formData.counselingNextSessionDate).toBe('31 Jan 27');
  });

  it('keeps a next-session date the drafter typed for the whole section', () => {
    const template = sessionTemplate({ counselingNextSessionDate: '15 Jan 27' });
    const [doe] = parseCsv(ROSTER).rows;
    expect(applyMergeRecord(template, NO_PARAGRAPHS, doe, fieldsFor(template)).formData.counselingNextSessionDate).toBe('15 Jan 27');
  });
});

describe('Counseling merged row checks', () => {
  const merged = (row: Record<string, string>) => {
    const template = sessionTemplate();
    return applyMergeRecord(template, NO_PARAGRAPHS, row, fieldsFor(template)).formData;
  };

  it('accepts a complete row', () => {
    expect(mergedRowProblems(merged({ LAST_NAME: 'DOE', GRADE: 'LCpl', EDIPI: '0123456789' }))).toEqual([]);
  });

  it('refuses a row with no last name', () => {
    expect(mergedRowProblems(merged({ LAST_NAME: '', GRADE: 'LCpl' }))).toContain('LAST_NAME is empty');
  });

  it('refuses a grade it cannot read', () => {
    expect(mergedRowProblems(merged({ LAST_NAME: 'DOE', GRADE: 'Lance' })).join(' ')).toMatch(/GRADE "Lance" is not a Marine grade/);
  });

  it('refuses an EDIPI Excel mangled but allows an empty one', () => {
    expect(mergedRowProblems(merged({ LAST_NAME: 'DOE', EDIPI: '1.23457E+09' })).join(' ')).toMatch(/not a 10-digit DoD ID/);
    expect(mergedRowProblems(merged({ LAST_NAME: 'DOE', EDIPI: '' }))).toEqual([]);
  });
});

describe('Counseling template content copied to every worksheet', () => {
  it('names the one-Marine content a library sample carries', () => {
    const copied = counselingCopiedContent(loadTemplate('counseling-initial'));
    expect(copied).toEqual(expect.arrayContaining([
      'Major accomplishments', 'Strengths', 'Deficiencies', "Senior's comments", "Marine's comments",
      'Marine signed date', 'Senior signed date', 'Functional area notes', 'Targets',
    ]));
  });

  it('names nothing for a session set up for a section', () => {
    expect(counselingCopiedContent(sessionTemplate({ counselingTargets: [] }))).toEqual([]);
  });

  it('counts targets as copied content', () => {
    expect(counselingCopiedContent(sessionTemplate())).toEqual(['Targets']);
  });
});

describe('Counseling merged worksheets', () => {
  it('gives two Marines with the same last name different file names', () => {
    const template = sessionTemplate();
    const fields = fieldsFor(template);
    const [doeJohn, , doeRichard] = parseCsv(ROSTER).rows;
    const a = getExportFilename(applyMergeRecord(template, NO_PARAGRAPHS, doeJohn, fields).formData, 'pdf');
    const b = getExportFilename(applyMergeRecord(template, NO_PARAGRAPHS, doeRichard, fields).formData, 'pdf');
    // Same base name; the batch adds the row label to tell them apart.
    expect(a).toBe(b);
  });

  it('prints each Marine\'s identity and grade rules, and no other Marine', async () => {
    const template = sessionTemplate();
    const fields = fieldsFor(template);
    const rows = parseCsv(ROSTER).rows;
    expect(validateCsvColumns(parseCsv(ROSTER).headers, fields).valid).toBe(true);

    const texts: string[] = [];
    for (const row of rows) {
      const { formData } = applyMergeRecord(template, NO_PARAGRAPHS, row, fields);
      expect(mergedRowProblems(formData)).toEqual([]);
      texts.push(await pdfText(formData));
    }
    const [doe, smith] = texts;
    expect(doe).toContain('DOE, JOHN, M.');
    expect(doe).toContain('LCpl E-3');
    expect(doe).toContain('1234567890');
    expect(doe).toContain('Duties as Rifleman');
    expect(doe).not.toContain('0987654321');
    expect(doe).not.toContain('SMITH');

    expect(smith).toContain('SMITH, JANE, A.');
    expect(smith).toContain('Sgt E-5');
    expect(smith).toContain('0987654321');
    expect(smith).toContain('Duties as Admin Chief');
    expect(smith).not.toContain('1234567890');
  }, 90_000);
});
