// @vitest-environment node
/**
 * Mail merge (Batch Generate) on the NAVMC 118(11) Page 11: the CSV
 * template, the CSV import, the per-row substitution, and the PDF each
 * row renders to. One template entry plus a roster CSV must produce one
 * Page 11 per Marine, each carrying that Marine's name and DoD ID on
 * the form and in the remarks, and nothing from any other row.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerNodeAssets } from './node-assets';
import { extractPdfTextLayout } from './golden/helpers';
import {
  applyMergeRecord,
  defaultMergeFormKeys,
  detectMergeFields,
  generateCsvTemplate,
  getMergeableFieldsForDocType,
  mergedRowProblems,
  parseCsv,
  validateCsvColumns,
} from '@/lib/merge-utils';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { getExportBlockers } from '@/lib/letter-validators';
import { Page11Schema } from '@/lib/schemas';
import type { FormData, ParagraphData } from '@/types';

beforeAll(() => registerNodeAssets());

/** A Page 11 template the way a drafter sets one up for a merge. */
function page11Template(overrides: Partial<FormData> = {}): FormData {
  return {
    documentType: 'page11',
    name: '',
    edipi: '',
    date: '',
    remarksLeft:
      '{{DATE}}: 6105 COUNSELING. {{RANK}} {{NAME}} was counseled this date concerning '
      + 'failure to obey a lawful order. Recommendations for corrective action: comply '
      + 'with all lawful orders.',
    remarksRight: '',
    ...overrides,
  } as FormData;
}

const ROSTER_CSV = [
  'NAME,EDIPI,DATE,RANK',
  '"DOE, JOHN M.",1234567890,01 Mar 26,LCpl',
  '"SMITH, JANE A.",0987654321,02 Mar 26,Cpl',
  '"O\'BRIEN, PAT",1112223334,03 Mar 26,Pvt',
  '',
].join('\n');

const NO_PARAGRAPHS: ParagraphData[] = [];

async function pdfText(formData: FormData): Promise<string> {
  const blob = await generatePdfForDocType({
    formData,
    vias: [],
    references: [],
    enclosures: [],
    copyTos: [],
    paragraphs: [],
    distList: [],
  });
  const items = await extractPdfTextLayout(blob);
  return items.map((i) => i.text).join(' ');
}

function mergeFieldsFor(template: FormData) {
  return detectMergeFields(template, NO_PARAGRAPHS, ['name', 'edipi', 'date']);
}

describe('Page 11 merge fields', () => {
  it('offers NAME, EDIPI and DATE as the Page 11 form columns', () => {
    expect(getMergeableFieldsForDocType('page11').map((f) => f.label).sort()).toEqual(['DATE', 'EDIPI', 'NAME']);
  });

  it('adds every {{TOKEN}} typed into the remarks columns', () => {
    const template = page11Template({ remarksRight: 'Witnessed by {{WITNESS}}.' });
    const names = mergeFieldsFor(template).map((f) => f.name);
    expect(names).toEqual(['NAME', 'EDIPI', 'DATE', 'RANK', 'WITNESS']);
  });

  it('writes a CSV template whose header row parses back to the same columns', () => {
    const fields = mergeFieldsFor(page11Template());
    const csv = generateCsvTemplate(fields);
    const parsed = parseCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.headers).toEqual(['NAME', 'EDIPI', 'DATE', 'RANK']);
    // The example row is a valid Page 11 identity.
    expect(parsed.rows[0].NAME).toBe('DOE, JOHN M.');
    expect(parsed.rows[0].EDIPI).toMatch(/^\d{10}$/);
  });
});

describe('Page 11 roster CSV import', () => {
  it('reads quoted LAST, FIRST MI names and keeps leading zeros in the EDIPI', () => {
    const parsed = parseCsv(ROSTER_CSV);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0]).toMatchObject({ NAME: 'DOE, JOHN M.', EDIPI: '1234567890' });
    expect(parsed.rows[1]).toMatchObject({ NAME: 'SMITH, JANE A.', EDIPI: '0987654321' });
    expect(parsed.rows[2].NAME).toBe("O'BRIEN, PAT");
    expect(validateCsvColumns(parsed.headers, mergeFieldsFor(page11Template())).valid).toBe(true);
  });

  it('reports a row with a stray comma and skips it instead of shifting columns', () => {
    const parsed = parseCsv('NAME,EDIPI,DATE,RANK\nDOE, JOHN M.,1234567890,01 Mar 26,LCpl\n');
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.errors[0]).toMatch(/Row 2: expected 4 columns, got 5/);
  });

  it('accepts a header row saved by Excel as "CSV UTF-8", which starts with a byte-order mark', () => {
    const parsed = parseCsv('\uFEFF' + ROSTER_CSV);
    expect(parsed.headers[0]).toBe('NAME');
    expect(validateCsvColumns(parsed.headers, mergeFieldsFor(page11Template())).valid).toBe(true);
  });

  it('keeps a multi-line remarks cell (quoted, with line breaks) as one row', () => {
    const csv = 'NAME,EDIPI,ENTRY\n"DOE, JOHN M.",1234567890,"First paragraph.\n\nSecond paragraph."\n';
    const parsed = parseCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].ENTRY).toBe('First paragraph.\n\nSecond paragraph.');
  });

  it('reads a Windows (CRLF) roster, line breaks inside a quoted cell included', () => {
    const csv = 'NAME,EDIPI,ENTRY\r\n"DOE, JOHN M.",1234567890,"Line one.\r\nLine two."\r\n"SMITH, JANE A.",0987654321,Short.\r\n';
    const parsed = parseCsv(csv);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toEqual([
      { NAME: 'DOE, JOHN M.', EDIPI: '1234567890', ENTRY: 'Line one.\nLine two.' },
      { NAME: 'SMITH, JANE A.', EDIPI: '0987654321', ENTRY: 'Short.' },
    ]);
  });
});

