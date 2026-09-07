import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  readNavmc10132Pdf,
  navmc10132StageFromSignatures,
  Navmc10132ReadError,
  NAVMC_10132_PASS_SIGNATURES,
} from '@/lib/navmc10132-pdf-read';

/**
 * Reading an existing NAVMC 10132 back out of a PDF.
 *
 * THE FIXTURE PROBLEM, AND WHAT IS DONE ABOUT IT. The interesting file is a
 * real CAC-signed UPB: 5MB, two applied signatures, and personal data. It is
 * not committed, and no test here depends on one, for three reasons. Size.
 * Personal data on a legal record. And a signature this repo cannot
 * regenerate, so the fixture could never be rebuilt if it drifted.
 *
 * So the module is split where the fixture problem is. The PASS LOGIC is a
 * pure function over a list of signature names and is tested exhaustively
 * below without any PDF at all. The PARSING is tested against the blank this
 * repo already ships, which carries all seven signature fields UNSIGNED and
 * is therefore the pass-1 case.
 *
 * WHAT THAT LEAVES UNCOVERED, stated rather than hidden: no test here reads
 * a file with an applied signature, so the `/Lock` expansion and the signed
 * branch are exercised only by hand. Measured against Stephen's signed file
 * on 2026-08-25: stage 3, signatures on items 2 and 3, 45 fields locked, and
 * the open set was exactly item 4, item 5 findings, item 6 and its date,
 * item 7, item 10, items 11 through 15, item 16 and item 21. If a signed
 * fixture ever becomes committable, that is the assertion to write.
 */

const BLANK = path.resolve(__dirname, '../public/forms/navmc-10132-blank.pdf');

describe('navmc10132StageFromSignatures', () => {
  it('puts a file with no signatures at pass 1, same as a fresh document', () => {
    expect(navmc10132StageFromSignatures([])).toBe(1);
  });

  it.each([
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 6],
    [6, 7],
  ])('a document whose pass-%s signature is applied is at pass %s', (closed, expected) => {
    const signed = NAVMC_10132_PASS_SIGNATURES.slice(0, closed);
    expect(navmc10132StageFromSignatures(signed)).toBe(expected);
  });

  // Pass 7's signature carries /Action /All and closes every field, so there
  // is no eighth pass to be at.
  it('is complete once the pass-7 signature is applied', () => {
    expect(navmc10132StageFromSignatures([...NAVMC_10132_PASS_SIGNATURES])).toBe('complete');
  });

  // THE REASON THIS READS THE HIGHEST SIGNATURE RATHER THAN COUNTING. A case
  // with no appeal never gets items 11 through 14 signed, so a closed-out
  // document carries three signatures, not seven. Counting would call it
  // pass 4 and reopen the whole appeal block on a finished case.
  it('handles a case that skipped the appeal signatures entirely', () => {
    expect(
      navmc10132StageFromSignatures([
        '2 ACC ELECTION AND RIGHTS SIGNATURE',
        '3 RIGHTS ATTEST SIGNATURE',
        '9 NJP AUTHORITY SIGNATURE',
        '16 FINAL ADMIN INIT',
      ]),
    ).toBe('complete');
  });

  // Signatures are not applied in a guaranteed order either: a commander can
  // sign item 9 before someone returns to fill item 4.
  it('is order-independent', () => {
    const forwards = navmc10132StageFromSignatures([
      '2 ACC ELECTION AND RIGHTS SIGNATURE',
      '3 RIGHTS ATTEST SIGNATURE',
    ]);
    const backwards = navmc10132StageFromSignatures([
      '3 RIGHTS ATTEST SIGNATURE',
      '2 ACC ELECTION AND RIGHTS SIGNATURE',
    ]);

    expect(forwards).toBe(3);
    expect(backwards).toBe(3);
  });

  it('ignores a signature field name that is not part of the pass sequence', () => {
    expect(navmc10132StageFromSignatures(['SOME OTHER SIGNATURE'])).toBe(1);
  });
});

describe('readNavmc10132Pdf, against the blank this repo ships', () => {
  async function readBlank() {
    return readNavmc10132Pdf(readFileSync(BLANK));
  }

  it('reads every field on the form', async () => {
    const read = await readBlank();

    // 74 fields on the real form, 7 of them signatures.
    expect(Object.keys(read.values).length).toBeGreaterThan(60);
    expect(read.allSignatures).toHaveLength(7);
  });

  it('finds all seven signature fields and none of them signed', async () => {
    const read = await readBlank();

    expect(read.signedSignatures).toEqual([]);
    expect([...read.allSignatures].sort()).toEqual([...NAVMC_10132_PASS_SIGNATURES].sort());
  });

  it('locks nothing, because nothing has been signed', async () => {
    const read = await readBlank();

    expect(read.lockedFields.size).toBe(0);
  });

  it('puts an unsigned export at pass 1', async () => {
    expect((await readBlank()).stage).toBe(1);
  });

  // The blank pre-answers the accused's election, which is defect 3.2 and
  // decision row D-40. Reading it back is how the app can SEE that, so this
  // asserts the reader surfaces it rather than normalising it away.
  it('reads the pre-answered item 2 election the blank ships with', async () => {
    const read = await readBlank();

    expect(read.values['2 DEMAND']).toMatch(/I do not demand trial/);
    expect(read.values['2 COUNSELOPP']).toBe('have');
  });

  /**
   * ITEM 21 IS A RICHTEXT FIELD, spec defect 3.8, and pdf-lib's getText()
   * THROWS on those rather than returning the plain value. Item 21 carries
   * the item 6 and item 7 overflow and every derived vacation remark, so a
   * reader that swallows the throw and calls it empty drops the part of the
   * form most likely to hold what the app put there.
   *
   * Found in the browser on the first end-to-end load, not here: the blank
   * flags the field and the real signed file measured earlier did not.
   */
  it('reads item 21 despite it being a RichText field pdf-lib refuses', async () => {
    const read = await readBlank();

    expect(read.values).toHaveProperty('21 REMARKS');
    expect(read.notes.join(' ')).not.toMatch(/21 REMARKS.*could not be read/);
  });

  it('says nothing about ReadOnly when nothing is signed', async () => {
    const read = await readBlank();

    expect(read.notes.join(' ')).not.toMatch(/ReadOnly/);
  });
});

describe('readNavmc10132Pdf, on things that are not a UPB', () => {
  it('refuses bytes that are not a PDF, naming the problem', async () => {
    await expect(readNavmc10132Pdf(new TextEncoder().encode('this is not a pdf'))).rejects.toThrow(
      Navmc10132ReadError,
    );
  });

  it('refuses a PDF with no form fields rather than returning an empty read', async () => {
    // A minimal, valid, field-free PDF. Returning `{values: {}}` here would
    // look like a UPB whose every field is blank, which the caller would
    // then happily apply over a populated document.
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();

    await expect(readNavmc10132Pdf(bytes)).rejects.toThrow(/no form fields/);
  });
});
