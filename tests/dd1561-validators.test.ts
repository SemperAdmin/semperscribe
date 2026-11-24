import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { createDd1561Defaults } from '@/types/dd1561';
import { runDd1561Validators } from '@/lib/dd1561-validators';
import { getExportBlockers, runLetterValidators } from '@/lib/letter-validators';

const CORE = {
  dd1561MemberName: 'MARINE, TEST A',
  dd1561Grade: 'SGT',
  dd1561Edipi: '1234567890',
  dd1561BranchOrganization: 'USMC, 1ST BN 5TH MAR',
  dd1561DependentAddresses: '123 MAIN ST, OCEANSIDE CA 92054',
  dd1561MaritalStatus: 'married',
  dd1561DependentOnActiveDuty: false,
  dd1561SoleDependentInstitutionalized: false,
  dd1561OrdersAuthority: 'ORDERS 123-26',
  dd1561OrdersDate: '2026-05-01',
  dd1561BahWithDependentsConfirmed: true,
  dd1561MemberSignedDate: '2026-05-20',
};
const T = { dd1561FsaType: 'T', dd1561LastTdyWithin30: 'was-not', dd1561FsaTRows: [{ location: 'SITE B', from: '2026-05-30', to: '2026-06-30' }] };
const R = {
  dd1561FsaType: 'R', dd1561FsaRTransportAuthorized: false, dd1561FsaRLastPds: 'CAMP PENDLETON CA', dd1561FsaRDetachDate: '2026-06-01',
  dd1561FsaRLeaveFrom: '2026-06-01', dd1561FsaRLeaveTo: '2026-06-10', dd1561FsaRProceedFrom: '2026-06-11', dd1561FsaRProceedTo: '2026-06-14',
  dd1561FsaRNewPds: 'CAMP HANSEN JA', dd1561FsaRReportDate: '2026-06-15',
};
const S = {
  dd1561FsaType: 'S', dd1561LastTdyWithin30: 'was-not', dd1561FsaSShipUnit: 'USS EXAMPLE', dd1561FsaSHomeport: 'SAN DIEGO CA',
  dd1561FsaSSegments: [{ status: 'away', from: '2026-06-15', to: '2026-07-15' }],
};
const form = (type: Record<string, unknown>, o: Record<string, unknown> = {}) =>
  ({ ...createDd1561Defaults(), ...CORE, ...type, ...o }) as unknown as FormData;
const issues = (data: FormData) => runDd1561Validators(data);
const ids = (data: FormData) => issues(data).map((i) => i.id);
const blocks = (data: FormData) => issues(data).filter((i) => i.severity === 'block').map((i) => i.id);
const sev = (data: FormData, id: string) => issues(data).find((i) => i.id === id)?.severity;