describe('Page 11 merge substitution', () => {
  it('fills name, EDIPI and date and every remarks token from the row', () => {
    const template = page11Template({ remarksRight: '{{RANK}} {{NAME}} acknowledged.' });
    const fields = mergeFieldsFor(template);
    const [row] = parseCsv(ROSTER_CSV).rows;
    const { formData } = applyMergeRecord(template, NO_PARAGRAPHS, row, fields);
    expect(formData.name).toBe('DOE, JOHN M.');
    expect(formData.edipi).toBe('1234567890');
    expect(formData.date).toBe('01 Mar 26');
    expect(formData.remarksLeft).toMatch(/^01 Mar 26: 6105 COUNSELING\. LCpl DOE, JOHN M\. was counseled/);
    expect(formData.remarksRight).toBe('LCpl DOE, JOHN M. acknowledged.');
    expect(formData.remarksLeft).not.toContain('{{');
  });

  it('leaves the template untouched so every row starts from the same entry', () => {
    const template = page11Template();
    const before = JSON.stringify(template);
    const fields = mergeFieldsFor(template);
    for (const row of parseCsv(ROSTER_CSV).rows) applyMergeRecord(template, NO_PARAGRAPHS, row, fields);
    expect(JSON.stringify(template)).toBe(before);
  });

  it('matches tokens regardless of case and inner spacing', () => {
    const template = page11Template({ remarksLeft: '{{ name }} / {{Rank}}' });
    const { formData } = applyMergeRecord(template, NO_PARAGRAPHS, { NAME: 'DOE, JOHN M.', RANK: 'LCpl' }, []);
    expect(formData.remarksLeft).toBe('DOE, JOHN M. / LCpl');
  });

  it('leaves a token with no CSV column visible rather than blanking it', () => {
    const template = page11Template({ remarksLeft: 'Witness: {{WITNESS}}' });
    const { formData } = applyMergeRecord(template, NO_PARAGRAPHS, { NAME: 'DOE, JOHN M.' }, []);
    expect(formData.remarksLeft).toBe('Witness: {{WITNESS}}');
  });

  it('carries $ characters in a value through literally', () => {
    const template = page11Template({ remarksLeft: 'Debt: {{AMOUNT}}' });
    const { formData } = applyMergeRecord(template, NO_PARAGRAPHS, { AMOUNT: '$1,250.00 ($& owed)' }, []);
    expect(formData.remarksLeft).toBe('Debt: $1,250.00 ($& owed)');
  });

  it('produces a row the Page 11 schema accepts (10-digit EDIPI)', () => {
    const template = page11Template();
    const fields = mergeFieldsFor(template);
    for (const row of parseCsv(ROSTER_CSV).rows) {
      const { formData } = applyMergeRecord(template, NO_PARAGRAPHS, row, fields);
      expect(Page11Schema.safeParse(formData).success).toBe(true);
    }
  });

  it('has no export blockers on the Page 11 template', () => {
    expect(getExportBlockers(page11Template(), [], [], NO_PARAGRAPHS)).toEqual([]);
  });
});

