/**
 * DD 1561 rules against the worked examples of DoD FMR Vol 7A Ch 27
 * (October 2025). Years are chosen where the FMR's February arithmetic
 * needs a non-leap year (2026); the leap-year case is pinned separately.
 */
import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { createDd1561Defaults, type Dd1561FsaTRow, type Dd1561ShipSegment } from '@/types/dd1561';
import { Dd1561Schema } from '@/lib/schemas';
import { DD1561_ALL_FIELD_NAMES, DD1561_FIELDS, DD1561_FSA_R, DD1561_FSA_T_ROWS } from '@/lib/dd1561-fields';
import {
  addDays,
  constructiveDeparture,
  constructiveReturn,
  countFsaS,
  countFsaT,
  dd1561CheckBoxes,
  dd1561DayCount,
  dd1561FieldValues,
  dd1561FsaTContinuationRows,
  DD1561_NEVER_SET_FIELDS,
  evaluateDd1561Eligibility,
  evaluateRedeployment,
  formatInclusiveDates,
  fsaRStart,
  inclusiveDays,
  isIsoDate,
  toDdmmyy,
} from '@/lib/dd1561-rules';

const row = (location: string, from: string, to: string, o: Partial<Dd1561FsaTRow> = {}): Dd1561FsaTRow => ({ location, from, to, ...o });
const away = (from: string, to: string, o: Partial<Dd1561ShipSegment> = {}): Dd1561ShipSegment => ({ status: 'away', from, to, ...o });

/** A married member with an eligible FSA-T claim of 32 days (FMR 4.4.1 Ex. 1). */
const eligibleT = (o: Record<string, unknown> = {}): FormData => ({
  ...createDd1561Defaults(),
  dd1561MemberName: 'MARINE, TEST A',
  dd1561Grade: 'SGT',
  dd1561Edipi: '1234567890',
  dd1561BranchOrganization: 'USMC, 1ST BN 5TH MAR',
  dd1561DependentAddresses: '123 MAIN ST, OCEANSIDE CA 92054',
  dd1561FsaType: 'T',
  dd1561MaritalStatus: 'married',
  dd1561DependentOnActiveDuty: false,
  dd1561SoleDependentInstitutionalized: false,
  dd1561AllDependentsNear: false,
  dd1561PermissiveOrders: false,
  dd1561LastTdyWithin30: 'was-not',
  dd1561FsaTRows: [row('SITE B', '2026-05-25', '2026-06-30')],
  dd1561FsaTLeaveBeforeDays: 5,
  dd1561OrdersAuthority: 'TAD ORDERS 123-26',
  dd1561OrdersDate: '2026-05-01',
  dd1561BahWithDependentsConfirmed: true,
  ...o,
}) as unknown as FormData;

const codes = (data: FormData) => evaluateDd1561Eligibility(data).blockers.map((b) => b.code);
const warnCodes = (data: FormData) => evaluateDd1561Eligibility(data).warnings.map((b) => b.code);

