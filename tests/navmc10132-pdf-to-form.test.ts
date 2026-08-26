import { describe, it, expect } from 'vitest';
import { navmc10132PdfToForm } from '@/lib/navmc10132-pdf-to-form';
import type { Navmc10132PdfRead } from '@/lib/navmc10132-pdf-read';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import type { FormData } from '@/types';

/**
 * Mapping a read file onto the open document.
 *
 * NO PDF IS PARSED HERE. `Navmc10132PdfRead` is the seam, so these tests
 * hand-build one and stay fast and exact. Parsing is covered in
 * navmc10132-pdf-read.test.ts against the shipped blank.
 *
 * Values below are taken from a real CAC-signed UPB measured 2026-08-25:
 * two signatures applied (items 2 and 3), 45 fields locked, stage 3.
 */

function read(overrides: Partial<Navmc10132PdfRead> = {}): Navmc10132PdfRead {
  return {
    values: {},
    signedSignatures: [],
    allSignatures: [],
    lockedFields: new Set<string>(),
    stage: 1,
    notes: [],
    ...overrides,
  };
}

function form(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    ...overrides,
  } as unknown as FormData;
}

const SIGNED_AT_PASS_2 = {
  signedSignatures: ['2 ACC ELECTION AND RIGHTS SIGNATURE', '3 RIGHTS ATTEST SIGNATURE'],
  stage: 3 as const,
};

describe('the file wins where the file says something', () => {
  it('fills an empty document from the file', () => {
    const result = navmc10132PdfToForm(
      read({
        values: {
          '17 UNIT': '1ST BN, 8TH MARINES, 2D MARDIV',
          '18 ACCUSED FULL NAME': 'THOMPSON, JAMAL R',
          '20 ACCUSED EDIPI': '4000500006',
          '8 NJP AUTHORITY NAME TITLE SERVICE': 'CARDENAS, ELENA V',
        },
        ...SIGNED_AT_PASS_2,
      }),
      form(),
    );

    expect(result.patch.unit).toBe('1ST BN, 8TH MARINES, 2D MARDIV');
    expect(result.patch.accusedName).toBe('THOMPSON, JAMAL R');
    expect(result.patch.njpAuthorityName).toBe('CARDENAS, ELENA V');
  });

  it('overwrites a disagreeing value and flags it', () => {
    const result = navmc10132PdfToForm(
      read({
        values: { '18 ACCUSED FULL NAME': 'THOMPSON, JAMAL R' },
        lockedFields: new Set(['18 ACCUSED FULL NAME']),
        ...SIGNED_AT_PASS_2,
      }),
      form({ accusedName: 'SOMEONE, ELSE X' }),
    );

    expect(result.patch.accusedName).toBe('THOMPSON, JAMAL R');
    expect(result.conflicts).toEqual([
      {
        label: 'Accused (item 18)',
        fromFile: 'THOMPSON, JAMAL R',
        fromForm: 'SOMEONE, ELSE X',
        // The one the clerk can do nothing about in the app, which is why
        // flagging it is the whole remedy.
        locked: true,
      },
    ]);
  });
});

/**
 * THE NARROW READING OF "the uploaded form is the truth", and the case that
 * forced it. A clerk at pass 3 types the punishment into the app, then
 * uploads the signed pass-2 file to carry the signatures forward. Item 6 is
 * empty on that file because item 6 is pass-3 work that has not happened on
 * paper. Absolute file-wins deletes what he just typed.
 */
describe('an empty field on the file is not the file asserting emptiness', () => {
  it('keeps the app value where the file has none, and flags that it did', () => {
    const result = navmc10132PdfToForm(
      read({ values: { '6 PUNISHMENT IMPOSITION DATE': '' }, ...SIGNED_AT_PASS_2 }),
      form({ punishmentDate: '2026-09-01' }),
    );

    expect(result.patch.punishmentDate).toBe('2026-09-01');
    expect(result.conflicts).toEqual([
      {
        label: 'Punishment date (item 6)',
        fromFile: '',
        fromForm: '2026-09-01',
        locked: false,
      },
    ]);
  });

  // A checkbox has no empty state distinct from false, so an unchecked box
  // IS an answer and does win.
  it('lets an unchecked box on the file clear a checked box in the app', () => {
    const result = navmc10132PdfToForm(
      read({ values: { '13 NOT APPEALED': '' } }),
      form({ notAppealed: true }),
    );

    expect(result.patch.notAppealed).toBe(false);
  });
});

/**
 * A clean load must produce ZERO flags. Twelve flags on a load where nothing
 * is in dispute teaches a clerk to dismiss the flag, which is how the real
 * one gets missed later.
 */
describe('what does not count as a conflict', () => {
  it('reports nothing when the file fills fields the document had empty', () => {
    const result = navmc10132PdfToForm(
      read({
        values: {
          '17 UNIT': '1ST BN, 8TH MARINES, 2D MARDIV',
          '18 ACCUSED FULL NAME': 'THOMPSON, JAMAL R',
          '20 ACCUSED EDIPI': '4000500006',
          '8A NJP AUTHORITY GRADE': 'LtCol, O5',
        },
        ...SIGNED_AT_PASS_2,
      }),
      form(),
    );

    expect(result.conflicts).toEqual([]);
  });

  it('reports nothing when the two agree', () => {
    const result = navmc10132PdfToForm(
      read({ values: { '17 UNIT': 'CO B, 1ST BN' } }),
      form({ unit: 'CO B, 1ST BN' }),
    );

    expect(result.conflicts).toEqual([]);
  });
});