describe('Page 11 merged PDFs', () => {
  it('renders one Page 11 per row with that Marine on the form and in the remarks, and no other row', async () => {
    const template = page11Template();
    const fields = mergeFieldsFor(template);
    const rows = parseCsv(ROSTER_CSV).rows;
    const texts: string[] = [];
    for (const row of rows) {
      const { formData } = applyMergeRecord(template, NO_PARAGRAPHS, row, fields);
      texts.push(await pdfText(formData));
    }

    rows.forEach((row, i) => {
      const text = texts[i];
      // Name block (upper-cased by the generator) and DoD ID block.
      expect(text).toContain(row.NAME.toUpperCase());
      expect(text).toContain(row.EDIPI);
      // Remarks: the date, rank and name substituted into the entry.
      expect(text).toContain(`${row.DATE}: 6105 COUNSELING.`);
      expect(text).toContain(`${row.RANK} ${row.NAME}`);
      expect(text).not.toContain('{{');
      // No identity from another row leaks into this Marine's page.
      rows.filter((_, j) => j !== i).forEach((other) => {
        expect(text).not.toContain(other.EDIPI);
        expect(text).not.toContain(other.NAME);
      });
    });
  }, 60_000);

  it('repeats the name and EDIPI on every continuation page of a long merged entry', async () => {
    const longEntry = Array.from({ length: 160 }, (_, i) => `{{NAME}} sentence ${i + 1} of a long entry.`).join(' ');
    const template = page11Template({ remarksLeft: longEntry });
    const { formData } = applyMergeRecord(
      template,
      NO_PARAGRAPHS,
      { NAME: 'DOE, JOHN M.', EDIPI: '1234567890', DATE: '01 Mar 26' },
      mergeFieldsFor(template),
    );
    const blob = await generatePdfForDocType({
      formData, vias: [], references: [], enclosures: [], copyTos: [], paragraphs: [], distList: [],
    });
    const items = await extractPdfTextLayout(blob);
    const pages = Math.max(...items.map((i) => i.page));
    expect(pages).toBeGreaterThan(1);
    for (let p = 1; p <= pages; p++) {
      const onPage = items.filter((i) => i.page === p).map((i) => i.text).join(' ');
      expect(onPage).toContain('1234567890');
      expect(onPage).toContain('DOE, JOHN M.');
    }
    // Every sentence made it onto some page.
    const all = items.map((i) => i.text).join(' ');
    expect(all).toContain('sentence 160 of a long entry.');
  }, 60_000);
});

describe('Page 11 template plus a name/EDIPI spreadsheet', () => {
  const GLOBAL_DIR = join(__dirname, '..', 'public', 'templates', 'global');
  const loadTemplate = (id: string) =>
    JSON.parse(readFileSync(join(GLOBAL_DIR, `${id}.nldp`), 'utf-8')).data.formData as FormData;

  it('starts a Page 11 merge with NAME and EDIPI selected, other types with none', () => {
    expect(defaultMergeFormKeys('page11')).toEqual(['name', 'edipi']);
    expect(defaultMergeFormKeys('basic')).toEqual([]);
    expect(defaultMergeFormKeys(undefined)).toEqual([]);
  });

  it('fills a library template\'s blank name and EDIPI from each row and keeps its entry text', async () => {
    const template = loadTemplate('page11-6105-warning');
    expect(template.documentType).toBe('page11');
    expect(template.name).toBe('');
    expect(template.edipi).toBe('');

    const fields = detectMergeFields(template, NO_PARAGRAPHS, defaultMergeFormKeys('page11'));
    expect(fields.map((f) => f.name)).toEqual(['NAME', 'EDIPI']);
    const csv = generateCsvTemplate(fields);
    expect(csv.split('\n')[0]).toBe('NAME,EDIPI');

    const roster = parseCsv('NAME,EDIPI\n"DOE, JOHN M.",1234567890\n"SMITH, JANE A.",0987654321\n');
    expect(validateCsvColumns(roster.headers, fields).valid).toBe(true);

    for (const row of roster.rows) {
      const { formData } = applyMergeRecord(template, NO_PARAGRAPHS, row, fields);
      expect(mergedRowProblems(formData)).toEqual([]);
      expect(formData.remarksLeft).toBe(template.remarksLeft);
      const text = await pdfText(formData);
      expect(text).toContain(row.NAME);
      expect(text).toContain(row.EDIPI);
      expect(text).toContain('Counseled this date concerning the following deficiencies');
    }
  }, 60_000);
});

describe('Page 11 merged row checks', () => {
  const merged = (name: string, edipi: string) => ({ ...page11Template(), name, edipi }) as FormData;

  it('accepts a name and a 10-digit EDIPI with a leading zero', () => {
    expect(mergedRowProblems(merged('SMITH, JANE A.', '0987654321'))).toEqual([]);
  });

  it.each([
    ['dropped leading zero', '987654321'],
    ['Excel scientific notation', '1.23457E+09'],
    ['eleven digits', '12345678901'],
    ['spaces around it', ' 1234567890'],
    ['dashes', '123-456-7890'],
  ])('refuses an EDIPI with %s', (_label, edipi) => {
    const problems = mergedRowProblems(merged('DOE, JOHN M.', edipi));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`EDIPI "${edipi}" is not a 10-digit DoD ID`);
  });

  it('refuses an empty name or EDIPI', () => {
    expect(mergedRowProblems(merged('', '1234567890'))).toEqual(['NAME is empty']);
    expect(mergedRowProblems(merged('DOE, JOHN M.', ''))).toEqual(['EDIPI is empty']);
  });

  it('checks nothing on other document types', () => {
    expect(mergedRowProblems({ documentType: 'basic', edipi: '12' } as FormData)).toEqual([]);
  });
});
