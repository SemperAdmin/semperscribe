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

  /**
   * REVERSED 2026-08-26. This test asserted that item 19 is never split, on
   * the reasoning that "Cpl, E4" and "GySgt, E7" are comma separated by
   * happenstance and a wrong split writes a wrong grade onto a legal record.
   *
   * THE FIRST HALF WAS WRONG: `formatRankGrade` joins with a literal ", "
   * and lives beside the splitter, so the separator is a contract. THE
   * SECOND HALF WAS RIGHT and is now answered by validating the tail against
   * the closed pay-grade list rather than by refusing to read it, which is
   * the case asserted just below and in the recovery block at the end of
   * this file.
   *
   * The refusal cost more than a display: `accusedPayGrade` feeds the
   * forfeiture ladder, V-20, the priced A-1-d ceiling and the reduction
   * picker, and every one of them was dead on a loaded document until
   * Stephen reported the empty picker.
   *
   * What survives unchanged is the CARRIED report, so the panel still tells
   * the clerk where the value came from.
   */
  it('splits item 19 only as far as the closed list confirms, and still reports it carried', () => {
    const result = navmc10132PdfToForm(read({ values: { '19 ACCUSED RANK/GRADE': 'Cpl, E4' } }), form());

    expect(result.patch.accusedPayGrade).toBe('E4');
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

describe('the composed grades come back, and the derived halves with them', () => {
  /**
   * STEPHEN, 2026-08-26: "on inport it did not pull the Unit and Accused
   * (Items 17-20) and Rank and Pay Grade (Item 19) data."
   *
   * Item 19 was read, reported as carried from the file, and never written
   * into the patch. The original note reasoned that "Cpl, E4" is comma
   * separated by happenstance and a wrong split writes a wrong grade onto a
   * legal record. The separator is a contract, since `formatRankGrade` joins
   * with a literal ", ", and the real risk is answered by validating the
   * tail rather than by refusing to read it.
   *
   * THE COST WAS NOT THE DISPLAY. `accusedPayGrade` feeds the forfeiture
   * ladder, V-20, the priced ceiling on A-1-d and the reduction picker;
   * `njpAuthorityPayGrade` decides which punishment codes item 6 offers. On
   * every loaded document all of it was dead.
   */
  it('writes item 19, its pay grade, and the service on a Marine rank', () => {
    const { patch } = navmc10132PdfToForm(
      read({ values: { '19 ACCUSED RANK/GRADE': 'Cpl, E4' } }),
      form(),
    );
    expect(patch.accusedRankGrade).toBe('Cpl, E4');
    expect(patch.accusedPayGrade).toBe('E4');
    expect(patch.accusedService).toBe('USMC');
  });

  it('recovers the authority pay grade from item 8A, which the file never carries directly', () => {
    const { patch } = navmc10132PdfToForm(
      read({ values: { '8A NJP AUTHORITY GRADE': 'LtCol, O5' } }),
      form(),
    );
    expect(patch.njpAuthorityPayGrade).toBe('O5');
  });

  it('reads the prior-enlisted rates the same way', () => {
    const { patch } = navmc10132PdfToForm(
      read({ values: { '8A NJP AUTHORITY GRADE': 'Capt, O3E' } }),
      form(),
    );
    expect(patch.njpAuthorityPayGrade).toBe('O3E');
  });

  /**
   * THE ORIGINAL CONCERN, ANSWERED RATHER THAN DISMISSED. A tail the closed
   * list does not contain costs the derived field and never produces a wrong
   * one. The composed string is still written, because it is the exact value
   * the file carries.
   */
  it('keeps the composed string but derives nothing from an unreadable grade', () => {
    const { patch } = navmc10132PdfToForm(
      read({ values: { '19 ACCUSED RANK/GRADE': 'Cpl, E-4' } }),
      form(),
    );
    expect(patch.accusedRankGrade).toBe('Cpl, E-4');
    expect(patch).not.toHaveProperty('accusedPayGrade');
  });

  it('derives nothing at all from a value with no separator', () => {
    const { patch } = navmc10132PdfToForm(
      read({ values: { '19 ACCUSED RANK/GRADE': 'Corporal' } }),
      form(),
    );
    expect(patch.accusedRankGrade).toBe('Corporal');
    expect(patch).not.toHaveProperty('accusedPayGrade');
  });

  // A Navy rating is not in the Marine closed list, so the app declines to
  // claim a service rather than labelling a Sailor a Marine.
  it('takes the pay grade off a Navy rating but claims no service', () => {
    const { patch } = navmc10132PdfToForm(
      read({ values: { '19 ACCUSED RANK/GRADE': 'HM2, E5' } }),
      form(),
    );
    expect(patch.accusedPayGrade).toBe('E5');
    expect(patch).not.toHaveProperty('accusedService');
  });

  // Item 19 still reports as carried from the file, so the panel keeps
  // telling the clerk where the value came from.
  it('still reports item 19 as carried from the file', () => {
    const { carriedFromFile } = navmc10132PdfToForm(
      read({ values: { '19 ACCUSED RANK/GRADE': 'Cpl, E4' } }),
      form(),
    );
    expect(carriedFromFile.map((c) => c.label)).toContain('Rank and grade (item 19)');
  });

  // A clean load raises nothing, which is the rule the conflict list follows.
  it('raises no conflict when the app held nothing', () => {
    const { conflicts } = navmc10132PdfToForm(
      read({ values: { '19 ACCUSED RANK/GRADE': 'Cpl, E4', '8A NJP AUTHORITY GRADE': 'LtCol, O5' } }),
      form(),
    );
    expect(conflicts).toEqual([]);
  });
});
