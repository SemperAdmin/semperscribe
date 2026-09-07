import { describe, it, expect } from 'vitest';
import {
  navmc10132LockedKeys,
  isNavmc10132KeyLocked,
  isNavmc10132SectionLocked,
  navmc10132OffenseRowLocks,
  navmc10132HasLocks,
  NAVMC_10132_FIELD_TO_KEY,
} from '@/lib/navmc10132-locks';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import type { FormData } from '@/types';

/**
 * Which inputs a loaded file's signatures have closed.
 *
 * Stephen's ruling: "We should not be updating the locked sections once
 * that are blocked with the signature." The writer honours that by refusing
 * to write. This is the UI half, and the reason it is not optional: an
 * editable box over a closed field is a promise the export cannot keep. The
 * clerk types a correction, sees it in the app, exports, and it is not in
 * the file.
 *
 * The locked field names below are the ones a REAL pass-2 signed file
 * produced, measured 2026-08-25.
 */

function form(lockedFields?: string[]): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    ...(lockedFields
      ? { navmc10132LoadReport: { fileName: 'x.pdf', lockedFields } }
      : {}),
  } as unknown as FormData;
}

describe('locks come from a loaded file, never from the stage', () => {
  // The distinction that makes this module necessary. A document at pass 3
  // that nobody has signed has nothing closed, and that is the ordinary
  // case for a file the app exported and no one has taken to Acrobat.
  it('locks nothing on a document with no load report, whatever its stage', () => {
    const fresh = { ...form(), stage: 'complete' } as FormData;

    expect(navmc10132HasLocks(fresh)).toBe(false);
    expect(navmc10132LockedKeys(fresh).size).toBe(0);
  });

  it('locks nothing when the report carries no locked fields', () => {
    expect(navmc10132HasLocks(form([]))).toBe(false);
  });

  it('ignores a malformed report rather than throwing', () => {
    const bad = { ...form(), navmc10132LoadReport: 'not an object' } as unknown as FormData;

    expect(navmc10132LockedKeys(bad).size).toBe(0);
  });
});

describe('form fields map to the document-state keys the UI holds', () => {
  it('turns locked field names into the keys a component asks about', () => {
    const keys = navmc10132LockedKeys(form(['17 UNIT', '18 ACCUSED FULL NAME', '8A NJP AUTHORITY GRADE']));

    expect([...keys].sort()).toEqual(['accusedName', 'njpAuthorityGrade', 'unit']);
  });

  it('answers for a single key', () => {
    const loaded = form(['17 UNIT']);

    expect(isNavmc10132KeyLocked(loaded, 'unit')).toBe(true);
    expect(isNavmc10132KeyLocked(loaded, 'accusedName')).toBe(false);
  });

  it('ignores a locked field it has no key for', () => {
    // 2 BOOKER is derived and has no input of its own. A lock on it must
    // not produce a phantom key.
    expect(navmc10132LockedKeys(form(['2 BOOKER'])).size).toBe(0);
  });
});

/**
 * THE SHARPEST CASE, and it is why an offense row cannot have one lock.
 * Measured on the real signed file: the item 2 signature closes 1A ARTICLE
 * and 1A SUMMARY while 1A FINDING stays OPEN, because the finding is the
 * commander's determination at pass 3. A row-level lock would either freeze
 * a finding still to be made or offer an edit to a signed article.
 */
describe('an offense row locks in two halves', () => {
  const PASS_2_LOCKS = ['1A ARTICLE', '1A SUMMARY', '1B ARTICLE', '1B SUMMARY'];

  it('closes item 1 and leaves item 5 open, as a real pass-2 file does', () => {
    expect(navmc10132OffenseRowLocks(form(PASS_2_LOCKS), 0)).toEqual({
      offenceLocked: true,
      findingLocked: false,
    });
  });

  it('closes the finding once the item 9 signature has closed it', () => {
    expect(navmc10132OffenseRowLocks(form([...PASS_2_LOCKS, '1A FINDING']), 0)).toEqual({
      offenceLocked: true,
      findingLocked: true,
    });
  });

  it('answers per row, not for the whole section', () => {
    expect(navmc10132OffenseRowLocks(form(PASS_2_LOCKS), 2).offenceLocked).toBe(false);
  });

  it('locks the row when either half of item 1 is closed', () => {
    expect(navmc10132OffenseRowLocks(form(['1A SUMMARY']), 0).offenceLocked).toBe(true);
  });

  it('is safe past the five rows the form carries', () => {
    expect(navmc10132OffenseRowLocks(form(PASS_2_LOCKS), 9)).toEqual({
      offenceLocked: false,
      findingLocked: false,
    });
  });
});

describe('sections whose field is rendered from structure lock as a whole', () => {
  it('locks the victim editor only when every row A field is closed', () => {
    const partial = form(['22A VICTIM STATUS', '22A VICTIM SEX']);
    const all = form([
      '22A VICTIM STATUS',
      '22A VICTIM SEX',
      '22A VICTIM RACE',
      '22A VICTIM ETHNICITY',
    ]);

    // A partially closed section is still editable, and each input answers
    // for itself. Locking the whole editor off one field would freeze
    // inputs a signature never touched.
    expect(isNavmc10132SectionLocked(partial, 'victims')).toBe(false);
    expect(isNavmc10132SectionLocked(all, 'victims')).toBe(true);
  });

  it('locks the punishment editor from the single rendered field behind it', () => {
    expect(isNavmc10132SectionLocked(form(['6 PUNISHMENT IMPOSED']), 'punishments')).toBe(true);
  });

  it('returns false for a section name it does not know', () => {
    expect(isNavmc10132SectionLocked(form(['17 UNIT']), 'nonsense')).toBe(false);
  });
});

/**
 * META GUARD. `NAVMC_10132_FIELD_TO_KEY` here and the SCALAR_FIELDS and
 * BOOLEAN_FIELDS tables in navmc10132-pdf-to-form.ts describe the same
 * inverse and are written out twice. A field mapped there and missing here
 * loads its value and then offers an editable box over a signed field,
 * which is the exact failure this module exists to prevent, and nothing
 * about it looks wrong on screen.
 */
describe('the lock map stays in step with the mapper', () => {
  it('covers every field the mapper reads back into a document key', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const source = readFileSync(
      resolve(__dirname, '../src/lib/navmc10132-pdf-to-form.ts'),
      'utf8',
    );

    // Every `{ field: '...', key: '...' }` entry in the mapper's tables.
    const mapped = [...source.matchAll(/\{\s*field:\s*'([^']+)',\s*key:\s*'([^']+)'/g)].map(
      (m) => ({ field: m[1], key: m[2] }),
    );
    expect(mapped.length, 'the mapper tables should not be empty').toBeGreaterThan(15);

    const missing = mapped.filter(({ field }) => !(field in NAVMC_10132_FIELD_TO_KEY));
    expect(
      missing.map((m) => m.field),
      'Fields the mapper loads but navmc10132-locks.ts cannot lock. Each one is an ' +
        'editable box over a field a signature may have closed.',
    ).toEqual([]);

    const disagree = mapped.filter(({ field, key }) => NAVMC_10132_FIELD_TO_KEY[field] !== key);
    expect(
      disagree.map((m) => m.field),
      'Fields the two tables map to different document keys.',
    ).toEqual([]);
  });
});