describe('dd1561 validators', () => {
  it('is a no-op for other document types', () => {
    expect(runDd1561Validators({ documentType: 'navmc11106' } as FormData)).toEqual([]);
  });

  it.each([['T', T], ['R', R], ['S', S]])('has no blocker on a complete FSA-%s statement', (_, type) => {
    expect(blocks(form(type))).toEqual([]);
  });

  it('blocks a blank form on the required fields, the type and block 14', () => {
    const b = blocks({ ...createDd1561Defaults() } as unknown as FormData);
    expect(b).toEqual(expect.arrayContaining(['dd1561-core-fields', 'dd1561-type-missing', 'dd1561-bah-unconfirmed', 'dd1561-no-dependents']));
  });

  it.each([
    ['dd1561MemberName', ''], ['dd1561Grade', ''], ['dd1561Edipi', ''], ['dd1561BranchOrganization', ''], ['dd1561DependentAddresses', ''],
  ])('blocks when %s is empty', (key, value) => {
    expect(sev(form(T, { [key]: value }), 'dd1561-core-fields')).toBe('block');
  });

  it.each(['123', '123-45-6789', '123456789', '12345678901', 'ABCDEFGHIJ'])('blocks EDIPI %s', (v) => {
    expect(sev(form(T, { dd1561Edipi: v }), 'dd1561-edipi-format')).toBe('block');
  });

  it('requires the spouse EDIPI, branch and was / was not only when 8f applies', () => {
    expect(ids(form(T))).not.toContain('dd1561-spouse-fields');
    const dual = form(T, { dd1561DualMilitary: true, dd1561SpouseResidingTogether: 'was', dd1561SpouseBranchComponent: 'USN ACTIVE' });
    expect(sev({ ...dual, dd1561SpouseEdipi: '123-45-6789' } as FormData, 'dd1561-spouse-fields')).toBe('block');
    expect(ids({ ...dual, dd1561SpouseEdipi: '0987654321' } as FormData)).not.toContain('dd1561-spouse-fields');
  });

  it('requires block 6 for a mobilized member', () => {
    expect(sev(form(T, { dd1561Mobilized: true }), 'dd1561-mobilized-date-missing')).toBe('block');
    expect(ids(form(T, { dd1561Mobilized: true, dd1561MobilizedDepartureDate: '2026-05-01' }))).not.toContain('dd1561-mobilized-date-missing');
  });

  it('blocks an impossible date', () => {
    expect(sev(form(T, { dd1561OrdersDate: '2026-02-30' }), 'dd1561-date-invalid')).toBe('block');
  });

  describe('FSA-T', () => {
    it('blocks 30 days or fewer', () => {
      const d = form(T, { dd1561FsaTRows: [{ location: 'B', from: '2026-06-01', to: '2026-06-30' }] });
      expect(sev(d, 'dd1561-not-more-than-30')).toBe('block');
    });

    it('blocks a row that ends before it starts, an incomplete row and rows out of order', () => {
      expect(blocks(form(T, { dd1561FsaTRows: [{ location: 'B', from: '2026-07-01', to: '2026-06-01' }] }))).toContain('dd1561-fsa-t-row-order');
      expect(blocks(form(T, { dd1561FsaTRows: [{ location: '', from: '2026-05-01', to: '2026-06-30' }] }))).toContain('dd1561-fsa-t-row-incomplete');
      expect(blocks(form(T, { dd1561FsaTRows: [
        { location: 'B', from: '2026-06-01', to: '2026-07-15' }, { location: 'A', from: '2026-05-01', to: '2026-05-20' },
      ] }))).toContain('dd1561-fsa-t-rows-out-of-order');
    });

    it('allows more than three rows', () => {
      const rows = [1, 2, 3, 4].map((n) => ({ location: `S${n}`, from: `2026-0${n}-01`, to: `2026-0${n + 1}-01` }));
      expect(blocks(form(T, { dd1561FsaTRows: rows }))).toEqual([]);
    });

    it('blocks leave that consumes the whole TDY', () => {
      expect(blocks(form(T, { dd1561FsaTRows: [{ location: 'B', from: '2026-06-01', to: '2026-06-10' }], dd1561FsaTLeaveBeforeDays: 20 })))
        .toContain('dd1561-fsa-t-constructive-order');
    });

    it('requires 8g and, when "was", the prior period', () => {
      expect(sev(form(T, { dd1561LastTdyWithin30: '' }), 'dd1561-8g-unanswered')).toBe('block');
      expect(sev(form(T, { dd1561LastTdyWithin30: 'was' }), 'dd1561-prior-period-missing')).toBe('block');
    });
  });

  describe('FSA-R', () => {
    it.each([
      ['leave before detachment', { dd1561FsaRLeaveFrom: '2026-05-30' }],
      ['leave after report', { dd1561FsaRLeaveTo: '2026-06-20' }],
      ['report before detachment', { dd1561FsaRReportDate: '2026-05-01' }],
      ['proceed ends before it starts', { dd1561FsaRProceedFrom: '2026-06-14', dd1561FsaRProceedTo: '2026-06-11' }],
    ])('blocks %s', (_, o) => {
      expect(sev(form(R, o), 'dd1561-fsa-r-date-order')).toBe('block');
    });

    it('blocks a missing PDS and a half-entered leave range', () => {
      expect(sev(form(R, { dd1561FsaRNewPds: '' }), 'dd1561-fsa-r-fields')).toBe('block');
      expect(sev(form(R, { dd1561FsaRLeaveTo: '' }), 'dd1561-fsa-r-fields')).toBe('block');
    });

    it('does not ask 8g of FSA-R', () => {
      expect(ids(form(R))).not.toContain('dd1561-8g-unanswered');
    });
  });

  describe('FSA-S', () => {
    it('blocks the 30-day non-qualifying February case (FMR 4.4.3 Ex. 3)', () => {
      expect(sev(form(S, { dd1561FsaSSegments: [{ status: 'away', from: '2026-02-25', to: '2026-03-26' }] }), 'dd1561-not-more-than-30')).toBe('block');
    });

    it('blocks a missing ship, homeport or commencing date', () => {
      expect(sev(form(S, { dd1561FsaSHomeport: '' }), 'dd1561-fsa-s-fields')).toBe('block');
      expect(sev(form(S, { dd1561FsaSSegments: [] }), 'dd1561-fsa-s-fields')).toBe('block');
    });

    it('blocks a segment that ends before it starts', () => {
      expect(sev(form(S, { dd1561FsaSSegments: [{ status: 'away', from: '2026-07-15', to: '2026-06-15' }] }), 'dd1561-fsa-s-date-order')).toBe('block');
    });
  });

  it('blocks block 16 before block 9a, and never requires the certifier', () => {
    expect(sev(form(T, { dd1561CertifiedDate: '2026-05-19' }), 'dd1561-certified-before-member')).toBe('block');
    expect(ids(form(T, { dd1561CertifiedDate: '2026-05-20' }))).not.toContain('dd1561-certified-before-member');
    const noCert = form(T, { dd1561CertifierName: '', dd1561CertifierTitle: '', dd1561CertifierOrganization: '', dd1561CertifiedDate: '' });
    expect(blocks(noCert)).toEqual([]);
  });

  it('blocks block 14 unconfirmed', () => {
    expect(sev(form(T, { dd1561BahWithDependentsConfirmed: false }), 'dd1561-bah-unconfirmed')).toBe('block');
  });

  it('blocks block 13 missing', () => {
    expect(sev(form(T, { dd1561OrdersAuthority: '' }), 'dd1561-orders-missing')).toBe('block');
  });

  it('turns every eligibility blocker into a block and every note into a warning', () => {
    expect(sev(form(T, { dd1561PermissiveOrders: true }), 'dd1561-permissive-orders')).toBe('block');
    expect(sev(form(T, { dd1561Mobilized: true, dd1561MobilizedDepartureDate: '2026-05-01' }), 'dd1561-reserve-component-pds')).toBe('warn');
    const i = issues(form(T, { dd1561PermissiveOrders: true })).find((x) => x.id === 'dd1561-permissive-orders');
    expect(i?.citation).toContain('4.1.1.3');
  });

  it('feeds the export gate through runLetterValidators', () => {
    const bad = form(T, { dd1561Edipi: '123-45-6789' });
    expect(runLetterValidators(bad, [], [], []).map((x) => x.id)).toContain('dd1561-edipi-format');
    expect(getExportBlockers(bad, [], [], []).map((x) => x.id)).toContain('dd1561-edipi-format');
    expect(getExportBlockers(form(T), [], [], []).filter((x) => x.id.startsWith('dd1561-'))).toEqual([]);
  });
});

