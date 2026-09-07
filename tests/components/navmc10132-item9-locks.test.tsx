/**
 * D-45: the six fields the item 9 signature was meant to close, and the app
 * closing them because the form does not.
 *
 * DEFECT 3.9, MEASURED NOT ASSUMED. The NAVMC 10132 carries a `/Lock`
 * dictionary on `9 NJP AUTHORITY SIGNATURE` naming items 6, 6 date, 8, 8A,
 * 8B and 10 under field names the form no longer uses, so Acrobat closes
 * nothing and the app reads no lock. Stephen loaded his own signed file on
 * 2026-08-26 and reported items 8, 8A and 8B as still editable. They were,
 * and the file is why: 45 fields came back locked and not one is an item 8
 * field. His signature list is used verbatim below.
 *
 * HIS RULING, same day, choosing among four rules: close them AT THE ITEM 9
 * SIGNATURE. Item 8 names the officer imposing the punishment, and until
 * that officer signs, nobody has attested to the name. A typo in a
 * commanding officer's name or EDIPI has to stay correctable up to that
 * moment, and is part of the signed record after it.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  navmc10132ItemNineAppLocks,
  navmc10132LockedKeys,
  navmc10132LockedFieldNames,
  navmc10132FormLockedFieldNames,
  navmc10132AppLockedFieldNames,
  isNavmc10132KeyLocked,
  isNavmc10132SectionLocked,
  NAVMC_10132_ITEM_9_LOCK_FIELDS,
  NAVMC_10132_ITEM_9_SIGNATURE,
} from '@/lib/navmc10132-locks';
import { PunishmentSection } from '@/components/letter/navmc10132/PunishmentSection';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import { FormData } from '@/types';

/** Item 8 as it stands on Stephen's file, verbatim from the read. */
const ITEM_8 = {
  '8 NJP AUTHORITY NAME TITLE SERVICE': 'CARDENAS, ELENA V',
  '8A NJP AUTHORITY GRADE': 'LtCol, O5',
  '8B NJP AUTHORITY EDIPI': '4000500007',
};

/** Item 6 and item 10 as they stand on it: empty, because item 9 is unsigned. */
const PASS_3_UNSET = {
  '6 PUNISHMENT IMPOSED': '',
  '6 PUNISHMENT IMPOSITION DATE': '',
  '10 DATE OF DISPOSITION NOTICE': '',
};

/** Signatures applied to his file, measured 2026-08-26. Item 9 is NOT among them. */
const HIS_SIGNATURES = ['3 RIGHTS ATTEST SIGNATURE', '2 ACC ELECTION AND RIGHTS SIGNATURE'];

const FILLED = {
  ...ITEM_8,
  '6 PUNISHMENT IMPOSED': 'Restr 14 days, w/o susp fr du.',
  '6 PUNISHMENT IMPOSITION DATE': '2026-08-20',
  '10 DATE OF DISPOSITION NOTICE': '2026-08-20',
};

describe('navmc10132ItemNineAppLocks', () => {
  // The state of his actual file. Nothing is app-locked, which is why item 8
  // was editable, and why it should have been.
  it('locks nothing while item 9 is unsigned, whatever item 8 already says', () => {
    expect(navmc10132ItemNineAppLocks(HIS_SIGNATURES, { ...ITEM_8, ...PASS_3_UNSET })).toEqual([]);
  });

  it('locks all six once item 9 is signed and all six carry values', () => {
    const locked = navmc10132ItemNineAppLocks([...HIS_SIGNATURES, NAVMC_10132_ITEM_9_SIGNATURE], FILLED);
    expect(new Set(locked)).toEqual(new Set(NAVMC_10132_ITEM_9_LOCK_FIELDS));
  });

  /**
   * THE TRAP THIS AVOIDS. The incremental writer refuses every locked field.
   * Locking a field the signed file left BLANK would show the clerk a value,
   * refuse to write it, and drop it silently at export - the data-loss path
   * Stephen already made me close once. A signature closes only what it
   * signed over.
   */
  it('leaves a field the signed file left blank open, so it can still be recorded', () => {
    const locked = navmc10132ItemNineAppLocks(
      [NAVMC_10132_ITEM_9_SIGNATURE],
      { ...ITEM_8, ...FILLED, '10 DATE OF DISPOSITION NOTICE': '' },
    );
    expect(locked).not.toContain('10 DATE OF DISPOSITION NOTICE');
    expect(locked).toContain('8 NJP AUTHORITY NAME TITLE SERVICE');
  });

  it('treats a whitespace-only value as blank, not as something signed', () => {
    const locked = navmc10132ItemNineAppLocks(
      [NAVMC_10132_ITEM_9_SIGNATURE],
      { ...FILLED, '8A NJP AUTHORITY GRADE': '   ' },
    );
    expect(locked).not.toContain('8A NJP AUTHORITY GRADE');
  });

  // Item 5's findings resolve under their real names in the form's own lock
  // list, so they need no mitigation and must not gain a second one here.
  it('covers exactly the six fields defect 3.9 names, and no findings', () => {
    expect([...NAVMC_10132_ITEM_9_LOCK_FIELDS].sort()).toEqual([
      '10 DATE OF DISPOSITION NOTICE',
      '6 PUNISHMENT IMPOSED',
      '6 PUNISHMENT IMPOSITION DATE',
      '8 NJP AUTHORITY NAME TITLE SERVICE',
      '8A NJP AUTHORITY GRADE',
      '8B NJP AUTHORITY EDIPI',
    ]);
  });
});

