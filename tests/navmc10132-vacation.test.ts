// Vitest suite for decision row D-60: the vacation record model
// (src/types/navmc.ts, Navmc10132Vacation), its Zod schema (src/lib/schemas.ts),
// its item 21 derivation (vacationRemarks in src/lib/navmc10132-acroform.ts),
// and its export-gate validators V-32, V-33, W-20
// (src/lib/navmc10132-validators-punishment.ts).
//
// WHAT THIS FILE DOES NOT COVER. No UI component exists yet for this data
// (see the exclusion-list comment on Navmc10132Definition, schemas.ts) so
// there is nothing here about RemarksSection, ComplianceDialog, or any
// other component. This file only exercises the data model, the pure
// derivation, and the pure validators.

import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import { createEmptyNavmc10132Data } from '@/types/navmc';
import { Navmc10132Schema } from '@/lib/schemas';
import { navmc10132Values } from '@/lib/navmc10132-acroform';
import { isPrescribedFormat } from '@/lib/navmc10132-remarks';
import { getExportBlockers } from '@/lib/letter-validators';
import {
  punishmentIssues,
  vacationPartialDetailIssues,
  vacationSuspensionIndexBoundsIssues,
  vacationNoticeAfterRemissionIssues,
} from '@/lib/navmc10132-validators-punishment';

function baseForm(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    ...overrides,
  };
}

/** baseForm plus the one field Navmc10132Schema itself requires
 * (accusedName), for the two tests below that parse through the schema. */
function schemaValidForm(overrides: Record<string, unknown> = {}): FormData {
  return baseForm({ accusedName: 'RIVERA, DIEGO M', ...overrides });
}

// ---------------------------------------------------------------------------
// The data model itself.
// ---------------------------------------------------------------------------