describe('the structures that do and do not come back', () => {
  it('rebuilds the offense rows, which invert exactly', () => {
    const result = navmc10132PdfToForm(
      read({
        values: {
          '1A ARTICLE': 'Art. 91  Disrespect toward WO/NCO',
          '1A SUMMARY': 'Disrespectful language toward platoon sergeant, 1 Aug 26.',
          '1A FINDING': 'Guilty',
          '1B ARTICLE': 'Art. 92  Failure to obey order',
          '1B SUMMARY': 'Failed to obey a lawful order.',
        },
      }),
      form(),
    );

    const offenses = result.patch.offenses as { articleLabel: string; finding: string }[];
    expect(offenses).toHaveLength(2);
    expect(offenses[0].articleLabel).toBe('Art. 91  Disrespect toward WO/NCO');
    expect(offenses[0].finding).toBe('Guilty');
    expect(offenses[1].finding).toBe('');
  });

  it('skips empty offense rows rather than padding to five', () => {
    const result = navmc10132PdfToForm(
      read({ values: { '1A ARTICLE': 'Art. 86  Absence without leave' } }),
      form(),
    );

    expect((result.patch.offenses as unknown[]).length).toBe(1);
  });

  // Written from structure, and a parser guessing the structure back would
  // be inventing a legal record.
  it.each([
    ['6 PUNISHMENT IMPOSED', 'REDUCTION TO THE NEXT INFERIOR GRADE', 'Punishment imposed (item 6)'],
    ['7 SUSPENSION IF ANY', 'REDUCTION SUSPENDED FOR 6 MONTHS', 'Suspension (item 7)'],
    ['21 REMARKS', '2026-08-14 ITEM 14: Appeal denied.', 'Remarks (item 21)'],
  ])('carries %s as text and never parses it into structure', (field, value, label) => {
    const result = navmc10132PdfToForm(read({ values: { [field]: value } }), form());

    expect(result.carriedFromFile).toContainEqual({ label, value });
    expect(result.patch.punishments).toBeUndefined();
    expect(result.patch.suspensions).toBeUndefined();
    expect(result.patch.remarks).toBeUndefined();
    expect(result.notes.join(' ')).toMatch(/cannot rebuild/);
  });

  // "Cpl, E4" and "GySgt, E7" are both comma separated, and nothing
  // guarantees the next one is. A wrong split writes a wrong grade onto a
  // legal record.
  it('does not split item 19 back into a rank and a pay grade', () => {
    const result = navmc10132PdfToForm(read({ values: { '19 ACCUSED RANK/GRADE': 'Cpl, E4' } }), form());

    expect(result.patch.accusedRank).toBeUndefined();
    expect(result.patch.accusedPayGrade).toBeUndefined();
    expect(result.carriedFromFile).toContainEqual({
      label: 'Rank and grade (item 19)',
      value: 'Cpl, E4',
    });
  });

  it('reads victim row A and says why B through E cannot come back', () => {
    const result = navmc10132PdfToForm(
      read({ values: { '22A VICTIM STATUS': 'Spouse', '22A VICTIM SEX': 'Female' } }),
      form(),
    );

    expect((result.patch.victims as { status: string }[])[0].status).toBe('Spouse');
    expect(result.notes.join(' ')).toMatch(/Victims 2 through 5/);
  });
});

describe('the file decides the pass, and page 2 is only a cross-check', () => {
  it('takes the stage from the read rather than from the open document', () => {
    const result = navmc10132PdfToForm(read({ ...SIGNED_AT_PASS_2 }), form({ stage: 1 }));

    expect(result.patch.stage).toBe(3);
  });

  // Page 2 is filled by the form's own calculate scripts. Reading it as a
  // SOURCE would let a stale calculation overwrite items 18-20.
  it('never sources the accused identity from items 23-25', () => {
    const result = navmc10132PdfToForm(
      read({
        values: { '18 ACCUSED FULL NAME': 'THOMPSON, JAMAL R', '23 ACCUSED FULL NAME': 'STALE, NAME Q' },
      }),
      form(),
    );

    expect(result.patch.accusedName).toBe('THOMPSON, JAMAL R');
  });

  it('flags a page 1 and page 2 identity that disagree', () => {
    const result = navmc10132PdfToForm(
      read({
        values: { '18 ACCUSED FULL NAME': 'THOMPSON, JAMAL R', '23 ACCUSED FULL NAME': 'STALE, NAME Q' },
      }),
      form(),
    );

    expect(result.notes.join(' ')).toMatch(/Page 2 shows a different accused name/);
  });

  it('says how many fields the signatures closed', () => {
    const result = navmc10132PdfToForm(
      read({ ...SIGNED_AT_PASS_2, lockedFields: new Set(['17 UNIT', '18 ACCUSED FULL NAME']) }),
      form(),
    );

    expect(result.notes.join(' ')).toMatch(/2 signature\(s\) applied, closing 2 fields/);
  });
});
