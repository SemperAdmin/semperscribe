import { describe, it, expect } from 'vitest';
import {
  linesFromText,
  parseCorrespondence,
} from '@/services/import/correspondenceParser';
import {
  ExtractedText,
  ExtractionResult,
  toImportPayload,
} from '@/services/import/extractionTypes';

function extract(raw: string): ExtractionResult {
  const text: ExtractedText = { lines: linesFromText(raw), sourceFormat: 'text', warnings: [] };
  return parseCorrespondence(text);
}

const CLEAN_BASIC_LETTER = `
UNITED STATES MARINE CORPS
3D MARINE DIVISION
UNIT 38410
5216
G-1
16 Feb 26

From: Commanding Officer, 3d Marine Division
To:   Commanding General, III Marine Expeditionary Force
Via:  (1) Chief of Staff
      (2) Assistant Chief of Staff, G-1

Subj: STANDARD SUBJECT LINE FOR TESTING

Ref:  (a) MCO 5215.1K
      (b) SECNAV M-5216.5

Encl: (1) Sample Enclosure One
      (2) Sample Enclosure Two

1. This is the first paragraph of the letter body.

2. This is the second paragraph.

a. This is a subparagraph.

(1) This is a sub-subparagraph.

3. Final paragraph.

I. M. MARINE

Copy to:
CMC (ARDB)
CG, MCIPAC
`;

describe('linesFromText', () => {
  it('normalizes CRLF, tabs, and repeated whitespace', () => {
    const lines = linesFromText('From:\tCommanding  Officer\r\nTo:   CG\r\n');
    expect(lines).toEqual(['From: Commanding Officer', 'To: CG']);
  });

  it('collapses blank-line runs and trims leading/trailing blanks', () => {
    const lines = linesFromText('\n\nA\n\n\n\nB\n\n');
    expect(lines).toEqual(['A', '', 'B']);
  });
});