describe('the vacations array', () => {
  it('defaults to an empty array from createEmptyNavmc10132Data', () => {
    expect(createEmptyNavmc10132Data().vacations).toEqual([]);
  });

  it('parses a full vacation record through the Zod schema', () => {
    const parsed = Navmc10132Schema.safeParse(
      schemaValidForm({
        vacations: [
          {
            suspensionIndex: 0,
            noticeServedDate: '2026-03-01',
            status: 'vacated-full',
            outcomeDate: '2026-03-10',
          },
        ],
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it('parses all four status values', () => {
    for (const status of ['pending', 'vacated-full', 'vacated-part', 'not-vacated'] as const) {
      const parsed = Navmc10132Schema.safeParse(
        schemaValidForm({ vacations: [{ suspensionIndex: 0, status }] }),
      );
      expect(parsed.success).toBe(true);
    }
  });

  it('rejects a status outside the four-state union', () => {
    const parsed = Navmc10132Schema.safeParse(
      schemaValidForm({ vacations: [{ suspensionIndex: 0, status: 'vacated' }] }),
    );
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// vacationRemarks, exercised through navmc10132Values('21 REMARKS'), the
// same seam tests/navmc10132-overflow.test.ts uses for the sibling overflow
// derivation.
// ---------------------------------------------------------------------------

const fullVacationForm = baseForm({
  punishmentDate: '2026-01-15',
  punishments: [{ code: 'N09', days: '14' }],
  suspensions: [{ punishmentIndex: 0, months: '6' }],
  vacations: [
    {
      suspensionIndex: 0,
      noticeServedDate: '2026-03-01',
      status: 'vacated-full',
      outcomeDate: '2026-03-10',
    },
  ],
});

describe('vacationRemarks derives the item 21 suspension-vacated-njp remark', () => {
  it('emits a remark dated on the outcome date, not the notice-served date', () => {
    const remarks = String(navmc10132Values(fullVacationForm)['21 REMARKS'] ?? '');
    expect(remarks).toContain('2026-03-10 ITEM 7:');
    expect(remarks).not.toContain('2026-03-01 ITEM 7:');
  });

  it('names the item 6 punishment and the NJP date in a "susp on" clause', () => {
    const remarks = String(navmc10132Values(fullVacationForm)['21 REMARKS'] ?? '');
    expect(remarks).toContain('susp on 2026-01-15');
    expect(remarks).toContain('vacated.');
  });

  it('the derived line satisfies the app\'s own isPrescribedFormat check', () => {
    const remarks = String(navmc10132Values(fullVacationForm)['21 REMARKS'] ?? '');
    const line = remarks.split('\n').find((l) => l.includes('ITEM 7:')) ?? '';
    expect(line).not.toBe('');
    expect(isPrescribedFormat(line)).toBe(true);
  });

  it('a partial vacation names what was vacated, and still satisfies isPrescribedFormat', () => {
    const partial = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [
        {
          suspensionIndex: 0,
          noticeServedDate: '2026-03-01',
          status: 'vacated-part',
          outcomeDate: '2026-03-10',
          vacatedDetail: '7 days extra duty',
        },
      ],
    });
    const remarks = String(navmc10132Values(partial)['21 REMARKS'] ?? '');
    expect(remarks).toContain('in part: 7 days extra duty');
    const line = remarks.split('\n').find((l) => l.includes('ITEM 7:')) ?? '';
    expect(isPrescribedFormat(line)).toBe(true);
  });

  it('emits nothing for a pending vacation: nothing has been vacated yet', () => {
    const pending = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [{ suspensionIndex: 0, noticeServedDate: '2026-03-01', status: 'pending' }],
    });
    const remarks = String(navmc10132Values(pending)['21 REMARKS'] ?? '');
    expect(remarks).not.toContain('ITEM 7:');
  });

  it('emits nothing for a not-vacated outcome: the commander decided not to vacate', () => {
    const notVacated = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [
        {
          suspensionIndex: 0,
          noticeServedDate: '2026-03-01',
          status: 'not-vacated',
          outcomeDate: '2026-03-10',
        },
      ],
    });
    const remarks = String(navmc10132Values(notVacated)['21 REMARKS'] ?? '');
    expect(remarks).not.toContain('ITEM 7:');
  });

  it('skips an executed vacation with no recorded outcome date, rather than emit a malformed line', () => {
    const noOutcomeDate = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [
        { suspensionIndex: 0, noticeServedDate: '2026-03-01', status: 'vacated-full', outcomeDate: '' },
      ],
    });
    const remarks = String(navmc10132Values(noOutcomeDate)['21 REMARKS'] ?? '');
    expect(remarks).not.toContain('ITEM 7:');
  });

  it('skips when item 6 carries no NJP date at all, since the "susp on" clause has nothing to name', () => {
    const noNjpDate = baseForm({
      punishmentDate: '',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [
        {
          suspensionIndex: 0,
          noticeServedDate: '2026-03-01',
          status: 'vacated-full',
          outcomeDate: '2026-03-10',
        },
      ],
    });
    const remarks = String(navmc10132Values(noNjpDate)['21 REMARKS'] ?? '');
    expect(remarks).not.toContain('ITEM 7:');
  });

  it('merges with the clerk\'s own remarks and the item 6/7 overflow carriers, sorted chronologically', () => {
    const mixed = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [
        {
          suspensionIndex: 0,
          noticeServedDate: '2026-03-01',
          status: 'vacated-full',
          outcomeDate: '2026-03-10',
        },
      ],
      remarks: [{ date: '2026-01-20', kind: 'forwarded', detail: 'trial by special court-martial' }],
    });
    const remarks = String(navmc10132Values(mixed)['21 REMARKS'] ?? '');
    const lines = remarks.split('\n');
    const forwardedIdx = lines.findIndex((l) => l.startsWith('2026-01-20'));
    const vacatedIdx = lines.findIndex((l) => l.startsWith('2026-03-10'));
    expect(forwardedIdx).toBeGreaterThanOrEqual(0);
    expect(vacatedIdx).toBeGreaterThan(forwardedIdx);
  });
});

// ---------------------------------------------------------------------------
// V-32 (blocker): a partial vacation with no vacatedDetail.
// ---------------------------------------------------------------------------

