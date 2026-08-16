/**
 * Salutation render parity (SECNAV M-5216.5 Fig 11-1).
 *
 * Regression lock for a preview/export divergence: all three PDF
 * renderers substituted the literal "Dear Sir or Madam:" for an empty
 * salutation while the DOCX emitters wrote nothing, so the live
 * preview showed a greeting the exported Word file did not contain.
 * The placeholder is gone from every emitter; an empty salutation is
 * now reported by validateSalutation instead of being papered over.
 */
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generateDocxBlob } from '@/lib/docx-generator';
import { validateSalutation, validateSchemaFields } from '@/lib/schema-validators';
import { runLetterValidators } from '@/lib/letter-validators';

const PLACEHOLDER = 'Dear Sir or Madam';

const BASE = {
  ssic: '5720',
  originatorCode: 'JA',
  date: 'August 14, 2026',
  recipientName: 'Mr. John Doe',
  recipientTitle: 'Director',
  recipientAddress: '123 Main St\nWashington, DC 20374',
  subj: 'FOIA APPEAL',
  sig: 'S. A. SHORTER',
  complimentaryClose: 'Sincerely,',
  line1: 'DEPARTMENT OF THE NAVY',
  line2: 'OFFICE OF THE JUDGE ADVOCATE GENERAL',
  line3: 'WASHINGTON NAVY YARD, DC 20374',
  bodyFont: 'Times New Roman',
} as any;

const PARAGRAPHS = [{ id: '1', level: 1, content: 'Body text of the letter.', title: '' }] as any;

const SALUTATION_TYPES = [
  'business-letter',
  'executive-correspondence',
  'dla-business-letter',
];

async function docxXml(formData: any): Promise<string> {
  const blob = await generateDocxBlob(formData, [], [], [], [], PARAGRAPHS, []);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return zip.file('word/document.xml')!.async('string');
}

describe('DOCX salutation', () => {
  it.each(SALUTATION_TYPES)('%s writes no placeholder when the field is empty', async (documentType) => {
    const xml = await docxXml({ ...BASE, documentType, salutation: '' });
    expect(xml).not.toContain(PLACEHOLDER);
  });

  it.each(SALUTATION_TYPES)('%s writes the drafter\'s salutation once', async (documentType) => {
    const xml = await docxXml({ ...BASE, documentType, salutation: 'Dear Mr. Doe:' });
    expect(xml).toContain('Dear Mr. Doe:');
    expect(xml).not.toContain(PLACEHOLDER);
  });
});

describe('validateSalutation', () => {
  it.each(SALUTATION_TYPES)('%s reports an empty salutation as non-compliant', (documentType) => {
    const issues = validateSalutation({ ...BASE, documentType, salutation: '' });
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('salutation-missing');
    expect(issues[0].severity).toBe('fail');
  });

  it('treats whitespace as empty', () => {
    const issues = validateSalutation({ ...BASE, documentType: 'business-letter', salutation: '   ' });
    expect(issues).toHaveLength(1);
  });

  it.each(SALUTATION_TYPES)('%s is silent once the field is filled', (documentType) => {
    expect(validateSalutation({ ...BASE, documentType, salutation: 'Dear Mr. Doe:' })).toHaveLength(0);
  });

  it('never fires on a document type with no salutation', () => {
    expect(validateSalutation({ ...BASE, documentType: 'basic', salutation: '' })).toHaveLength(0);
  });

  it('reports exactly one issue for an empty salutation, not a schema duplicate', () => {
    const ids = runLetterValidators({ ...BASE, documentType: 'business-letter', salutation: '' }, [], [], [])
      .map((i) => i.id)
      .filter((id) => id.toLowerCase().includes('salutation'));
    expect(ids).toEqual(['salutation-missing']);
  });
});

describe('validateSchemaFields', () => {
  it('reports the required fields the schema declares', () => {
    const issues = validateSchemaFields({
      documentType: 'business-letter',
      ssic: '',
      originatorCode: '',
      date: '',
      recipientName: '',
      recipientAddress: '',
      salutation: '',
      sig: '',
    } as any);
    const paths = issues.map((i) => i.id.replace('schema-business-letter-', ''));
    expect(paths).toContain('recipientName');
    expect(paths).toContain('ssic');
    expect(paths).toContain('sig');
    // Suppressed: salutation has its own cited rule, documentType is
    // an app wiring concern rather than a drafter error.
    expect(paths).not.toContain('salutation');
    expect(paths).not.toContain('documentType');
  });

  it('is silent on a complete document', () => {
    expect(validateSchemaFields({ ...BASE, documentType: 'business-letter', salutation: 'Dear Mr. Doe:' })).toHaveLength(0);
  });

  it('never blocks export', () => {
    const severities = validateSchemaFields({ documentType: 'business-letter' } as any).map((i) => i.severity);
    expect(severities).not.toContain('block');
  });
});
