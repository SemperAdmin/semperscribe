// Vitest suite for src/lib/njp-appeal-package.ts.
//
// This module previously had NO tests at all, and its checklist logic ran
// on every case, vacation-only actions included, presenting a right of
// appeal MCO 5800.16 Vol 14 para 011201 says does not exist. These tests
// cover the three-branch design that replaced it: an ordinary appeal (or a
// vacation on which additional punishment was imposed) still gets the
// unmodified 011107 checklist; a vacation-only action gets no checklist at
// all, only the 011201 "no right of appeal" statement and the JAGMAN
// 0118.d Article 138 remedy; and a vacation remark with no stated outcome
// gets BOTH, unresolved, plus the one fact that decides between them.

import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { createEmptyNavmc10132Data, NAVMC_10132_APPEAL_INTENT, type Navmc10132Remark } from '@/types/navmc';

import { appealPackage, type AppealRightsPackage } from '@/lib/njp-appeal-package';

// ---------------------------------------------------------------------------
// Fixture helpers, matching the style in tests/njp-suspension-period.test.ts
// ---------------------------------------------------------------------------

function baseForm(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    ...overrides,
  };
}

/** One structured item 21 vacation-of-suspended-NJP remark. Content of
 * `detail`/`date` do not matter to appealPackage, only `kind`. */
function vacationRemark(): Navmc10132Remark {
  return { date: '2026-06-01', kind: 'suspension-vacated-njp', detail: 'Extra duty' };
}

// ---------------------------------------------------------------------------
// No vacation remark at all: an ordinary appeal from NJP. The
// `additionalPunishment` argument is irrelevant here and is exercised both
// omitted and (deliberately, to prove it is ignored) supplied.
// ---------------------------------------------------------------------------

describe('appealPackage: no vacation remark on this UPB', () => {
  it('returns the appeal-rights checklist, applies true, when item 12 records intent to appeal', () => {
    const result = appealPackage(baseForm({ intendAppeal: NAVMC_10132_APPEAL_INTENT.WILL }));
    expect(result.kind).toBe('appeal-rights');
    expect(result.applies).toBe(true);
  });

  it('returns the appeal-rights checklist, applies false, with no intent and no appeal date', () => {
    const result = appealPackage(baseForm());
    expect(result.kind).toBe('appeal-rights');
    expect(result.applies).toBe(false);
  });

  it('is unaffected by additionalPunishment when there is no vacation remark to condition on', () => {
    const form = baseForm({ intendAppeal: NAVMC_10132_APPEAL_INTENT.WILL });
    const withArg = appealPackage(form, 'not-imposed');
    const withoutArg = appealPackage(form);
    expect(withArg).toEqual(withoutArg);
    expect(withArg.kind).toBe('appeal-rights');
  });
});

// ---------------------------------------------------------------------------
// A vacation remark is present and additional punishment WAS imposed
// elsewhere: 011201's "the right to appeal applies", so the 011107
// checklist is the right answer, byte-for-byte the same as the no-vacation
// case above.
// ---------------------------------------------------------------------------