describe('dd1561 registration in the shared helpers', () => {
  it('names the export after the member', async () => {
    const { getExportFilename } = await import('@/lib/naval-format-utils');
    expect(getExportFilename(form(T), 'pdf')).toBe('DD 1561 - MARINE TEST A.pdf');
    expect(getExportFilename({ documentType: 'dd1561' } as FormData, 'pdf')).toBe('DD 1561 - Member.pdf');
  });

  it('is a form, not correspondence, for the indent engine', async () => {
    const { isCorrespondenceType } = await import('@/lib/indent-engine');
    expect(isCorrespondenceType('dd1561')).toBe(false);
  });

  it('offers crash recovery for a started form only', async () => {
    const { isRecoverable } = await import('@/lib/autosave');
    const copy = (fd: Record<string, unknown>) => ({ formData: { documentType: 'dd1561', ...fd }, paragraphs: [] }) as never;
    expect(isRecoverable(copy({ dd1561MemberName: 'MARINE, TEST' }))).toBe(true);
    expect(isRecoverable(copy({ dd1561FsaType: 'T' }))).toBe(true);
    expect(isRecoverable(copy({ ...createDd1561Defaults() }))).toBe(false);
  });

  it('skips the letter proofread checks and surfaces the DD 1561 issues', async () => {
    const { runProofreadChecks } = await import('@/lib/proofread-checks');
    const checks = runProofreadChecks(form(T, { dd1561Edipi: '123' }), [], [], []);
    expect(checks.map((c) => c.id)).toContain('dd1561-edipi-format');
    expect(checks.some((c) => c.status === 'fail' && c.category !== 'framework')).toBe(false);
  });
});