describe('V-32: a partial vacation must say what was vacated', () => {
  it('blocks a vacated-part record with an empty vacatedDetail', () => {
    const form = baseForm({
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [{ suspensionIndex: 0, status: 'vacated-part', vacatedDetail: '' }],
    });
    const issues = vacationPartialDetailIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('block');
    expect(issues[0].id).toBe('navmc10132-v32-vacation-partial-no-detail-0');
  });

  it('is silent once vacatedDetail is entered', () => {
    const form = baseForm({
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [{ suspensionIndex: 0, status: 'vacated-part', vacatedDetail: 'restriction only' }],
    });
    expect(vacationPartialDetailIssues(form)).toEqual([]);
  });

  it('is silent on a full vacation and on records with no vacation at all', () => {
    const full = baseForm({
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [{ suspensionIndex: 0, status: 'vacated-full' }],
    });
    expect(vacationPartialDetailIssues(full)).toEqual([]);
    expect(vacationPartialDetailIssues(baseForm())).toEqual([]);
  });

  it('keys the id on the vacation record\'s own array position, not on suspensionIndex', () => {
    const form = baseForm({
      punishments: [{ code: 'N09', days: '14' }, { code: 'N16', oralOrWritten: 'orally' }],
      suspensions: [
        { punishmentIndex: 0, months: '6' },
        { punishmentIndex: 1, months: '3' },
      ],
      vacations: [
        { suspensionIndex: 0, status: 'vacated-full' },
        { suspensionIndex: 1, status: 'vacated-part', vacatedDetail: '' },
      ],
    });
    const issues = vacationPartialDetailIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v32-vacation-partial-no-detail-1');
  });
});

// ---------------------------------------------------------------------------
// V-33 (blocker): a vacation targeting a suspension item 7 does not carry.
// ---------------------------------------------------------------------------

describe('V-33: a vacation must name a suspensionIndex item 7 actually carries', () => {
  it('blocks an out-of-bounds suspensionIndex', () => {
    const form = baseForm({
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [{ suspensionIndex: 5, status: 'vacated-full' }],
    });
    const issues = vacationSuspensionIndexBoundsIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('block');
    expect(issues[0].id).toBe('navmc10132-v33-vacation-suspension-index-0');
  });

  it('is silent when suspensionIndex is in bounds', () => {
    const form = baseForm({
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [{ suspensionIndex: 0, status: 'vacated-full' }],
    });
    expect(vacationSuspensionIndexBoundsIssues(form)).toEqual([]);
  });

  it('blocks the full validator run via getExportBlockers, not merely the leaf function', () => {
    const form = baseForm({
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [{ suspensionIndex: 5, status: 'vacated-full' }],
    });
    expect(
      getExportBlockers(form, [], [], []).some((i) => i.id.startsWith('navmc10132-v33-')),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// W-20 (advisory): a Figure 14-1 notice served after the computed remission
// date. Must warn, never block, per D-51's conditional-date reasoning.
// ---------------------------------------------------------------------------

describe('W-20: a notice served after the computed suspension end date is advisory only', () => {
  it('warns when noticeServedDate is after endsOnIfUninterrupted', () => {
    // NJP 2026-01-15, suspended 1 month -> ends 2026-02-15. Notice served
    // well after that.
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '1' }],
      vacations: [{ suspensionIndex: 0, noticeServedDate: '2026-03-01', status: 'pending' }],
    });
    const issues = vacationNoticeAfterRemissionIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warn');
    expect(issues[0].id).toBe('navmc10132-w20-vacation-notice-after-remission-0');
  });

  it('is silent when the notice is served on or before the computed end date', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [{ suspensionIndex: 0, noticeServedDate: '2026-02-01', status: 'pending' }],
    });
    expect(vacationNoticeAfterRemissionIssues(form)).toEqual([]);
  });

  // THE PART THAT MATTERS: 'warn' must never gate the export. A blocking
  // assertion here would be wrong given D-51 - the computed date is a
  // conditional floor, not a certainty the app can refuse a lawful notice
  // over.
  it('never appears in getExportBlockers, even when it fires', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '1' }],
      vacations: [{ suspensionIndex: 0, noticeServedDate: '2026-03-01', status: 'pending' }],
    });
    // Confirm the rule really did fire, so a silent regression elsewhere
    // cannot make this assertion vacuous.
    expect(punishmentIssues(form).some((i) => i.id.startsWith('navmc10132-w20-'))).toBe(true);
    expect(
      getExportBlockers(form, [], [], []).some((i) => i.id.startsWith('navmc10132-w20-')),
    ).toBe(false);
  });

  it('is folded into the punishmentIssues aggregate', () => {
    const form = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '1' }],
      vacations: [{ suspensionIndex: 0, noticeServedDate: '2026-03-01', status: 'pending' }],
    });
    expect(punishmentIssues(form).some((i) => i.id.startsWith('navmc10132-w20-'))).toBe(true);
  });
});