describe('appealPackage: vacation remark present, additionalPunishment "imposed"', () => {
  it('produces the same appeal-rights checklist the no-vacation case produces', () => {
    const withVacation = appealPackage(
      baseForm({ remarks: [vacationRemark()], intendAppeal: NAVMC_10132_APPEAL_INTENT.WILL }),
      'imposed',
    );
    const withoutVacation = appealPackage(baseForm({ intendAppeal: NAVMC_10132_APPEAL_INTENT.WILL }));
    expect(withVacation).toEqual(withoutVacation);
  });

  it('still gates applies on item 12/13, not on additionalPunishment', () => {
    const result = appealPackage(baseForm({ remarks: [vacationRemark()] }), 'imposed');
    expect(result.kind).toBe('appeal-rights');
    expect(result.applies).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// A vacation remark is present and only the suspended punishment was
// vacated: no right of appeal, MCO 011201, and the Article 138 remedy from
// JAGMAN 0118.d. No 011107 checklist is built around a right that does not
// exist.
// ---------------------------------------------------------------------------

describe('appealPackage: vacation remark present, additionalPunishment "not-imposed"', () => {
  it('states no right of appeal, citing 011201, and names the Article 138 remedy, citing 0118.d', () => {
    const result = appealPackage(baseForm({ remarks: [vacationRemark()] }), 'not-imposed');
    expect(result.kind).toBe('vacation-only');
    if (result.kind !== 'vacation-only') throw new Error('unreachable');
    expect(result.applies).toBe(false);
    expect(result.noAppealRight).toContain('no right of appeal');
    expect(result.noAppealRight).toContain('MCO 5800.16 Vol 14 para 011201');
    expect(result.article138Remedy).toContain('Article 138');
    expect(result.article138Remedy).toContain('JAGMAN (JAGINST 5800.7G CH-2) para 0118.d');
  });

  it('says no right of appeal even when item 12 records an intent to appeal', () => {
    // A Marine (or a clerk) may record intent to appeal on item 12 in the
    // mistaken belief that a vacation carries a right of appeal. 011201
    // says it does not, regardless of what item 12 says, so this branch
    // must not be gated on `applies`-style intent fields the way the
    // ordinary checklist is.
    const result = appealPackage(
      baseForm({ remarks: [vacationRemark()], intendAppeal: NAVMC_10132_APPEAL_INTENT.WILL }),
      'not-imposed',
    );
    expect(result.kind).toBe('vacation-only');
    expect(result.applies).toBe(false);
  });

  it('emits no em dash in any user-facing vacation-only string', () => {
    const result = appealPackage(baseForm({ remarks: [vacationRemark()] }), 'not-imposed');
    if (result.kind !== 'vacation-only') throw new Error('unreachable');
    expect(result.noAppealRight).not.toContain('—');
    expect(result.article138Remedy).not.toContain('—');
  });
});

// ---------------------------------------------------------------------------
// A vacation remark is present and the caller has not said which outcome
// applies. This module does not guess, in either direction: it reports
// both branches, unresolved, plus the fact that would resolve them.
// ---------------------------------------------------------------------------

describe('appealPackage: vacation remark present, additionalPunishment not stated', () => {
  it('reports both outcomes in full and does not resolve to either', () => {
    const form = baseForm({ remarks: [vacationRemark()], intendAppeal: NAVMC_10132_APPEAL_INTENT.WILL });
    const result = appealPackage(form);
    expect(result.kind).toBe('unstated');
    if (result.kind !== 'unstated') throw new Error('unreachable');
    expect(result.applies).toBe(false);

    // The "if imposed" branch is the exact same checklist the resolved
    // 'imposed' case produces.
    expect(result.ifAdditionalPunishmentImposed).toEqual(appealPackage(form, 'imposed'));

    // The "if vacation only" branch is the exact same statement the
    // resolved 'not-imposed' case produces.
    expect(result.ifVacationOnly).toEqual(appealPackage(form, 'not-imposed'));
  });

  it('names the deciding fact: additional NJP punishment on a separate UPB for the same offense(s)', () => {
    const result = appealPackage(baseForm({ remarks: [vacationRemark()] }));
    expect(result.kind).toBe('unstated');
    if (result.kind !== 'unstated') throw new Error('unreachable');
    expect(result.decidingFact).toContain('additional NJP');
    expect(result.decidingFact).toContain('separate UPB');
    expect(result.decidingFact).toContain('MCO 5800.16 Vol 14 para 011201');
  });

  it('is the result of an explicit omission, not the same as passing an unrecognized value', () => {
    // TypeScript would reject a bogus third value at compile time; this
    // documents the runtime behavior for the one value JS can still pass:
    // undefined, exactly what an omitted optional argument produces.
    const form = baseForm({ remarks: [vacationRemark()] });
    expect(appealPackage(form, undefined).kind).toBe('unstated');
  });
});

// ---------------------------------------------------------------------------
// Four-state item model, unchanged for the appeal-rights case. Per the
// module's own JSDoc: unverifiable items are not satisfied and are not
// failures, and the record-of-service item is the one conditional case,
// not-applicable above corporal rather than a green tick.
// ---------------------------------------------------------------------------

describe('appeal-rights checklist: the four-state item model', () => {
  function checklist(form: FormData): AppealRightsPackage {
    const result = appealPackage(form);
    if (result.kind !== 'appeal-rights') throw new Error(`Expected appeal-rights, got ${result.kind}`);
    return result;
  }

  it('marks most items unverifiable and counts them, never silently treating them as satisfied', () => {
    const result = checklist(baseForm({ intendAppeal: NAVMC_10132_APPEAL_INTENT.WILL }));
    const jagman = result.items.find((i) => i.id === 'jagman-0116-0117');
    expect(jagman?.state).toBe('unverifiable');
    expect(result.unverifiableCount).toBe(result.items.filter((i) => i.state === 'unverifiable').length);
    expect(result.unverifiableCount).toBeGreaterThan(0);
  });

  it('marks item 15 unsatisfied with no notice date, satisfied once one is recorded', () => {
    const unsatisfied = checklist(
      baseForm({ intendAppeal: NAVMC_10132_APPEAL_INTENT.WILL, appealDecisionNoticeDate: '' }),
    );
    const item15Unsatisfied = unsatisfied.items.find((i) => i.id === 'item-15');
    expect(item15Unsatisfied?.state).toBe('unsatisfied');
    expect(unsatisfied.unsatisfiedCount).toBeGreaterThan(0);

    const satisfied = checklist(
      baseForm({
        intendAppeal: NAVMC_10132_APPEAL_INTENT.WILL,
        appealDecisionNoticeDate: '2026-07-01',
      }),
    );
    const item15Satisfied = satisfied.items.find((i) => i.id === 'item-15');
    expect(item15Satisfied?.state).toBe('satisfied');
    expect(item15Satisfied?.detail).toContain('2026-07-01');
  });

  it('marks block 14 unsatisfied when item 14 carries neither a decision nor a decision date', () => {
    const result = checklist(
      baseForm({ intendAppeal: NAVMC_10132_APPEAL_INTENT.WILL, appealDecision: '', appealDecisionDate: '' }),
    );
    const block14 = result.items.find((i) => i.id === 'block-14-signed');
    expect(block14?.state).toBe('unsatisfied');
  });

  it('marks block 14 unverifiable, not satisfied, once a decision is recorded (no signature is visible)', () => {
    const result = checklist(
      baseForm({ intendAppeal: NAVMC_10132_APPEAL_INTENT.WILL, appealDecision: 'Denied', appealDecisionDate: '2026-07-01' }),
    );
    const block14 = result.items.find((i) => i.id === 'block-14-signed');
    expect(block14?.state).toBe('unverifiable');
  });
});

// ---------------------------------------------------------------------------
// The corporals-and-below conditional on the Record of Service, unchanged.
// ---------------------------------------------------------------------------

describe('appeal-rights checklist: Record of Service conditional on grade', () => {
  function recordOfServiceState(payGrade: string): string {
    const result = appealPackage(baseForm({ intendAppeal: NAVMC_10132_APPEAL_INTENT.WILL, accusedPayGrade: payGrade }));
    if (result.kind !== 'appeal-rights') throw new Error(`Expected appeal-rights, got ${result.kind}`);
    const item = result.items.find((i) => i.id === 'record-of-service');
    if (!item) throw new Error('record-of-service item missing');
    return item.state;
  }

  it('is unverifiable (required, held outside the app) at E-4 and below', () => {
    expect(recordOfServiceState('E4')).toBe('unverifiable');
    expect(recordOfServiceState('E1')).toBe('unverifiable');
  });

  it('is not-applicable above corporal', () => {
    expect(recordOfServiceState('E5')).toBe('not-applicable');
    expect(recordOfServiceState('E9')).toBe('not-applicable');
  });

  it('is unverifiable when the pay grade cannot be read at all', () => {
    expect(recordOfServiceState('')).toBe('unverifiable');
    expect(recordOfServiceState('not a grade')).toBe('unverifiable');
  });
});
