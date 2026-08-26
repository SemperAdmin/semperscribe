import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
  writeNavmc10132Incremental,
  Navmc10132WriteError,
} from '@/lib/navmc10132-incremental-write';
import { readNavmc10132Pdf } from '@/lib/navmc10132-pdf-read';

/**
 * Writing the next pass into an already-signed NAVMC 10132.
 *
 * WHAT THESE TESTS CAN AND CANNOT COVER. The mechanics are all here: the
 * delta is appended rather than returned as a document, the prefix survives
 * byte for byte, a written value reads back, and the refusal rules hold.
 * They run against the blank this repo ships, which has no signatures, so
 * nothing here proves a SIGNATURE survives. That cannot be tested from a
 * fixture: a real CAC signature cannot be regenerated, and the file that has
 * one is 5MB of a Marine's personal data.
 *
 * MEASURED BY HAND against the real signed UPB, 2026-08-26, and this is the
 * assertion to write if a signed fixture ever becomes committable:
 *
 *   original            5,144,151 bytes, 2 signatures, 45 fields locked
 *   wrote               items 6, 6-date, 7 and the 1A finding
 *   refused             items 17 and 18, both signature-closed
 *   skipped as empty    item 4
 *   delta                     974 bytes
 *   prefix identical          true
 *   after               2 signatures, 45 locked, still stage 3
 *   /ByteRange count    8 before, 8 after
 *   item 18 after       "THOMPSON, JAMAL R", untouched
 *   item 21 after       untouched, and it is a RichText field
 */

const BLANK = path.resolve(__dirname, '../public/forms/navmc-10132-blank.pdf');
const NO_LOCKS = new Set<string>();

function blank(): Uint8Array {
  return new Uint8Array(readFileSync(BLANK));
}

describe('the update is APPENDED, never a rewrite', () => {
  it('keeps every original byte and adds the delta after them', async () => {
    const original = blank();

    const result = await writeNavmc10132Incremental(
      original,
      { '6 PUNISHMENT IMPOSED': 'REDUCTION TO THE NEXT INFERIOR GRADE' },
      NO_LOCKS,
    );

    expect(result.bytes.length).toBeGreaterThan(original.length);
    // THE LOAD-BEARING ASSERTION. A CAC signature covers a byte range; move
    // one byte before it and the signature no longer covers what it signed,
    // which reads as tampering rather than as a bad export.
    expect(Buffer.compare(Buffer.from(original), Buffer.from(result.bytes.slice(0, original.length)))).toBe(0);
    expect(result.deltaBytes).toBe(result.bytes.length - original.length);
  }, 60000);

  // `saveIncremental` returns ONLY the delta. Returning it as the document
  // produces a sub-kilobyte file that opens as nothing, and the mistake is
  // invisible until someone tries to open it.
  it('returns a whole document, not the sub-kilobyte delta', async () => {
    const result = await writeNavmc10132Incremental(
      blank(),
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );

    expect(result.deltaBytes).toBeLessThan(10_000);
    expect(result.bytes.length).toBeGreaterThan(100_000);
  }, 60000);

  it('writes nothing and grows the file by nothing when there is nothing to write', async () => {
    const original = blank();

    const result = await writeNavmc10132Incremental(original, {}, NO_LOCKS);

    expect(result.written).toEqual([]);
    expect(result.deltaBytes).toBe(0);
    expect(result.bytes.length).toBe(original.length);
  }, 60000);
});

describe('what comes back out of the written file', () => {
  it('reads back every field it wrote, across field kinds', async () => {
    const result = await writeNavmc10132Incremental(
      blank(),
      {
        '6 PUNISHMENT IMPOSED': 'REDUCTION TO THE NEXT INFERIOR GRADE',
        '6 PUNISHMENT IMPOSITION DATE': '2026-08-20',
        '1A FINDING': 'Guilty',
        '13 NOT APPEALED': true,
      },
      NO_LOCKS,
    );

    const after = await readNavmc10132Pdf(result.bytes);

    expect(after.values['6 PUNISHMENT IMPOSED']).toBe('REDUCTION TO THE NEXT INFERIOR GRADE');
    expect(after.values['6 PUNISHMENT IMPOSITION DATE']).toBe('2026-08-20');
    expect(after.values['1A FINDING']).toBe('Guilty');
    expect(after.values['13 NOT APPEALED']).toBe('true');
  }, 60000);

  // The failure mode markRefForSave exists to prevent: without it the delta
  // carries a font and an appearance stream and no value. The save succeeds,
  // the file opens, and the field is empty.
  it('does not silently write nothing', async () => {
    const result = await writeNavmc10132Incremental(
      blank(),
      { '8 NJP AUTHORITY NAME TITLE SERVICE': 'CARDENAS, ELENA V' },
      NO_LOCKS,
    );
    const after = await readNavmc10132Pdf(result.bytes);

    expect(after.values['8 NJP AUTHORITY NAME TITLE SERVICE']).toBe('CARDENAS, ELENA V');
  }, 60000);

  it('leaves every field it did not write exactly as it found it', async () => {
    const before = await readNavmc10132Pdf(blank());
    const result = await writeNavmc10132Incremental(
      blank(),
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );
    const after = await readNavmc10132Pdf(result.bytes);

    for (const name of Object.keys(before.values)) {
      if (name === '6 PUNISHMENT IMPOSED') continue;
      expect(after.values[name], `${name} should not have moved`).toBe(before.values[name]);
    }
  }, 60000);
});