describe('dates', () => {
  it('prints DDMMYY: day, month, two-digit year, no separators', () => {
    expect(toDdmmyy('2026-11-24')).toBe('241126');
    expect(toDdmmyy('2026-01-05')).toBe('050126');
    expect(toDdmmyy('2000-12-31')).toBe('311200');
  });

  it('prints nothing for a missing or impossible date', () => {
    expect(toDdmmyy('')).toBe('');
    expect(toDdmmyy('2026-02-30')).toBe('');
    expect(toDdmmyy('24/11/2026')).toBe('');
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
  });

  it('prints inclusive dates as "DDMMYY - DDMMYY"', () => {
    expect(formatInclusiveDates('2026-05-30', '2026-06-30')).toBe('300526 - 300626');
    expect(formatInclusiveDates('2026-05-30', '')).toBe('');
  });

  it('counts inclusively and across months without a time-zone shift', () => {
    expect(inclusiveDays('2026-03-07', '2026-03-09')).toBe(3); // across the US DST change
    expect(inclusiveDays('2026-06-01', '2026-06-01')).toBe(1);
    expect(inclusiveDays('2026-06-02', '2026-06-01')).toBeNull();
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('counts the 31st day of a month (FMR 4.4.1.1, 4.4.3)', () => {
    expect(countFsaT({ rows: [row('X', '2026-07-01', '2026-07-31')] }).exceedsThirty).toBe(true);
    expect(countFsaT({ rows: [row('X', '2026-06-01', '2026-06-30')] }).exceedsThirty).toBe(false);
    expect(countFsaT({ rows: [row('X', '2026-07-01', '2026-07-31')] }).qualifyingDays).toBe(31);
  });
});

describe('FSA-T single period (FMR 4.4.1)', () => {
  it('Ex. 1: leave en route makes 30 May the constructive departure; 32 days qualify', () => {
    const c = countFsaT({ rows: [row('SITE B', '2026-05-25', '2026-06-30')], leaveBeforeDays: 5 });
    expect(c.constructiveDeparture).toBe('2026-05-30');
    expect(c.periods).toHaveLength(1);
    expect(c.qualifyingDays).toBe(32);
    expect(c.exceedsThirty).toBe(true);
    expect(c.rows[0]).toMatchObject({ inclusiveDates: '300526 - 300626', days: 32 });
  });

  it('Ex. 2: leave after the TDY makes 30 Jun the constructive return; 32 days qualify', () => {
    const c = countFsaT({ rows: [row('SITE B', '2026-05-30', '2026-07-05')], leaveAfterDays: 5 });
    expect(c.constructiveReturn).toBe('2026-06-30');
    expect(c.qualifyingDays).toBe(32);
    expect(c.rows[0].inclusiveDates).toBe('300526 - 300626');
  });

  it('constructive departure is never before the first day of authorized travel (4.4.1.2.1)', () => {
    expect(constructiveDeparture('2026-05-25', 2, '2026-05-30')).toBe('2026-05-30');
    expect(constructiveDeparture('2026-05-25', 5, '2026-05-26')).toBe('2026-05-30');
    expect(constructiveReturn('2026-07-05', 5)).toBe('2026-06-30');
  });

  it('4.3 Example: departed 9 Aug, the 31st day (qualifying day) is 8 Sep', () => {
    const c = countFsaT({ rows: [row('DEPLOYED', '2026-08-09', '2026-11-10')] });
    expect(c.periods[0].qualifiedOn).toBe('2026-09-08');
  });

  it('consecutive TDY legs combine; per-row days are each row\'s inclusive count (4.4.1.3)', () => {
    const c = countFsaT({ rows: [row('A', '2026-06-01', '2026-06-15'), row('B', '2026-06-15', '2026-07-10')] });
    expect(c.periods).toHaveLength(1);
    expect(c.qualifyingDays).toBe(40);
    expect(c.rows.map((r) => r.days)).toEqual([15, 26]);
  });

  it('an interruption is never combined (4.4.1.5)', () => {
    const rows = [row('A', '2026-06-01', '2026-06-20'), row('B', '2026-06-21', '2026-07-10', { interruptedBefore: true })];
    const c = countFsaT({ rows });
    expect(c.periods.map((p) => p.days)).toEqual([20, 20]);
    expect(c.exceedsThirty).toBe(false);
    expect(countFsaT({ rows: rows.map((r) => ({ ...r, interruptedBefore: false })) }).qualifyingDays).toBe(40);
  });

  it('a gap between rows splits the period', () => {
    const c = countFsaT({ rows: [row('A', '2026-06-01', '2026-06-20'), row('B', '2026-06-25', '2026-07-20')] });
    expect(c.periods).toHaveLength(2);
  });
});

describe('FSA-T and FSA-S multiple periods (FMR 4.4.2, 4.4.4)', () => {
  const cur = (from: string, to: string) => countFsaT({ rows: [row('B', from, to)] }).periods[0];

  it('4.4.2 Ex. 1: 45-day TDY, 30-day interim, 35-day redeployment -> 65 days', () => {
    const r = evaluateRedeployment({ priorType: 'T', priorFrom: '2026-01-02', priorTo: '2026-02-15', currentType: 'T', current: cur('2026-03-18', '2026-04-21') });
    expect(r).toMatchObject({ priorDays: 45, interimDays: 30, redeploymentDays: 35, continues: true, creditedDays: 65 });
  });

  it('4.4.2 Ex. 2: a 31-day interim is not covered; the 40-day redeployment stands alone', () => {
    const r = evaluateRedeployment({ priorType: 'T', priorFrom: '2026-03-01', priorTo: '2026-04-29', currentType: 'T', current: cur('2026-05-31', '2026-07-09') });
    expect(r).toMatchObject({ priorDays: 60, interimDays: 31, redeploymentDays: 40, continues: false, creditedDays: 40 });
  });

  it('4.4.2 Ex. 3: a 0-day interim continues (31-day TDY, then 41 days)', () => {
    const r = evaluateRedeployment({ priorType: 'T', priorFrom: '2026-06-01', priorTo: '2026-07-01', currentType: 'T', current: cur('2026-07-02', '2026-08-11') });
    expect(r).toMatchObject({ priorDays: 31, interimDays: 0, redeploymentDays: 41, continues: true, creditedDays: 41 });
  });

  it('4.4.2.3.2: a redeployment of 30 days or fewer earns nothing, whatever the interim', () => {
    const r = evaluateRedeployment({ priorType: 'T', priorFrom: '2026-01-02', priorTo: '2026-02-15', currentType: 'T', current: cur('2026-02-20', '2026-03-21') });
    expect(r).toMatchObject({ interimDays: 4, redeploymentDays: 30, continues: false, creditedDays: 0 });
  });

  it('a prior period of 30 days did not qualify, so it does not continue', () => {
    const r = evaluateRedeployment({ priorType: 'T', priorFrom: '2026-06-01', priorTo: '2026-06-30', currentType: 'T', current: cur('2026-07-02', '2026-08-11') });
    expect(r.priorQualified).toBe(false);
    expect(r.continues).toBe(false);
  });

  it('4.4.5.1: a ship period never continues a TDY claim', () => {
    const r = evaluateRedeployment({ priorType: 'S', priorFrom: '2026-01-02', priorTo: '2026-02-15', currentType: 'T', current: cur('2026-03-18', '2026-04-21') });
    expect(r.sameKind).toBe(false);
    expect(r.continues).toBe(false);
    expect(warnCodes(eligibleT({
      dd1561LastTdyWithin30: 'was', dd1561PriorPeriodType: 'S', dd1561PriorPeriodFrom: '2026-01-02', dd1561PriorPeriodTo: '2026-02-15',
      dd1561FsaTRows: [row('B', '2026-03-18', '2026-04-21')], dd1561FsaTLeaveBeforeDays: 0,
    }))).toContain('redeployment-kind-mismatch');
  });

  it('4.4.4 Ex. 1: the ship equivalent gives 65 days', () => {
    const current = countFsaS([away('2026-03-18', '2026-04-21')]).periods[0];
    const r = evaluateRedeployment({ priorType: 'S', priorFrom: '2026-01-02', priorTo: '2026-02-15', currentType: 'S', current });
    expect(r).toMatchObject({ continues: true, creditedDays: 65 });
  });

  it('reads 8g from the form data and notes the continuation', () => {
    const data = eligibleT({
      dd1561LastTdyWithin30: 'was', dd1561PriorPeriodType: 'T', dd1561PriorPeriodFrom: '2026-01-02', dd1561PriorPeriodTo: '2026-02-15',
      dd1561FsaTRows: [row('B', '2026-03-18', '2026-04-21')], dd1561FsaTLeaveBeforeDays: 0,
    });
    expect(dd1561DayCount(data).redeployment?.creditedDays).toBe(65);
    expect(warnCodes(data)).toContain('redeployment-continues');
  });
});

describe('FSA-S single period (FMR 4.4.3)', () => {
  it('Ex. 1: 15 Jun to 15 Jul is 31 days and qualifies', () => {
    expect(countFsaS([away('2026-06-15', '2026-07-15')])).toMatchObject({ qualifyingDays: 31, exceedsThirty: true, commencingDate: '2026-06-15' });
  });

  it('Ex. 2: 5 Oct to 4 Nov is 31 days', () => {
    expect(countFsaS([away('2026-10-05', '2026-11-04')]).qualifyingDays).toBe(31);
  });

  it('Ex. 3: 25 Feb to 26 Mar in a non-leap year is 30 days and does not qualify', () => {
    const c = countFsaS([away('2026-02-25', '2026-03-26')]);
    expect(c.qualifyingDays).toBe(30);
    expect(c.exceedsThirty).toBe(false);
    // In a leap year the same dates give 31.
    expect(countFsaS([away('2028-02-25', '2028-03-26')]).exceedsThirty).toBe(true);
  });

  it('Ex. 4: joining the ship away from homeport on 25 May, return 30 Jun: 37 days', () => {
    expect(countFsaS([away('2026-05-25', '2026-06-30')]).qualifyingDays).toBe(37);
  });

  it('Ex. 5: consecutive ships (detached and attached the same day) combine: 36 days', () => {
    const c = countFsaS([away('2026-08-02', '2026-08-18', { shipUnit: 'SHIP A' }), away('2026-08-18', '2026-09-06', { shipUnit: 'SHIP B' })]);
    expect(c.periods).toHaveLength(1);
    expect(c.qualifyingDays).toBe(36);
  });

  it('Ex. 6: days at homeport under orders to remain aboard count: 31 days', () => {
    const c = countFsaS([
      away('2026-06-15', '2026-06-19'),
      { status: 'remain-aboard-orders', from: '2026-06-19', to: '2026-07-02' },
      away('2026-07-03', '2026-07-15'),
    ]);
    expect(c.periods).toHaveLength(1);
    expect(c.qualifyingDays).toBe(31);
  });

  it('days kept aboard for disciplinary reasons do not count (2.3.1.2.2)', () => {
    const c = countFsaS([
      away('2026-06-15', '2026-06-19'),
      { status: 'remain-aboard-disciplinary', from: '2026-06-19', to: '2026-07-02' },
      away('2026-07-03', '2026-07-15'),
    ]);
    expect(c.periods.map((p) => p.days)).toEqual([5, 13]);
    expect(c.exceedsThirty).toBe(false);
  });

  it('a deployment with no return date yet is open-ended, a warning not a blocker', () => {
    const data = eligibleT({ dd1561FsaType: 'S', dd1561FsaSSegments: [away('2026-11-01', '')], dd1561FsaSShipUnit: 'USS X', dd1561FsaSHomeport: 'SAN DIEGO' });
    expect(countFsaS([away('2026-11-01', '')]).openEnded).toBe(true);
    expect(codes(data)).not.toContain('not-more-than-30');
    expect(warnCodes(data)).toContain('not-yet-30');
  });

  it('never mixes TDY rows into an FSA-S count (4.4.5.1)', () => {
    const data = eligibleT({ dd1561FsaType: 'S', dd1561FsaSSegments: [away('2026-02-25', '2026-03-26')] });
    expect(dd1561DayCount(data).qualifyingDays).toBe(30);
    expect(codes(data)).toContain('not-more-than-30');
  });
});

describe('FSA-R start (Table 27-1 rules 1-2, Table 27-4 note 4)', () => {
  it('starts on the detachment date with no leave or proceed time', () => {
    expect(fsaRStart({ documentType: 'dd1561', dd1561FsaRDetachDate: '2026-06-01' } as FormData).startDate).toBe('2026-06-01');
  });

  it('starts on the constructive detachment date after leave and proceed days', () => {
    const s = fsaRStart({
      documentType: 'dd1561', dd1561FsaRDetachDate: '2026-06-01',
      dd1561FsaRLeaveFrom: '2026-06-01', dd1561FsaRLeaveTo: '2026-06-10',
      dd1561FsaRProceedFrom: '2026-06-11', dd1561FsaRProceedTo: '2026-06-14',
    } as FormData);
    expect(s).toEqual({ leaveDays: 10, proceedDays: 4, startDate: '2026-06-15' });
  });

  it('has no 30-day test', () => {
    const d = dd1561DayCount({ documentType: 'dd1561', dd1561FsaType: 'R', dd1561FsaRDetachDate: '2026-06-01' } as FormData);
    expect(d.periods).toEqual([]);
    expect(d.fsaR?.startDate).toBe('2026-06-01');
  });
});

describe('eligibility', () => {
  it('a married member with a 32-day TDY is eligible', () => {
    const e = evaluateDd1561Eligibility(eligibleT());
    expect(e.blockers).toEqual([]);
    expect(e.eligible).toBe(true);
    expect(e.basis.spouse).toBe(true);
  });

  it('does not count a dependent on active duty, without blocking the claim (owner decision, FMR 3.1.5)', () => {
    const e = evaluateDd1561Eligibility(eligibleT({ dd1561HasChildren: true, dd1561ChildCustody: 'member', dd1561DependentOnActiveDuty: true }));
    expect(e.blockers.map((b) => b.code)).not.toContain('dependent-on-active-duty');
    const w = e.warnings.find((x) => x.code === 'dependent-on-active-duty');
    expect(w?.citation).toContain('3.1.5');
    expect(w?.message).toMatch(/does not count/);
    expect(e.eligible).toBe(true);
    // Block 8c stays blank: its sentence would be untrue.
    expect(dd1561CheckBoxes(eligibleT({ dd1561HasChildren: true, dd1561ChildCustody: 'member', dd1561DependentOnActiveDuty: true })).cert8c).toBe(false);
  });

  it.each([
    ['type-missing', { dd1561FsaType: '' }, '2.1'],
    ['no-dependents', { dd1561MaritalStatus: 'never-married' }, '2.1'],
    ['no-dependents', { dd1561MaritalStatus: 'divorced' }, '2.3.1'],
    ['legally-separated-spouse', { dd1561MaritalStatus: 'legally-separated' }, '3.1.2'],
    ['child-custody-other', { dd1561MaritalStatus: 'divorced', dd1561HasChildren: true, dd1561ChildCustody: 'other-person' }, '3.1.2'],
    ['child-joint-under-14', { dd1561MaritalStatus: 'divorced', dd1561HasChildren: true, dd1561ChildCustody: 'joint-under-14' }, '3.1.3'],
    ['custody-unanswered', { dd1561MaritalStatus: 'divorced', dd1561HasChildren: true, dd1561ChildCustody: '' }, '2.2.1.1'],
    ['parent-dependency-not-approved', { dd1561MaritalStatus: 'never-married', dd1561ClaimsParent: true, dd1561ParentResidesWithMember: true }, '8e'],
    ['parent-not-in-member-home', { dd1561MaritalStatus: 'never-married', dd1561ClaimsParent: true, dd1561ParentDependencyApproved: true, dd1561ParentResidesWithMember: false }, '3.1.4'],
    ['sole-dependent-institutionalized', { dd1561SoleDependentInstitutionalized: true }, '3.1.1'],
    ['dual-mil-not-residing-together', { dd1561DualMilitary: true, dd1561SpouseResidingTogether: 'was-not' }, '2.3.4.1'],
    ['dual-mil-residing-unanswered', { dd1561DualMilitary: true, dd1561SpouseResidingTogether: '' }, '2.3.4.1'],
    ['dual-mil-one-per-couple', { dd1561DualMilitary: true, dd1561SpouseResidingTogether: 'was', dd1561SpouseReceivingFsa: true }, '2.3.4.1.1'],
    ['permissive-orders', { dd1561PermissiveOrders: true }, '4.1.1.3'],
    ['dependents-near', { dd1561AllDependentsNear: true }, '3.3.1'],
    ['not-more-than-30', { dd1561FsaTRows: [row('B', '2026-06-01', '2026-06-30')], dd1561FsaTLeaveBeforeDays: 0 }, '4.4.1'],
  ])('blocks %s with its citation', (code, overrides, para) => {
    const b = evaluateDd1561Eligibility(eligibleT(overrides)).blockers.find((x) => x.code === code);
    expect(b, `no ${code} blocker`).toBeDefined();
    expect(b!.citation).toMatch(/DoD FMR Vol 7A Ch 27|DD 1561/);
    expect(b!.citation).toContain(para);
    expect(b!.message.length).toBeGreaterThan(10);
  });

  it.each([
    ['fsa-r-elected-unaccompanied', { dd1561FsaRElectedUnaccompanied: true }, '4.1.3.1'],
    ['fsa-r-transport-authorized', { dd1561FsaRTransportAuthorized: true }, '4.1.1.1'],
  ])('FSA-R blocks %s with its citation', (code, overrides, para) => {
    const data = eligibleT({ dd1561FsaType: 'R', ...overrides });
    const b = evaluateDd1561Eligibility(data).blockers.find((x) => x.code === code);
    expect(b?.citation).toContain(para);
  });

  it('FSA-R certified-medical exception lifts the elected-unaccompanied bar, with a block 11 note', () => {
    const data = eligibleT({ dd1561FsaType: 'R', dd1561FsaRElectedUnaccompanied: true, dd1561FsaRTransportAuthorized: true, dd1561FsaRCertifiedMedical: true });
    expect(codes(data)).toEqual([]);
    expect(warnCodes(data)).toContain('fsa-r-certified-medical');
  });

  it('a Secretarial waiver lifts the FSA-R bars, noting its effective date', () => {
    const data = eligibleT({ dd1561FsaType: 'R', dd1561FsaRElectedUnaccompanied: true, dd1561FsaRSecretarialWaiver: true });
    expect(codes(data)).toEqual([]);
    expect(warnCodes(data)).toContain('fsa-r-waiver');
  });

  it('a disqualified candidate is a warning when another dependent counts', () => {
    const data = eligibleT({ dd1561HasChildren: true, dd1561ChildCustody: 'other-person' });
    expect(codes(data)).toEqual([]);
    expect(warnCodes(data)).toContain('child-custody-other-not-counted');
  });

  it('member married to member who resided together is eligible with no other dependents (2.3.4.1, 3.1.5)', () => {
    const data = eligibleT({ dd1561DualMilitary: true, dd1561SpouseResidingTogether: 'was', dd1561DependentOnActiveDuty: true });
    const e = evaluateDd1561Eligibility(data);
    expect(e.blockers).toEqual([]);
    expect(e.basis.dualMilitaryCouple).toBe(true);
    expect(warnCodes(data)).toEqual(expect.arrayContaining(['dual-mil-payee', 'dependent-on-active-duty']));
  });

  it('a dual-military couple with children is assessed per member (2.3.4.2)', () => {
    const data = eligibleT({ dd1561DualMilitary: true, dd1561SpouseResidingTogether: 'was', dd1561HasChildren: true, dd1561ChildCustody: 'member', dd1561SpouseReceivingFsa: true });
    expect(codes(data)).toEqual([]);
    expect(warnCodes(data)).toContain('dual-mil-with-dependents');
  });

  it('dependents near the port is only a note for FSA-S (2.3.1.2 NOTE, 4.5.2)', () => {
    const data = eligibleT({ dd1561FsaType: 'S', dd1561AllDependentsNear: true, dd1561FsaSSegments: [away('2026-06-15', '2026-07-15')] });
    expect(codes(data)).toEqual([]);
    expect(warnCodes(data)).toContain('dependents-near-port');
  });

  it('notes the Reserve Component PDS / HOR rule for a mobilized member (2.3.1.3 NOTE)', () => {
    const w = evaluateDd1561Eligibility(eligibleT({ dd1561Mobilized: true })).warnings.find((x) => x.code === 'reserve-component-pds');
    expect(w?.citation).toContain('2.3.1.3 NOTE');
  });
});

describe('check boxes', () => {
  const TYPES = ['', 'T', 'R', 'S'] as const;
  const PAIRS = ['', 'was', 'was-not'] as const;

  it('at most one box per group, exactly one once answered', () => {
    for (const t of TYPES) for (const f of PAIRS) for (const g of PAIRS) for (const dual of [true, false]) {
      const b = dd1561CheckBoxes({ documentType: 'dd1561', dd1561FsaType: t, dd1561DualMilitary: dual, dd1561SpouseResidingTogether: f, dd1561LastTdyWithin30: g } as FormData);
      expect([b.typeFsaT, b.typeFsaR, b.typeFsaS].filter(Boolean).length).toBe(t ? 1 : 0);
      expect([b.cert8fSpouseWas, b.cert8fSpouseWasNot].filter(Boolean).length).toBe(dual && f ? 1 : 0);
      expect([b.cert8gLastTdyWas, b.cert8gLastTdyWasNot].filter(Boolean).length).toBe(g ? 1 : 0);
      expect(b.cert8g).toBe(Boolean(g));
      expect(b.cert8f).toBe(dual);
    }
  });

  it('X\'s 8a-8e only when the answers make the certification true', () => {
    const b = dd1561CheckBoxes(eligibleT({ dd1561HasChildren: true, dd1561ChildCustody: 'joint-14-plus', dd1561ClaimsParent: true, dd1561ParentDependencyApproved: true, dd1561ParentResidesWithMember: true }));
    expect(b).toMatchObject({ cert8a: true, cert8b: true, cert8c: true, cert8d: true, cert8e: true, cert8f: false });
    const none = dd1561CheckBoxes({ documentType: 'dd1561', dd1561MaritalStatus: 'legally-separated', dd1561HasChildren: true, dd1561ChildCustody: 'other-person' } as FormData);
    expect(none).toMatchObject({ cert8a: false, cert8b: false, cert8c: false, cert8d: false, cert8e: false });
  });
});

describe('field values', () => {
  const NAMES = new Set(DD1561_ALL_FIELD_NAMES);

  it('uses only names from the field map', () => {
    for (const k of Object.keys(dd1561FieldValues(eligibleT()))) expect(NAMES.has(k), k).toBe(true);
  });

  it('never sets the signatures, and leaves 15a-c and 16 out by default', () => {
    for (const data of [eligibleT(), { ...createDd1561Defaults() } as FormData]) {
      const v = dd1561FieldValues(data);
      for (const name of DD1561_NEVER_SET_FIELDS) expect(v).not.toHaveProperty(name);
      for (const name of [DD1561_FIELDS.certifierName, DD1561_FIELDS.certifierTitle, DD1561_FIELDS.certifierOrganization, DD1561_FIELDS.certifiedDate]) {
        expect(v).not.toHaveProperty(name);
      }
    }
  });

  it('prints the optional certifier fields when a clerk types them, never the signature', () => {
    const v = dd1561FieldValues(eligibleT({ dd1561CertifierName: 'OFFICER, A B', dd1561CertifierTitle: 'IPAC OIC', dd1561CertifierOrganization: 'IPAC', dd1561CertifiedDate: '2026-11-24' }));
    expect(v[DD1561_FIELDS.certifierName]).toBe('OFFICER, A B');
    expect(v[DD1561_FIELDS.certifiedDate]).toBe('241126');
    expect(v).not.toHaveProperty(DD1561_FIELDS.certifierSignature);
    expect(v).not.toHaveProperty(DD1561_FIELDS.memberSignature);
  });

  it('never emits an SSN, even one typed into an EDIPI field', () => {
    const v = dd1561FieldValues(eligibleT({ dd1561Edipi: '123-45-6789', dd1561DualMilitary: true, dd1561SpouseEdipi: '123456789', dd1561SpouseResidingTogether: 'was' }));
    expect(v[DD1561_FIELDS.dodId]).toBe('');
    expect(v[DD1561_FIELDS.spouseDodId]).toBe('');
    const text = Object.values(v).filter((x) => typeof x === 'string').join(' ');
    expect(text).not.toMatch(/\b\d{3}-?\d{2}-?\d{4}\b/);
  });

  it('prints the EDIPIs, block 10 and block 13 for an FSA-T claim', () => {
    const v = dd1561FieldValues(eligibleT({ dd1561DualMilitary: true, dd1561SpouseEdipi: '0987654321', dd1561SpouseBranchComponent: 'USN ACTIVE', dd1561SpouseResidingTogether: 'was' }));
    expect(v[DD1561_FIELDS.dodId]).toBe('1234567890');
    expect(v[DD1561_FIELDS.spouseDodId]).toBe('0987654321');
    expect(v[DD1561_FIELDS.typeFsaT]).toBe(true);
    expect(v[DD1561_FIELDS.typeFsaR]).toBe(false);
    expect(v[DD1561_FIELDS.cert8fSpouseWas]).toBe(true);
    expect(v[DD1561_FSA_T_ROWS[0].location]).toBe('SITE B');
    expect(v[DD1561_FSA_T_ROWS[0].inclusiveDates]).toBe('300526 - 300626');
    expect(v[DD1561_FSA_T_ROWS[0].days]).toBe('32');
    expect(v[DD1561_FSA_T_ROWS[1].location]).toBe('');
    expect(v[DD1561_FIELDS.ordersAuthority]).toBe('TAD ORDERS 123-26');
    expect(v[DD1561_FIELDS.ordersDated]).toBe('010526');
    expect(v[DD1561_FSA_R.departedDate]).toBe('');
    expect(v[DD1561_FIELDS.fsaSCommencingDate]).toBe('');
  });

  it('puts rows past three on the continuation list, not in the field map', () => {
    const rows = [1, 2, 3, 4, 5].map((n) => row(`SITE ${n}`, `2026-0${n}-01`, `2026-0${n}-10`));
    const data = eligibleT({ dd1561FsaTRows: rows, dd1561FsaTLeaveBeforeDays: 0 });
    const v = dd1561FieldValues(data);
    expect(v[DD1561_FSA_T_ROWS[2].location]).toBe('SITE 3');
    expect(dd1561FsaTContinuationRows(data).map((r) => r.location)).toEqual(['SITE 4', 'SITE 5']);
    expect(Object.values(v)).not.toContain('SITE 4');
  });

  it('prints block 11 for FSA-R and block 12 for FSA-S only', () => {
    const r = dd1561FieldValues(eligibleT({
      dd1561FsaType: 'R', dd1561FsaRLastPds: 'CAMP PENDLETON CA', dd1561FsaRDetachDate: '2026-06-01',
      dd1561FsaRLeaveFrom: '2026-06-01', dd1561FsaRLeaveTo: '2026-06-10', dd1561FsaRNewPds: 'CAMP HANSEN JA', dd1561FsaRReportDate: '2026-06-15',
    }));
    expect(r[DD1561_FSA_R.departedDate]).toBe('010626');
    expect(r[DD1561_FSA_R.leaveDates]).toBe('010626 - 100626');
    expect(r[DD1561_FSA_R.proceedDates]).toBe('');
    expect(r[DD1561_FSA_R.reportedDate]).toBe('150626');
    expect(r[DD1561_FSA_T_ROWS[0].location]).toBe('');
    const s = dd1561FieldValues(eligibleT({ dd1561FsaType: 'S', dd1561FsaSSegments: [away('2026-06-15', '2026-07-15')], dd1561FsaSShipUnit: 'USS EXAMPLE', dd1561FsaSHomeport: 'SAN DIEGO CA' }));
    expect(s[DD1561_FIELDS.fsaSCommencingDate]).toBe('150626');
    expect(s[DD1561_FIELDS.fsaSShipUnit]).toBe('USS EXAMPLE');
    expect(s[DD1561_FSA_R.departedDate]).toBe('');
  });

  it('prints block 6 only for a mobilized member', () => {
    expect(dd1561FieldValues(eligibleT({ dd1561MobilizedDepartureDate: '2026-05-01' }))[DD1561_FIELDS.mobilizedDepartureDate]).toBe('');
    expect(dd1561FieldValues(eligibleT({ dd1561Mobilized: true, dd1561MobilizedDepartureDate: '2026-05-01' }))[DD1561_FIELDS.mobilizedDepartureDate]).toBe('010526');
  });
});

describe('schema and defaults', () => {
  it('the defaults parse and answer no yes/no question', () => {
    const d = createDd1561Defaults();
    expect(Dd1561Schema.safeParse(d).success).toBe(true);
    expect(d.dd1561DualMilitary).toBeUndefined();
    expect(d.dd1561BahWithDependentsConfirmed).toBeUndefined();
    expect(d.dd1561CertifierName).toBe('');
  });

  it('rejects an unknown FSA type', () => {
    expect(Dd1561Schema.safeParse({ documentType: 'dd1561', dd1561FsaType: 'X' }).success).toBe(false);
  });

  it('has no SSN key', () => {
    expect(Object.keys(Dd1561Schema.shape).some((k) => /ssn/i.test(k))).toBe(false);
  });
});
