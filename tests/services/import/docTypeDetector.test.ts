import { describe, it, expect } from 'vitest';
import { detectDocumentType } from '@/services/import/docTypeDetector';
import { linesFromText } from '@/services/import/correspondenceParser';
import { ExtractedText } from '@/services/import/extractionTypes';

function detect(raw: string) {
  const text: ExtractedText = { lines: linesFromText(raw), sourceFormat: 'text', warnings: [] };
  return detectDocumentType(text);
}

describe('detectDocumentType — supported types', () => {
  it('detects a basic letter from its From/To/Subj anchors', () => {
    const result = detect(`
UNITED STATES MARINE CORPS
3D MARINE DIVISION
5216
From: Commanding Officer
To: Commanding General
Subj: STANDARD SUBJECT
1. Body.
`);
    expect(result).toMatchObject({ documentType: 'basic', confidence: 'high', warnings: [] });
  });

  it('detects a memorandum for the record', () => {
    const result = detect(`
UNITED STATES MARINE CORPS
MEMORANDUM FOR THE RECORD
From: Company Commander
Subj: RECORD OF EVENT
1. Body.
`);
    expect(result).toMatchObject({ documentType: 'mfr', confidence: 'high' });
  });

  it('detects a letterhead memo from MEMORANDUM FOR an addressee', () => {
    const result = detect(`
UNITED STATES MARINE CORPS
MEMORANDUM FOR THE ASSISTANT COMMANDANT
Subj: TASKING
1. Body.
`);
    expect(result).toMatchObject({ documentType: 'letterhead-memo', confidence: 'high' });
  });

  it('detects a letterhead memo from a bare MEMORANDUM heading with letterhead', () => {
    const result = detect(`
DEPARTMENT OF THE NAVY
MEMORANDUM
Subj: TASKING
1. Body.
`);
    expect(result).toMatchObject({ documentType: 'letterhead-memo', confidence: 'high' });
  });

  it('detects a from-to memo from MEMORANDUM plus From/To on plain paper', () => {
    const result = detect(`
MEMORANDUM
From: Branch Head
To: Section Lead
Subj: PLAIN PAPER MEMO
1. Body.
`);
    expect(result).toMatchObject({ documentType: 'from-to-memo', confidence: 'high' });
  });

  it('flags a bare MEMORANDUM with no letterhead and no From/To as low confidence', () => {
    const result = detect(`
MEMORANDUM
Subj: AMBIGUOUS
1. Body.
`);
    expect(result).toMatchObject({ documentType: 'letterhead-memo', confidence: 'low' });
  });
});

describe('detectDocumentType — recognized but unsupported types', () => {
  const cases: [string, string, string][] = [
    ['endorsement', 'FIRST ENDORSEMENT on CO 3d MarDiv ltr 5216 of 16 Feb 26', 'endorsement'],
    ['Marine Corps Order', 'MARINE CORPS ORDER 5215.1K', 'Marine Corps Order'],
    ['MCO short form', 'MCO 5215.1K', 'Marine Corps Order'],
    ['bulletin', 'MCBUL 5210', 'Bulletin'],
    ['NAVMC form', 'NAVMC 10274', 'NAVMC'],
    ['naval message DTG', '161200Z FEB 26', 'AMHS'],
  ];

  it.each(cases)('imports %s as a basic letter with a warning', (_name, heading, label) => {
    const result = detect(`
UNITED STATES MARINE CORPS
${heading}
From: CO
To: CG
Subj: TEST
1. Body.
`);
    expect(result.documentType).toBe('basic');
    expect(result.confidence).toBe('low');
    expect(result.warnings.join(' ')).toContain(label);
    expect(result.warnings.join(' ')).toContain('Basic Letter');
  });

  it('recognizes the endorsement heading before falling back to From/To/Subj anchors', () => {
    const result = detect(`
FIRST ENDORSEMENT on CO ltr of 16 Feb 26
From: CO
To: CG
Subj: FORWARDING
1. Forwarded.
`);
    expect(result.documentType).toBe('basic');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('detectDocumentType — fallbacks', () => {
  it('returns basic with low confidence when only some anchors are present', () => {
    const result = detect(`
From: CO
1. Body without a subject line.
`);
    expect(result).toMatchObject({ documentType: 'basic', confidence: 'low', warnings: [] });
  });

  it('warns when nothing is recognizable', () => {
    const result = detect('Just some prose.\nNothing naval about it.');
    expect(result.documentType).toBe('basic');
    expect(result.confidence).toBe('low');
    expect(result.warnings.some(w => w.includes('Could not recognize'))).toBe(true);
  });

  it('ignores headings beyond the scan window', () => {
    const filler = Array.from({ length: 35 }, (_, i) => `Filler line ${i + 1}.`).join('\n');
    const result = detect(`${filler}\nMEMORANDUM FOR THE RECORD`);
    expect(result.documentType).toBe('basic');
  });
});
