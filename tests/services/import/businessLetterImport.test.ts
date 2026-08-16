/**
 * Business-letter import (added 2026-08-16).
 *
 * Before this, the importer supported four types - basic, mfr,
 * letterhead-memo, from-to-memo - and a business letter fell through to
 * "basic" at low confidence with NO warning, so the inside address,
 * salutation, and complimentary close were silently dropped into the
 * unmatched pile.
 *
 * The salutation is the decisive anchor: SECNAV M-5216.5 Fig 11-1 gives
 * the civilian letter a salutation and no From/To, and the naval
 * standard letter the reverse.
 */
import { describe, it, expect } from 'vitest';
import { detectDocumentType } from '@/services/import/docTypeDetector';
import { parseCorrespondence, linesFromText } from '@/services/import/correspondenceParser';
import { toImportPayload } from '@/services/import/extractionTypes';

const text = (raw: string) => ({
  lines: linesFromText(raw),
  sourceFormat: 'docx' as const,
  warnings: [],
});

const FULL_LETTER = `UNITED STATES MARINE CORPS
HEADQUARTERS BATTALION
BOX 555000
CAMP SMITH, HI 96861

5720
JA
August 14, 2026

Mr. John Q. Doe
Director of Operations
Acme Logistics, Inc.
1234 Industrial Parkway
Honolulu, HI 96819

Dear Mr. Doe:

SUBJECT: CONTRACT PERFORMANCE REVIEW

Thank you for your letter of 1 July 2026 regarding the delivery schedule.

We have reviewed the performance data and concur with your assessment.

Sincerely,

S. A. SHORTER
Head, Contracts Branch

Copy to:
Contracting Officer`;

const NAVAL_LETTER = `UNITED STATES MARINE CORPS
HEADQUARTERS BATTALION
BOX 555000
CAMP SMITH, HI 96861

5216
G-1
14 Aug 26

From:  Commanding Officer
To:  Commandant of the Marine Corps

Subj:  TEST SUBJECT LINE

1.  Body paragraph one.

S. A. SHORTER
By direction`;

describe('detectDocumentType - business letter', () => {
  it('detects it from the salutation with no From/To', () => {
    const d = detectDocumentType(text(FULL_LETTER));
    expect(d.documentType).toBe('business-letter');
    expect(d.confidence).toBe('high');
    expect(d.warnings).toEqual([]);
  });

  it.each([
    'Dear Mr. Doe:',
    'Dear Sir or Madam:',
    'To Whom It May Concern:',
    'Dear Ms. O’Brien-Smith,',
  ])('accepts the salutation form %s', (salutation) => {
    const d = detectDocumentType(text(
      `UNITED STATES MARINE CORPS\n5720\nAugust 14, 2026\n\nAcme Inc.\nHonolulu, HI 96819\n\n${salutation}\n\nSUBJECT: X`,
    ));
    expect(d.documentType).toBe('business-letter');
    expect(d.confidence).toBe('high');
  });

  it('does not fire on a body sentence beginning with Dear', () => {
    const d = detectDocumentType(text(
      'From: CO\nTo: CMC\nSubj: X\n\n1. Dear colleagues were consulted, and we agreed.',
    ));
    expect(d.documentType).toBe('basic');
    expect(d.confidence).toBe('high');
  });

  it('surfaces the conflict when a salutation sits alongside From/To', () => {
    const d = detectDocumentType(text('From: CO\nTo: CMC\nDear Sir or Madam:\nSubj: X'));
    expect(d.documentType).toBe('basic');
    expect(d.warnings.join(' ')).toMatch(/both a salutation and From\/To/);
  });

  it('falls back to business-letter with a warning when the salutation is missing', () => {
    const d = detectDocumentType(text('UNITED STATES MARINE CORPS\n5720\nAugust 14, 2026\n\nSUBJECT: X\n\nBody.'));
    expect(d.documentType).toBe('business-letter');
    expect(d.confidence).toBe('low');
    expect(d.warnings.join(' ')).toMatch(/No salutation found/);
  });

  it('leaves the naval standard letter alone', () => {
    const d = detectDocumentType(text(NAVAL_LETTER));
    expect(d.documentType).toBe('basic');
    expect(d.confidence).toBe('high');
  });
});

describe('parseCorrespondence - business letter', () => {
  const result = () => parseCorrespondence(text(FULL_LETTER), 'business-letter');

  it('recovers the inside address in Fig 11-1 order', () => {
    const f = result().fields;
    expect(f.recipientName?.value).toBe('Mr. John Q. Doe');
    expect(f.recipientTitle?.value).toBe('Director of Operations');
    expect(f.businessName?.value).toBe('Acme Logistics, Inc.');
    expect(f.recipientAddress?.value).toBe('1234 Industrial Parkway\nHonolulu, HI 96819');
  });

  it('recovers the salutation, close, signer and title', () => {
    const f = result().fields;
    expect(f.salutation?.value).toBe('Dear Mr. Doe:');
    expect(f.complimentaryClose?.value).toBe('Sincerely,');
    expect(f.sig?.value).toBe('S. A. SHORTER');
    expect(f.signerTitle?.value).toBe('Head, Contracts Branch');
  });

  it('keeps the civilian date verbatim instead of converting to naval format', () => {
    expect(result().fields.date?.value).toBe('August 14, 2026');
    // The same date on a naval letter still converts.
    const naval = parseCorrespondence(text(NAVAL_LETTER), 'basic');
    expect(naval.fields.date?.value).toBe('14 Aug 26');
  });

  it('claims every line: nothing unmatched, no warnings', () => {
    const r = result();
    expect(r.unmatchedText).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('imports unnumbered paragraphs without warning on each one', () => {
    const r = result();
    expect(r.paragraphs).toHaveLength(2);
    expect(r.paragraphs[0].content).toMatch(/^Thank you for your letter/);
    expect(r.warnings.join(' ')).not.toMatch(/Unnumbered text/);
  });

  it('still reads the Copy to list', () => {
    expect(result().copyTos).toEqual(['Contracting Officer']);
  });

  it('handles a two-line inside address', () => {
    const r = parseCorrespondence(text(
      `UNITED STATES MARINE CORPS\nHQ BN\nBOX 1\nCAMP SMITH, HI 96861\n\n5720\nAugust 14, 2026\n\nAcme Logistics, Inc.\nHonolulu, HI 96819\n\nDear Sir or Madam:\n\nSUBJECT: TEST\n\nBody text here.\n\nSincerely,\n\nS. A. SHORTER`,
    ), 'business-letter');
    expect(r.fields.recipientName?.value).toBe('Acme Logistics, Inc.');
    expect(r.fields.recipientAddress?.value).toBe('Honolulu, HI 96819');
    expect(r.unmatchedText).toEqual([]);
  });

  it('warns when no salutation is present', () => {
    const r = parseCorrespondence(text(
      'UNITED STATES MARINE CORPS\nHQ BN\nBOX 1\nCAMP SMITH, HI 96861\n\n5720\nAugust 14, 2026\n\nSUBJECT: TEST\n\nBody text.',
    ), 'business-letter');
    expect(r.warnings.join(' ')).toMatch(/No salutation found/);
  });

  it('carries the civilian fields through to the import payload', () => {
    const payload = toImportPayload(result());
    expect(payload.formData.documentType).toBe('business-letter');
    expect(payload.formData.recipientName).toBe('Mr. John Q. Doe');
    expect(payload.formData.salutation).toBe('Dear Mr. Doe:');
    expect(payload.formData.signerTitle).toBe('Head, Contracts Branch');
  });
});