// ---------------------------------------------------------------------------
// What the rest of the app sees
// ---------------------------------------------------------------------------

function loaded(lockedFields: string[], appLockedFields: string[], values: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    stage: 3,
    navmc10132LoadReport: { fileName: 'signed.pdf', lockedFields, appLockedFields },
    ...values,
  } as unknown as FormData;
}

describe('an app lock reaches every consumer a form lock does', () => {
  it('closes the item 8 inputs, which is what Stephen asked for', () => {
    const keys = navmc10132LockedKeys(loaded([], [...NAVMC_10132_ITEM_9_LOCK_FIELDS]));
    expect(keys.has('njpAuthorityName')).toBe(true);
    expect(keys.has('njpAuthorityGrade')).toBe(true);
    expect(keys.has('njpAuthorityEdipi')).toBe(true);
  });

  // The writer refuses by FIELD name, not by document-state key, and items 6
  // and 21 have no input at all, so it needs the field vocabulary.
  it('reaches the incremental writer refusal list', () => {
    const fields = navmc10132LockedFieldNames(loaded([], ['8 NJP AUTHORITY NAME TITLE SERVICE']));
    expect(fields.has('8 NJP AUTHORITY NAME TITLE SERVICE')).toBe(true);
  });

  it('closes the punishment builder, which prints from structure', () => {
    expect(isNavmc10132SectionLocked(loaded([], ['6 PUNISHMENT IMPOSED']), 'punishments')).toBe(true);
    expect(isNavmc10132SectionLocked(loaded([], []), 'punishments')).toBe(false);
  });

  // An export refusal has to be able to say which authority closed a field,
  // because "the form closed it" and "the app closed it because the form
  // failed to" are different statements to a clerk.
  it('stays distinguishable from a form lock', () => {
    const doc = loaded(['17 UNIT'], ['8A NJP AUTHORITY GRADE']);
    expect([...navmc10132FormLockedFieldNames(doc)]).toEqual(['17 UNIT']);
    expect([...navmc10132AppLockedFieldNames(doc)]).toEqual(['8A NJP AUTHORITY GRADE']);
    expect(navmc10132LockedFieldNames(doc).size).toBe(2);
  });

  it('a document with no loaded file has neither kind', () => {
    const fresh = { documentType: 'navmc10132', ...createEmptyNavmc10132Data() } as unknown as FormData;
    expect(navmc10132LockedFieldNames(fresh).size).toBe(0);
    expect(isNavmc10132KeyLocked(fresh, 'njpAuthorityName')).toBe(false);
  });

  // An older autosaved document predates the field entirely.
  it('survives a load report written before appLockedFields existed', () => {
    const old = {
      documentType: 'navmc10132',
      ...createEmptyNavmc10132Data(),
      navmc10132LoadReport: { fileName: 'old.pdf', lockedFields: ['17 UNIT'] },
    } as unknown as FormData;
    expect(navmc10132LockedFieldNames(old).size).toBe(1);
    expect(navmc10132AppLockedFieldNames(old).size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// The section itself
// ---------------------------------------------------------------------------

function StubSectionCard({ title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function show(formData: FormData) {
  return render(
    <PunishmentSection formData={formData} setFormData={vi.fn()} SectionCard={StubSectionCard} />,
  );
}

describe('the punishment section on a document whose item 9 is signed', () => {
  const signed = () =>
    loaded([], [...NAVMC_10132_ITEM_9_LOCK_FIELDS], {
      punishmentDate: '2026-08-20',
      dispositionNoticeDate: '2026-08-21',
    });

  it('says why the builder is closed instead of silently disabling it', () => {
    show(signed());
    expect(screen.getByText(/signed by the imposing officer/)).toBeInTheDocument();
  });

  it('shows the two dates as signed values, not as pickers', () => {
    show(signed());
    expect(screen.getByText('2026-08-20')).toBeInTheDocument();
    expect(screen.getByText('2026-08-21')).toBeInTheDocument();
  });

  it('disables the add control, which feeds the signed item 6 string', () => {
    show(signed());
    expect(screen.getByRole('button', { name: /^Add$/ })).toBeDisabled();
  });

  /**
   * MOVED OUT 2026-08-26. The script now has its own card ahead of this one,
   * so the assertion here is the inverse: locking the punishment builder
   * cannot hide the generator, because the generator is no longer inside it.
   * Its own coverage lives in navmc10132-proceeding-script.test.tsx.
   */
  it('no longer carries the A-1-f generator at all', () => {
    show(signed());
    expect(screen.queryByText(/JAGMAN Appendix A-1-f/)).not.toBeInTheDocument();
  });
});

describe('the punishment section on Stephen own pass-2 file', () => {
  // The regression for exactly what he reported. His file has item 9
  // unsigned, so nothing here is closed and the clerk does pass-3 work.
  const his = () => loaded([], [], { punishmentDate: '', dispositionNoticeDate: '' });

  it('closes nothing, because the imposing officer has not signed', () => {
    show(his());
    expect(screen.queryByText(/signed by the imposing officer/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Add$/ })).toBeDisabled(); // no code picked yet
    expect(screen.queryByText('blank on the signed file')).not.toBeInTheDocument();
  });
});
