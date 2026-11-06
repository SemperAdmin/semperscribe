// @vitest-environment node
/**
 * Page 11 - Basic Needs Allowance (BNA) Screening, from the owner's
 * example entry (2026-11-06): DODI 1341.15 and the current MARADMIN,
 * paragraphs 1 and 2 with lettered subparagraphs a to f, signed by the
 * service member. It must open from the library, print in the left
 * column with the signature line and its "SNM" label together, keep the
 * subparagraph indents, and take its date and MARADMIN number from a
 * Batch Generate roster.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registerNodeAssets } from './node-assets';
import { extractPdfTextLayout } from './golden/helpers';
import { flowPage11, columnLines } from '@/lib/page11-flow';
import { generateNavmc11811 } from '@/services/pdf/navmc11811Generator';
import { applyMergeRecord, defaultMergeFormKeys, detectMergeFields, findTemplatePlaceholders, mergedRowProblems } from '@/lib/merge-utils';
import { Page11Schema } from '@/lib/schemas';
import type { FormData } from '@/types';

beforeAll(() => registerNodeAssets());

const DIR = join(__dirname, '..', 'public', 'templates', 'global');
const pkg = JSON.parse(readFileSync(join(DIR, 'page11-bna-screening.nldp'), 'utf-8'));
const template = pkg.data.formData as FormData;
const entry = template.remarksLeft as string;
const index = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf-8')) as { id: string; documentType: string; url: string }[];

describe('BNA Page 11 template', () => {
  it('is listed with the other Page 11 entries and opens as a blank Page 11', () => {
    const at = index.findIndex((r) => r.id === 'page11-bna-screening');
    expect(at).toBeGreaterThan(-1);
    expect(index[at]).toMatchObject({ documentType: 'page11', url: '/templates/global/page11-bna-screening.nldp' });
    expect(index[at - 1].documentType).toBe('page11');
    expect(pkg.metadata.package.documentType).toBe('page11');
    expect(template).toMatchObject({ documentType: 'page11', name: '', edipi: '', remarksRight: '' });
  });

  it('carries the owner\'s wording', () => {
    expect(entry.startsWith('__________: In accordance with DODI 1341.15 and  MARADMIN (insert latest MARADMIN number), I have received notification')).toBe(true);
    for (const l of ['a', 'b', 'c', 'd', 'e', 'f']) expect(entry).toContain(`\n\n    ${l}.  `);
    expect(entry).toContain('must be submitted within 180 days of the date of signing this document.');
    expect(entry).toContain('Applications must be submitted within 180 days of arrival at your first PDS.');
    expect(entry.endsWith('may qualify.\n\n___________________\nSNM')).toBe(true);
    expect(entry).not.toMatch(/[ \t]+\n/);
  });

  it('fits the left column with the signature line and SNM together, subparagraphs indented', () => {
    const flow = flowPage11(entry, '');
    expect(flow.pages).toHaveLength(1);
    expect(flow.columnsUsed).toBe(1);
    const left = columnLines(flow.pages[0].left);
    expect(left.slice(-2)).toEqual(['___________________', 'SNM']);
    expect(left.filter((l) => /^ {4}[a-f]\.  /.test(l))).toHaveLength(6);
  });

  it('renders one page with the subparagraphs set in from paragraph 1 and SNM in the left column', async () => {
    const bytes = await generateNavmc11811({ name: 'DOE, JOHN M.', edipi: '1234567890', remarksLeft: entry, remarksRight: '' });
    const items = await extractPdfTextLayout(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
    expect(Math.max(...items.map((i) => i.page))).toBe(1);
    const xOf = (re: RegExp) => items.find((i) => re.test(i.text.trimStart()))!;
    const para1 = xOf(/^1\.\s+Based on precursory/);
    const subA = xOf(/^a\.\s+This notification/);
    expect(subA.x).toBeGreaterThan(para1.x + 5);
    const snm = items.find((i) => i.text.trim() === 'SNM')!;
    expect(snm.x).toBeLessThan(300);
  }, 60_000);

  it('takes its date and MARADMIN number from a roster and leaves the signature line alone', () => {
    expect(findTemplatePlaceholders(template).map((b) => b.column)).toEqual(['DATE', 'INSERT_LATEST_MARADMIN_NUMBER']);
    const fields = detectMergeFields(template, [], defaultMergeFormKeys('page11'));
    const { formData } = applyMergeRecord(template, [], {
      NAME: 'DOE, JOHN M.', EDIPI: '0987654321', DATE: '20261106', INSERT_LATEST_MARADMIN_NUMBER: '123/26',
    }, fields);
    expect(mergedRowProblems(formData)).toEqual([]);
    expect(Page11Schema.safeParse(formData).success).toBe(true);
    expect((formData.remarksLeft as string).startsWith('20261106: In accordance with DODI 1341.15 and  MARADMIN 123/26, I have')).toBe(true);
    expect((formData.remarksLeft as string).endsWith('\n___________________\nSNM')).toBe(true);
  });
});