describe('parseCorrespondence — clean basic letter', () => {
  const result = extract(CLEAN_BASIC_LETTER);

  it('extracts the letterhead lines', () => {
    expect(result.fields.line1?.value).toBe('UNITED STATES MARINE CORPS');
    expect(result.fields.line2?.value).toBe('3D MARINE DIVISION');
    expect(result.fields.line3?.value).toBe('UNIT 38410');
  });

  it('extracts SSIC, originator code, and date with high confidence', () => {
    expect(result.fields.ssic).toMatchObject({ value: '5216', confidence: 'high' });
    expect(result.fields.originatorCode).toMatchObject({ value: 'G-1', confidence: 'high' });
    expect(result.fields.date).toMatchObject({ value: '16 Feb 26', confidence: 'high' });
  });

  it('extracts From, To, and Subj', () => {
    expect(result.fields.from?.value).toBe('Commanding Officer, 3d Marine Division');
    expect(result.fields.to?.value).toBe('Commanding General, III Marine Expeditionary Force');
    expect(result.fields.subj).toMatchObject({
      value: 'STANDARD SUBJECT LINE FOR TESTING',
      confidence: 'high',
    });
  });

  it('splits the via chain, references, and enclosures into items', () => {
    expect(result.vias).toEqual(['Chief of Staff', 'Assistant Chief of Staff, G-1']);
    expect(result.references).toEqual(['MCO 5215.1K', 'SECNAV M-5216.5']);
    expect(result.enclosures).toEqual(['Sample Enclosure One', 'Sample Enclosure Two']);
  });

  it('reconstructs the paragraph tree with levels and stripped markers', () => {
    expect(result.paragraphs.map(p => p.level)).toEqual([1, 1, 2, 3, 1]);
    expect(result.paragraphs[0].content).toBe('This is the first paragraph of the letter body.');
    expect(result.paragraphs[2].content).toBe('This is a subparagraph.');
    expect(result.paragraphs.map(p => p.id)).toEqual([1, 2, 3, 4, 5]);
  });

  it('extracts the signature and copy-to list', () => {
    expect(result.fields.sig?.value).toBe('I. M. MARINE');
    expect(result.copyTos).toEqual(['CMC (ARDB)', 'CG, MCIPAC']);
  });

  it('claims every line — nothing unmatched, no warnings', () => {
    expect(result.unmatchedText).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('parseCorrespondence — mangled letter', () => {
  const MANGLED = `
united states marine corps
1st Marine Regiment
5216
from: Commanding Officer
to: Commanding General
subj: this subject is not
in all caps
ref: (a) MCO 5215.1K (b) MCO 1200.19
1. First paragraph that wraps
onto the next line.
2. Second para-
graph with hyphen wrap.

J. A. SMITH
By direction
`;
  const result = extract(MANGLED);

  it('recognizes a lowercased letterhead and uppercases it', () => {
    expect(result.fields.line1?.value).toBe('UNITED STATES MARINE CORPS');
    expect(result.fields.line2?.value).toBe('1ST MARINE REGIMENT');
  });

  it('handles lowercase anchor labels', () => {
    expect(result.fields.from?.value).toBe('Commanding Officer');
    expect(result.fields.to?.value).toBe('Commanding General');
  });

  it('joins a wrapped subject line and flags it low confidence (not ALL CAPS)', () => {
    expect(result.fields.subj).toMatchObject({
      value: 'this subject is not in all caps',
      confidence: 'low',
    });
  });

  it('splits references collapsed onto a single line', () => {
    expect(result.references).toEqual(['MCO 5215.1K', 'MCO 1200.19']);
  });

  it('repairs hard-wrapped and hyphen-wrapped paragraphs', () => {
    expect(result.paragraphs[0].content).toBe('First paragraph that wraps onto the next line.');
    expect(result.paragraphs[1].content).toBe('Second paragraph with hyphen wrap.');
  });

  it('extracts the signature with a By direction delegation line', () => {
    expect(result.fields.sig?.value).toBe('J. A. SMITH');
    expect(result.fields.delegationText?.value).toBe('By direction');
  });
});

describe('parseCorrespondence — memorandum for the record', () => {
  const MFR = `
UNITED STATES MARINE CORPS
HEADQUARTERS BATTALION

5216
CO
16 Feb 26

MEMORANDUM FOR THE RECORD

From: Company Commander

Subj: RECORD OF COUNSELING

1. This memorandum records the event.

T. E. STAMP
`;
  const result = extract(MFR);

  it('claims the MEMORANDUM heading instead of reporting it unmatched', () => {
    expect(result.unmatchedText).toEqual([]);
  });

  it('has no To field, as expected for an MFR', () => {
    expect(result.fields.to).toBeUndefined();
    expect(result.fields.from?.value).toBe('Company Commander');
  });

  it('still finds the originator code after a blank line resets the letterhead', () => {
    expect(result.fields.originatorCode).toMatchObject({ value: 'CO', confidence: 'high' });
  });

  it('extracts the signature', () => {
    expect(result.fields.sig?.value).toBe('T. E. STAMP');
  });
});

describe('parseCorrespondence — header variants', () => {
  it('parses SSIC, code, and date collapsed onto one line (PDF extraction)', () => {
    const result = extract(`
UNITED STATES MARINE CORPS
5216 G-1 16 Feb 26
From: CO
To: CG
Subj: TEST SUBJECT
1. Body paragraph.
`);
    expect(result.fields.ssic).toMatchObject({ value: '5216', confidence: 'high' });
    expect(result.fields.originatorCode).toMatchObject({ value: 'G-1', confidence: 'high' });
    expect(result.fields.date).toMatchObject({ value: '16 Feb 26', confidence: 'high' });
  });

  it('normalizes non-naval date formats to DD Mmm YY', () => {
    const result = extract(`
5216
G-1
February 16, 2026
From: CO
Subj: TEST
1. Body.
`);
    expect(result.fields.date).toMatchObject({ value: '16 Feb 26', confidence: 'high' });
  });

  it('flags an SSIC with a decimal suffix as low confidence', () => {
    const result = extract(`
5215.1K
From: CO
Subj: TEST
1. Body.
`);
    expect(result.fields.ssic).toMatchObject({ value: '5215.1K', confidence: 'low' });
  });

  it('reports header noise as unmatched text, never dropping it silently', () => {
    const result = extract(`
5216
Random unrelated header noise line
From: CO
Subj: TEST
1. Body.
`);
    expect(result.unmatchedText).toEqual(['Random unrelated header noise line']);
  });
});

describe('parseCorrespondence — body and closing edge cases', () => {
  it('imports blank-separated unnumbered text as a new paragraph with a warning', () => {
    const result = extract(`
From: CO
Subj: TEST

This body paragraph lost its numbering entirely.

2. This one kept it.
`);
    expect(result.paragraphs.map(p => p.level)).toEqual([1, 1]);
    expect(result.paragraphs[0].content).toBe('This body paragraph lost its numbering entirely.');
    expect(result.warnings.some(w => w.includes('Unnumbered text'))).toBe(true);
  });

  it('collects a Distribution list', () => {
    const result = extract(`
From: CO
Subj: TEST
1. Body.

R. B. HONCHO

Distribution:
PCN 10203040500
CMC (ARDB)
`);
    expect(result.fields.sig?.value).toBe('R. B. HONCHO');
    expect(result.distList).toEqual(['PCN 10203040500', 'CMC (ARDB)']);
  });

  it('does not mistake all-caps copy-to entries for a signature', () => {
    const result = extract(`
From: CO
Subj: TEST
1. Body.

Copy to:
PLANS DIVISION
FILE
`);
    expect(result.fields.sig).toBeUndefined();
    expect(result.copyTos).toEqual(['PLANS DIVISION', 'FILE']);
  });

  it('handles a single unnumbered Via entry', () => {
    const result = extract(`
From: CO
Via: Chief of Staff
Subj: TEST
1. Body.
`);
    expect(result.vias).toEqual(['Chief of Staff']);
  });

  it('keeps the first value and warns when an anchor is duplicated', () => {
    const result = extract(`
From: CO
From: Someone Else
Subj: TEST
1. Body.
`);
    expect(result.fields.from?.value).toBe('CO');
    expect(result.warnings.some(w => w.includes('Duplicate'))).toBe(true);
  });

  it('warns when a document has no recognizable structure at all', () => {
    const result = extract('Just some prose.\nWith no naval formatting whatsoever.');
    expect(result.warnings.some(w => w.includes('Could not find'))).toBe(true);
    expect(result.unmatchedText.length).toBeGreaterThan(0);
  });
});

describe('toImportPayload', () => {
  it('converts an extraction result into the handleImport shape', () => {
    const result = extract(CLEAN_BASIC_LETTER);
    const payload = toImportPayload(result);
    expect(payload.formData).toMatchObject({
      documentType: 'basic',
      ssic: '5216',
      originatorCode: 'G-1',
      date: '16 Feb 26',
      from: 'Commanding Officer, 3d Marine Division',
      subj: 'STANDARD SUBJECT LINE FOR TESTING',
      sig: 'I. M. MARINE',
    });
    expect(payload.references).toHaveLength(2);
    expect(payload.paragraphs).toHaveLength(5);
  });

  it('always includes arrays so import replaces the pending document', () => {
    const payload = toImportPayload(extract('From: CO\nSubj: TEST\n1. Body.'));
    expect(payload.vias).toEqual([]);
    expect(payload.enclosures).toEqual([]);
    expect(payload.copyTos).toEqual([]);
    expect(payload.distList).toEqual([]);
  });

  it('falls back to one empty paragraph when none were extracted', () => {
    const payload = toImportPayload(extract('From: CO\nSubj: TEST'));
    expect(payload.paragraphs).toEqual([{ id: 1, level: 1, content: '' }]);
  });
});