/**
 * Stephen's ruling: "We should not be updating the locked sections once that
 * are blocked with the signature." Writing one would break the signature that
 * closed it, so the refusal protects the document as well as obeying the rule.
 */
describe('what it refuses to write', () => {
  it('refuses every field a signature closed, and says which', async () => {
    const locked = new Set(['17 UNIT', '18 ACCUSED FULL NAME']);

    const result = await writeNavmc10132Incremental(
      blank(),
      {
        '17 UNIT': 'SHOULD NOT BE WRITTEN',
        '18 ACCUSED FULL NAME': 'ALSO NOT WRITTEN',
        '6 PUNISHMENT IMPOSED': 'THIS ONE SHOULD BE',
      },
      locked,
    );
    const after = await readNavmc10132Pdf(result.bytes);

    expect(result.refused.sort()).toEqual(['17 UNIT', '18 ACCUSED FULL NAME']);
    expect(result.written).toEqual(['6 PUNISHMENT IMPOSED']);
    expect(after.values['17 UNIT']).toBe('');
    expect(after.values['18 ACCUSED FULL NAME']).toBe('');
  }, 60000);

  // The same rule the loader applies in the other direction. Together they
  // mean a round trip never destroys what it did not collect.
  it('skips a field the app has no value for, rather than blanking the file', async () => {
    const first = await writeNavmc10132Incremental(
      blank(),
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );

    const second = await writeNavmc10132Incremental(
      first.bytes,
      { '6 PUNISHMENT IMPOSED': '', '8A NJP AUTHORITY GRADE': 'LtCol, O5' },
      NO_LOCKS,
    );
    const after = await readNavmc10132Pdf(second.bytes);

    expect(second.skippedEmpty).toContain('6 PUNISHMENT IMPOSED');
    expect(after.values['6 PUNISHMENT IMPOSED']).toBe('RESTRICTION FOR 14 DAYS');
    expect(after.values['8A NJP AUTHORITY GRADE']).toBe('LtCol, O5');
  }, 60000);

  // A checkbox's false IS an answer, not an absence, so it is not skipped.
  it('lets a checkbox be turned off', async () => {
    const on = await writeNavmc10132Incremental(blank(), { '13 NOT APPEALED': true }, NO_LOCKS);
    const off = await writeNavmc10132Incremental(on.bytes, { '13 NOT APPEALED': false }, NO_LOCKS);
    const after = await readNavmc10132Pdf(off.bytes);

    expect(off.written).toContain('13 NOT APPEALED');
    expect(after.values['13 NOT APPEALED']).toBe('');
  }, 60000);

  // A no-op write still produces a delta, and a delta on every export grows
  // the document by a revision each time for nothing.
  it('skips a field the file already agrees with', async () => {
    const first = await writeNavmc10132Incremental(
      blank(),
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );
    const second = await writeNavmc10132Incremental(
      first.bytes,
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );

    expect(second.unchanged).toEqual(['6 PUNISHMENT IMPOSED']);
    expect(second.deltaBytes).toBe(0);
    expect(second.bytes.length).toBe(first.bytes.length);
  }, 60000);

  // A field this app knows and the file does not means the form was revised.
  // Reported, never thrown: one unknown field must not abort an export that
  // is otherwise correct.
  it('reports an unknown field instead of aborting the export', async () => {
    const result = await writeNavmc10132Incremental(
      blank(),
      { 'A FIELD THAT DOES NOT EXIST': 'x', '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );

    expect(result.refused).toContain('A FIELD THAT DOES NOT EXIST');
    expect(result.written).toContain('6 PUNISHMENT IMPOSED');
  }, 60000);
});

describe('stacking passes', () => {
  // The real lifecycle: each pass appends to what the last one produced, and
  // every earlier revision stays byte-identical underneath.
  it('appends a second pass on top of the first without disturbing it', async () => {
    const original = blank();
    const pass3 = await writeNavmc10132Incremental(
      original,
      { '6 PUNISHMENT IMPOSED': 'RESTRICTION FOR 14 DAYS' },
      NO_LOCKS,
    );
    const pass4 = await writeNavmc10132Incremental(
      pass3.bytes,
      { '11 APPEAL ADVISEMENT DATE_af_date': '2026-08-21' },
      NO_LOCKS,
    );

    expect(
      Buffer.compare(Buffer.from(pass3.bytes), Buffer.from(pass4.bytes.slice(0, pass3.bytes.length))),
    ).toBe(0);

    const after = await readNavmc10132Pdf(pass4.bytes);
    expect(after.values['6 PUNISHMENT IMPOSED']).toBe('RESTRICTION FOR 14 DAYS');
    expect(after.values['11 APPEAL ADVISEMENT DATE_af_date']).toBe('2026-08-21');
  }, 120000);
});

describe('bytes that are not a UPB', () => {
  it('fails with a named error rather than a parser stack trace', async () => {
    await expect(
      writeNavmc10132Incremental(new TextEncoder().encode('not a pdf'), {}, NO_LOCKS),
    ).rejects.toThrow(Navmc10132WriteError);
  });
});
