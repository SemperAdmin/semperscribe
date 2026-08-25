// Export-gate tests for the NAVMC 10132 (Unit Punishment Book) blockers.
//
// WHY THIS FILE EXISTS. getExportBlockers, in src/lib/letter-validators.ts,
// is the only thing that actually stops an export: it filters the full
// validator run down to `severity === 'block'`. Nothing else does. A rule
// emitted with severity 'fail' renders as "Non-compliant" in the compliance
// dialog and lets the export through anyway; 'warn' renders as "Advisory".
//
// V-18 through V-22 shipped with 'fail' while every one of their unit tests
// asserted `expect(issue.severity).toBe('fail')` and their own docstrings
// said BLOCKING. The tests were green. The docs were confident. Five rules
// blocked nothing, caught only by eyeballing the compliance dialog's badge
// text against the "Blocks export" label. See the standing warning at the
// top of navmc10132-validators-punishment.ts.
//
// Eleven more blockers (V-02, V-03, V-04, V-05, V-06, V-07, V-08, V-13,
// V-14, V-15, V-17) were asserted only by reading `issue.severity` off the
// leaf function's own return value, which proves the rule EMITS 'block' but
// not that getExportBlockers ACTUALLY STOPS the export for it — a filter
// bug, an id typo breaking the anchor, or a caller that forgot to fold the
// leaf function into the aggregate would all pass a severity-only test
// while quietly letting the export through. Every test below instead calls
// getExportBlockers itself and checks for the rule's id PREFIX in its
// output, matching the house pattern already established for V-18 through
// V-22 (tests/navmc10132-validators.test.ts, tests/navmc10132-basic-pay.test.ts,
// tests/navmc10132-combination-limits.test.ts and
// tests/njp-suspension-period.test.ts).
//
// getExportBlockers runs the FULL validator suite (offenses, dates,
// punishment, identity, plus every other document type's rules, all of
// which no-op for a non-matching documentType). A fixture built to trip one
// rule can and often does trip others too, so every assertion here checks
// for the presence of the rule's own id prefix via `.some((i) =>
// i.id.startsWith(...))`, NEVER the length or emptiness of the result
// array. `toHaveLength(1)` or `toEqual([])` against a getExportBlockers()
// result would be wrong in this file specifically, even though it is
// exactly right in the leaf-function unit tests this file is layered on
// top of. The `.id.startsWith(` form is also written inline at every call
// site rather than through a wrapper helper, on purpose: the meta test at
// the bottom of this file scans tests/*.test.ts for exactly that literal
// shape to confirm a rule is gated, and a helper function would hide the
// literal from its own scan.
//
// FIXTURE HELPERS. baseForm/offenseRow/offensesWith are restated here
// rather than imported from tests/navmc10132-validators.test.ts: that file
// does not export them (they are module-local functions), and this file
// must not modify any existing test file to change that. The shapes below
// are copied verbatim from that file's own helpers so a reader switching
// between the two files sees the same fixtures behave the same way.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import type { FormData } from '@/types';
import { createEmptyNavmc10132Data, type Navmc10132Offense } from '@/types/navmc';
import { getExportBlockers } from '@/lib/letter-validators';
import {
  NAVMC10132_VALIDATOR_MODULES,
  extractBlockSeverityRuleIds,
  countBlockSeverityArguments,
} from './navmc10132-blocker-scan';

// ---------------------------------------------------------------------------
// Fixture helpers (restated from tests/navmc10132-validators.test.ts; see
// note above)
// ---------------------------------------------------------------------------

/** A navmc10132 FormData built from the module's own empty-data factory. */
function baseForm(overrides: Record<string, unknown> = {}): FormData {
  return {
    documentType: 'navmc10132',
    ...createEmptyNavmc10132Data(),
    ...overrides,
  };
}

function offenseRow(overrides: Partial<Navmc10132Offense> = {}): Navmc10132Offense {
  return { articleLabel: '', summary: '', finding: '', ...overrides };
}

/** Five offense rows, A through E. Pass rows for the ones you care about, in order. */
function offensesWith(...rows: Partial<Navmc10132Offense>[]): Navmc10132Offense[] {
  const built = Array.from({ length: 5 }, () => offenseRow());
  rows.forEach((r, i) => {
    built[i] = offenseRow(r);
  });
  return built;
}

// ---------------------------------------------------------------------------
// V-01 - item 1: at least one offense row must carry an article.
//
// Added after the coordinator's review found this id allowlisted in the
// meta test below with no getExportBlockers proof anywhere in the suite —
// the same unproven-blocker shape this whole file exists to close, just
// outside the eleven rules originally named. Closing it here rather than
// leaving it allowlisted.
// ---------------------------------------------------------------------------

describe('V-01 stops the export: no offense row carries an article', () => {
  it('blocks when every offense row is empty, clears when one row has an article', () => {
    // The official form's own item 1 /V (validate) script tests row A only
    // — the identical script is copy-pasted onto rows B-E without the row
    // letter ever updated (defect 3.5), so it can never fire for those
    // rows. The app must enforce "at least one article selected" itself.
    const blocking = baseForm({ offenses: offensesWith() });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-offense-article-present'))).toBe(
      true,
    );

    // Only row A's `articleLabel` changes, from unset to selected.
    const compliant = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave' }),
    });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-offense-article-present')),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-02 - item 1: a row with an article must also have a summary.
// ---------------------------------------------------------------------------

describe('V-02 stops the export: an article without a summary', () => {
  it('blocks when row A has an article but no summary', () => {
    // Article present, summary blank. Item 1's own instruction requires
    // both, and the app must enforce it itself because the official form's
    // /V script on rows B-E is copy-pasted from row A with the row letter
    // never updated (defect 3.5), so it can never fire for those rows.
    const blocking = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave', summary: '' }),
    });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-offense-summary-present-')),
    ).toBe(true);

    // Same row, summary filled in. Only `summary` changes.
    const compliant = baseForm({
      offenses: offensesWith({
        articleLabel: 'Art. 86  Absence without leave',
        summary: 'Failed to report for the 0600 formation.',
      }),
    });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-offense-summary-present-')),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-03 - item 5: a finding requires an article on the same row.
// ---------------------------------------------------------------------------

describe('V-03 stops the export: a finding with no article on that row', () => {
  it('blocks when row A has a finding but no article', () => {
    // The item 5 instruction says to leave the finding blank where there is
    // no corresponding offense. A finding on an empty row is exactly the
    // shape a copy-paste or a row-deletion bug produces.
    const blocking = baseForm({
      offenses: offensesWith({ articleLabel: '', finding: 'Guilty' }),
    });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) =>
        i.id.startsWith('navmc10132-offense-finding-requires-article-'),
      ),
    ).toBe(true);

    // Same row, article filled in under the existing finding. Only
    // `articleLabel` changes.
    const compliant = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave', finding: 'Guilty' }),
    });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) =>
        i.id.startsWith('navmc10132-offense-finding-requires-article-'),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-04 - item 6: punishment must be non-empty (structured punishments[]).
// ---------------------------------------------------------------------------

describe('V-04 stops the export: item 6 punishment is empty', () => {
  it('blocks when punishments[] is empty', () => {
    // Checked against the structured `punishments` array, not the derived
    // `punishmentImposed` string, precisely so a stale derived field cannot
    // hide an accused with no punishment entries at all. No entries means
    // there is no NJP to memorialize; per MCO 5800.16 Vol 14 para 011110.C
    // the form should be destroyed, not exported.
    //
    // stage: 3 — item 6 is a pass-3 field (D-43, D-46, spec section 13.1)
    // and this rule is stage-scoped: it stays silent before pass 3, which
    // is exactly the fix for the bug this file's own header now
    // documents (a brand new, pass-1 document was blocked on an empty
    // item 6 that pass 1 does not even show). See the "stage-scoped"
    // describe block below for the pass-1-stays-silent proof.
    const blocking = baseForm({ punishments: [], stage: 3 });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v04-punishment-empty'))).toBe(
      true,
    );

    // One punishment entry added. Only `punishments` changes.
    const compliant = baseForm({ punishments: [{ code: 'N09', days: '14' }], stage: 3 });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v04-punishment-empty')),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-05 - item 7 suspension. Three sub-ids share the v05- family: -empty and
// -index-N are 'block' (checked here); -short is deliberately 'warn' (see
// note in the empty-case test below, and NOT covered here because it does
// not gate anything to prove).
// ---------------------------------------------------------------------------

describe('V-05 stops the export: item 7 suspension text is empty', () => {
  it('blocks on an empty item 7, clears on the literal word NONE', () => {
    // Item 7 must be either the literal word NONE, or a suspension stating
    // the punishment, its length, and the remission terms. An empty item 7
    // is unambiguous and refused outright with severity 'block'.
    //
    // NOTE ON SCOPE: suspensionTermsIssues also emits a short-entry id,
    // navmc10132-v05-suspension-short, but that one is severity 'warn' by
    // deliberate design (see its JSDoc: the app has no structured model to
    // tell "terse but complete" from "incomplete" free text, so a false
    // block on a legitimate short entry would be worse than a missed
    // catch). A 'warn' issue never reaches getExportBlockers regardless of
    // fixture, so there is no way to "prove" it stops an export — it does
    // not, by design. Writing a blocking/compliant pair for the short case
    // here would either be vacuous or, worse, silently pass by accident
    // once some future refactor promotes it to 'block' without anyone
    // noticing the assertion never moved. Left out on purpose; flagged in
    // the delivery report rather than faked.
    //
    // stage: 3 — item 7 is a pass-3 field (D-43, D-46, spec section 13.1),
    // the same pass as item 6, and the empty-item-7 branch is stage-scoped:
    // it stays silent before pass 3. See the "stage-scoped" describe block
    // below for the pass-1-stays-silent proof.
    const blocking = baseForm({ suspension: '', stage: 3 });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v05-'))).toBe(true);

    // Only `suspension` changes, to the literal word the instruction asks for.
    const compliant = baseForm({ suspension: 'NONE', stage: 3 });
    expect(getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v05-'))).toBe(false);
  });

  it('blocks when a structured suspension names a punishmentIndex item 6 does not carry', () => {
    // This is the V-05 addendum (suspensionIndexBoundsIssues), not weakened
    // like the free-text checks above: it is the exact defect a reporting
    // user hit, "cant suspend somthing that is not imposed" in their own
    // words, so it is checked against the structured arrays and blocks
    // outright rather than warning. `suspension` (the free-text field) is
    // held constant and non-empty across both fixtures so the -empty
    // sub-rule above cannot contribute a v05- id to either side and
    // contaminate this assertion.
    const blocking = baseForm({
      suspension: 'Extra du suspended for 6 mo, remitted if not sooner vacated.',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 5, months: '6' }], // 5 is out of bounds; only index 0 exists
    });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v05-'))).toBe(true);

    // Only `punishmentIndex` changes, from a dangling 5 to the valid 0.
    const compliant = baseForm({
      suspension: 'Extra du suspended for 6 mo, remitted if not sooner vacated.',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
    });
    expect(getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v05-'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-31 - only one item 7 suspension may target a given item 6 punishmentIndex.
// Not a section-6 spec row: see the JSDoc on suspensionDuplicateTargetIssues
// in navmc10132-validators-punishment.ts for why the citation names a
// command determination (Stephen, 2026-08-25) rather than a regulation.
// ---------------------------------------------------------------------------

describe('V-31 stops the export: two suspensions name the same item 6 punishmentIndex', () => {
  it('blocks when two suspensions share a punishmentIndex, clears when they target different ones', () => {
    const blocking = baseForm({
      punishments: [{ code: 'N09', days: '14' }, { code: 'N16', oralOrWritten: 'orally' }],
      suspensions: [
        { punishmentIndex: 0, months: '6' },
        { punishmentIndex: 0, months: '3' },
      ],
    });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v31-'))).toBe(true);

    // Only the second suspension's punishmentIndex changes, from the
    // duplicate 0 to the distinct 1.
    const compliant = baseForm({
      punishments: [{ code: 'N09', days: '14' }, { code: 'N16', oralOrWritten: 'orally' }],
      suspensions: [
        { punishmentIndex: 0, months: '6' },
        { punishmentIndex: 1, months: '3' },
      ],
    });
    expect(getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v31-'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-32 - decision row D-60. A vacation record marked vacated in part must
// say what part. See vacationPartialDetailIssues's own JSDoc in
// navmc10132-validators-punishment.ts for why this is a blocker with no
// regulatory citation, mirroring V-31.
// ---------------------------------------------------------------------------

describe('V-32 stops the export: a partial vacation names no vacated detail', () => {
  it('blocks when a vacated-part record carries no vacatedDetail, clears once one is entered', () => {
    const blocking = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [
        {
          suspensionIndex: 0,
          noticeServedDate: '2026-03-01',
          status: 'vacated-part',
          outcomeDate: '2026-03-10',
          vacatedDetail: '',
        },
      ],
    });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v32-')),
    ).toBe(true);

    // Only `vacatedDetail` changes, from empty to naming what was vacated.
    const compliant = baseForm({
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
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v32-')),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-33 - decision row D-60. A vacation record must name a suspensionIndex
// item 7 actually carries. Mirrors the V-05 addendum one level up.
// ---------------------------------------------------------------------------

describe('V-33 stops the export: a vacation names a suspensionIndex item 7 does not carry', () => {
  it('blocks when suspensionIndex is out of bounds, clears when it points at a real suspension', () => {
    const blocking = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [
        {
          suspensionIndex: 5, // out of bounds; only index 0 exists
          noticeServedDate: '2026-03-01',
          status: 'vacated-full',
          outcomeDate: '2026-03-10',
        },
      ],
    });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v33-')),
    ).toBe(true);

    // Only `suspensionIndex` changes, from the dangling 5 to the valid 0.
    const compliant = baseForm({
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
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v33-')),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-34 - decision row D-60, found while closing W-18 (D-54). A vacation
// record's status says a vacation happened (`vacated-full` or
// `vacated-part`) but vacationRemarks (navmc10132-acroform.ts) produced no
// item 21 remark for it. See vacationRemarkMissingIssues's own JSDoc in
// navmc10132-validators-punishment.ts for why this is ONE outcome-based
// rule rather than one rule per silent-skip branch in the derivation, and
// for why it blocks, unlike its W-18/W-20 neighbors.
//
// The fixture below reaches the gap through the outcomeDate branch
// specifically (one of several the derivation can hit), only because a
// concrete fixture has to pick one; the rule itself does not know or care
// which branch fired, which is the point.
// ---------------------------------------------------------------------------

describe('V-34 stops the export: an executed vacation with no item 21 remark for it', () => {
  it('blocks when an executed vacation has no outcome date, clears once one is entered', () => {
    const blocking = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [
        {
          suspensionIndex: 0,
          noticeServedDate: '2026-03-01',
          status: 'vacated-full',
          // outcomeDate deliberately unset: vacationRemarks derives
          // nothing without it, and nothing was blocking that until now.
        },
      ],
    });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v34-')),
    ).toBe(true);

    // Only `outcomeDate` changes, unset to entered. Everything else about
    // the record, including `status`, is unchanged.
    const compliant = baseForm({
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
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v34-')),
    ).toBe(false);
  });

  it('is silent on a pending or not-vacated record with no remark, which is correct, not a gap', () => {
    const pending = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [{ suspensionIndex: 0, noticeServedDate: '2026-03-01', status: 'pending' }],
    });
    expect(
      getExportBlockers(pending, [], [], []).some((i) => i.id.startsWith('navmc10132-v34-')),
    ).toBe(false);

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
    expect(
      getExportBlockers(notVacated, [], [], []).some((i) => i.id.startsWith('navmc10132-v34-')),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-29 - decision row D-49. A vacation's triggering offence must not
// predate the item 6 punishment date, the certain start of the suspension
// window MCO 011201 and JAGMAN 0118.d both describe. See
// vacationOffenceWindowIssues's own JSDoc in navmc10132-validators-punishment.ts
// for why this is asymmetric with its W-21 companion (advisory, unblocking),
// which has its own leaf-function tests in tests/navmc10132-vacation.test.ts
// rather than duplicated here, matching this file's own house pattern for
// 'warn' rules.
// ---------------------------------------------------------------------------

describe('V-29 stops the export: the vacation offence date is on or before the item 6 punishment date', () => {
  it('blocks when offenceDate is on or before punishmentDate, clears once it is strictly after', () => {
    const blocking = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [{ suspensionIndex: 0, status: 'pending', offenceDate: '2025-12-01' }],
    });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v29-')),
    ).toBe(true);

    // Only `offenceDate` changes, from before the punishment date to
    // strictly after it and within the computed suspension window.
    const compliant = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [{ suspensionIndex: 0, status: 'pending', offenceDate: '2026-02-01' }],
    });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v29-')),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-30 - decision row D-56. A FULL vacation's recorded vacating authority
// grade must be competent, under MCO 011201's "kind and amount to be
// vacated" test, for the punishment actually vacated. Silent on a partial
// vacation, deliberately: see vacatingAuthorityInsufficientIssues's own
// JSDoc in navmc10132-validators-punishment.ts. Its W-22 companion
// (advisory, unblocking) has its own leaf-function tests in
// tests/navmc10132-vacation.test.ts rather than duplicated here.
// ---------------------------------------------------------------------------

describe('V-30 stops the export: a full vacation\'s vacating authority is not competent for the punishment vacated', () => {
  it('blocks a full vacation when the vacating authority grade is below the code\'s requirement, clears once a sufficient grade is entered', () => {
    const blocking = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N13', days: '30' }], // field-grade authority required
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [{ suspensionIndex: 0, status: 'vacated-full', vacatingAuthorityGrade: 'O3' }],
    });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v30-')),
    ).toBe(true);

    // Only `vacatingAuthorityGrade` changes, from below the requirement to
    // meeting it.
    const compliant = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N13', days: '30' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [{ suspensionIndex: 0, status: 'vacated-full', vacatingAuthorityGrade: 'O5' }],
    });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v30-')),
    ).toBe(false);
  });

  it('is silent on a partial vacation with the identical insufficient grade, the deliberate boundary D-56 draws', () => {
    const partial = baseForm({
      punishmentDate: '2026-01-15',
      punishments: [{ code: 'N13', days: '30' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      vacations: [
        {
          suspensionIndex: 0,
          status: 'vacated-part',
          vacatedDetail: '10 days extra duty',
          vacatingAuthorityGrade: 'O3',
        },
      ],
    });
    expect(
      getExportBlockers(partial, [], [], []).some((i) => i.id.startsWith('navmc10132-v30-')),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-06 - item 3 rights-certification date must not be after item 6.
// ---------------------------------------------------------------------------

describe('V-06 stops the export: rights certification dated after punishment', () => {
  it('blocks when item 3 is a day after item 6, clears when the dates are equal', () => {
    // The item 3 instruction requires certification to PRECEDE imposition.
    // Equal dates are the normal case and legal; only a later certification
    // date is an error, so the compliant fixture below is same-day, not
    // earlier-day, to prove the equal-date branch is not also treated as a
    // violation.
    const blocking = baseForm({
      punishmentDate: '2026-01-15',
      rightsAttestDate: '2026-01-16',
    });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) =>
        i.id.startsWith('navmc10132-v06-rights-cert-after-punishment'),
      ),
    ).toBe(true);

    // Only `rightsAttestDate` changes, to the same day as punishmentDate.
    const compliant = baseForm({
      punishmentDate: '2026-01-15',
      rightsAttestDate: '2026-01-15',
    });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) =>
        i.id.startsWith('navmc10132-v06-rights-cert-after-punishment'),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-07 - item 11 appeal-advisement date must not be before item 6.
// ---------------------------------------------------------------------------

describe('V-07 stops the export: appeal advisement dated before punishment', () => {
  it('blocks when item 11 is a day before item 6, clears when the dates are equal', () => {
    // The item 11 instruction: advisement is normally same-day and in no
    // case prior to imposition. Same-day is legal, so the compliant
    // fixture again picks the equal-date boundary rather than a later
    // date, to prove that boundary specifically is not miscategorized.
    const blocking = baseForm({
      punishmentDate: '2026-01-15',
      appealAdvisementDate: '2026-01-14',
    });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) =>
        i.id.startsWith('navmc10132-v07-appeal-advisement-before-punishment'),
      ),
    ).toBe(true);

    // Only `appealAdvisementDate` changes, to the same day as punishmentDate.
    const compliant = baseForm({
      punishmentDate: '2026-01-15',
      appealAdvisementDate: '2026-01-15',
    });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) =>
        i.id.startsWith('navmc10132-v07-appeal-advisement-before-punishment'),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-08 - item 13 is a date XOR the Not Appealed checkbox. Two distinct
// blocking ids (-both, -neither) share the v08- family; the only compliant
// state is exactly one of the two set. Three fixtures total, two
// blocking/compliant pairs, each differing from the shared compliant
// baseline by exactly one field.
// ---------------------------------------------------------------------------

describe('V-08 stops the export: item 13 must be exactly one of date or Not Appealed', () => {
  // Baseline: exactly one control set (appealDate). This is the ONLY
  // compliant shape, so both blocking cases are reached by moving one
  // field away from it in opposite directions.
  const compliant = baseForm({ appealDate: '2026-01-20', notAppealed: false });

  it('blocks when both the date and Not Appealed are set', () => {
    // Only `notAppealed` changes from the compliant baseline, true instead
    // of false. The accused cannot simultaneously have appealed (a date
    // was recorded) and not appealed.
    const blocking = baseForm({ appealDate: '2026-01-20', notAppealed: true });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v08-'))).toBe(true);
    expect(getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v08-'))).toBe(false);
  });

  it('blocks when neither the date nor Not Appealed is set', () => {
    // `appealDate` changes from the compliant baseline, cleared back to the
    // empty-field default instead of holding a date. Item 13 cannot be left
    // blank; the instruction requires an affirmative record either way.
    //
    // `stage: 6` is also added, and has to be: item 13 is a pass-6 field
    // (D-43, D-46, spec section 13.1), and the "-neither" branch is
    // stage-scoped, silent before pass 6. `compliant` (the shared baseline
    // above, implicit stage 1) still correctly reads as not-blocked in the
    // comparison below regardless: it has `appealDate` set, so the
    // "-neither" branch was never in play for it at any stage. See the
    // "stage-scoped" describe block further down for the pass-1-stays-silent
    // proof this rule needed before this fix.
    const blocking = baseForm({ appealDate: '', notAppealed: false, stage: 6 });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v08-'))).toBe(true);
    expect(getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v08-'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-13 - item 6 punishment requires a Guilty finding on some row.
//
// DEVIATION FROM THE ORIGINAL BRIEF, RECORDED HERE ON PURPOSE: the brief
// for this file describes V-13 as recomputing from structured
// `punishments[]` "never from punishmentImposed." Reading the actual rule
// (punishmentRequiresGuiltyFinding, navmc10132-validators-offenses.ts) shows
// the opposite: it reads `formData.punishmentImposed`, the DERIVED string,
// directly, and does not look at `punishments[]` at all. The existing unit
// test for this rule (tests/navmc10132-validators.test.ts, "V-13, item 6
// punishment requires a Guilty finding") confirms this: its own fixtures
// set `punishmentImposed` and never populate `punishments`. Building this
// fixture from `punishments[]` alone, as instructed, would leave
// `punishmentImposed` at its default empty string, and the rule returns
// `[]` unconditionally when `punishmentImposed === ''` — the blocking half
// would never fire, which is exactly the kind of false-green test this
// whole file exists to prevent. The comment in
// navmc10132-validators-punishment.ts that says "V-13 recomputes from
// structure" (near punishmentPresenceIssues' own JSDoc) is therefore stale
// documentation, not a description of what the code does; see the defect
// note in the delivery report.
// ---------------------------------------------------------------------------

describe('V-13 stops the export: punishment imposed with no Guilty finding', () => {
  it('blocks when item 6 is populated and no offense row is marked Guilty', () => {
    const blocking = baseForm({
      punishmentImposed: 'Restr to the limits of HQSVCCo for 14 days.',
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave', finding: 'Not Guilty' }),
    });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) =>
        i.id.startsWith('navmc10132-punishment-requires-guilty-finding'),
      ),
    ).toBe(true);

    // Only `finding` changes, Not Guilty to Guilty.
    const compliant = baseForm({
      punishmentImposed: 'Restr to the limits of HQSVCCo for 14 days.',
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave', finding: 'Guilty' }),
    });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) =>
        i.id.startsWith('navmc10132-punishment-requires-guilty-finding'),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-14 - every selected punishment code must be authorized for release one.
// N01-N03 are officer-only (10 U.S.C. 815(b)(1)); release one is enlisted
// only, so those codes are refused regardless of who the accused is. The
// compliant fixture swaps the CODE, not any accused field — there is no
// accused-rank input this rule reads at all.
// ---------------------------------------------------------------------------

describe('V-14 stops the export: an officer-only punishment code selected in release one', () => {
  it('blocks on N01, clears when the same entry uses an enlisted-available code', () => {
    const blocking = baseForm({
      punishments: [{ code: 'N01', days: '14', suspendedFromDuty: true }],
    });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v14-'))).toBe(true);

    // Only `code` changes, N01 (officer restriction w/ suspension from
    // duty) to N09 (extra duties), which releaseOneAvailable marks true.
    const compliant = baseForm({
      punishments: [{ code: 'N09', days: '14', suspendedFromDuty: true }],
    });
    expect(getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v14-'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// V-15 - rendered item 6 text must fit the "6 PUNISHMENT IMPOSED" field,
// unless the user routed the overflow to item 21. Per the brief, the
// compliant fixture is the ROUTED case (punishmentOverflowToItem21: true),
// not merely a shorter string, so the routing branch itself is proven, not
// just the length check.
// ---------------------------------------------------------------------------

describe('V-15 stops the export: item 6 text overflows the field and is not routed to item 21', () => {
  it('blocks on an overflowing render, clears once routed to item 21', () => {
    // N11 (restriction w/ suspension, <=14 days) plus a 150-character
    // `limits` value renders well past the 123-character field. Matches
    // the fixture already proven to overflow in
    // tests/navmc10132-validators.test.ts's V-15 leaf-function tests.
    const blocking = baseForm({
      punishments: [{ code: 'N11', limits: 'A'.repeat(150), days: '14' }],
    });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v15-item6-overflow'))).toBe(
      true,
    );

    // Only `punishmentOverflowToItem21` changes, false (default) to true.
    // The rendered text is UNCHANGED and still overflows; what clears the
    // block is the user's affirmative routing choice, not a shorter entry.
    const compliant = baseForm({
      punishments: [{ code: 'N11', limits: 'A'.repeat(150), days: '14' }],
      punishmentOverflowToItem21: true,
    });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v15-item6-overflow')),
    ).toBe(false);
  });

  it('also clears on an entry that simply fits, without needing the item 21 route', () => {
    // Secondary confirmation per the brief's "cover both if you can": a
    // short entry that fits on its own merits, no routing involved.
    const fits = baseForm({ punishments: [{ code: 'N16', oralOrWritten: 'orally' }] });
    expect(getExportBlockers(fits, [], [], []).some((i) => i.id.startsWith('navmc10132-v15-item6-overflow'))).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// V-17 - rendered item 7 text must fit the single-line "7 SUSPENSION IF ANY"
// field, unless routed to item 21. Mirrors V-15's escape hatch on the item
// 7 side. Fixture reused verbatim from tests/navmc10132-suspension.test.ts's
// V-17 describe block, which already established that ONE suspended
// punishment fits and TWO overflow.
// ---------------------------------------------------------------------------

describe('V-17 stops the export: item 7 text overflows the field and is not routed to item 21', () => {
  it('blocks on two suspended punishments, clears once routed to item 21', () => {
    const twoSuspensions = {
      punishments: [
        { code: 'N09', days: '10' },
        { code: 'N08', gradeReducedTo: 'LCpl' },
      ],
      suspensions: [
        { punishmentIndex: 0, months: '6' },
        { punishmentIndex: 1, days: '30' },
      ],
    };

    const blocking = baseForm({ punishmentDate: '2026-06-02', ...twoSuspensions });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v17-item7-overflow'))).toBe(
      true,
    );

    // Only `suspensionOverflowToItem21` changes, false (default) to true.
    // The rendered item 7 text is UNCHANGED and still clips at 538.2pt
    // single-line width; what clears the block is the routing choice.
    const compliant = baseForm({
      punishmentDate: '2026-06-02',
      ...twoSuspensions,
      suspensionOverflowToItem21: true,
    });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v17-item7-overflow')),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// W-06 - an entered days or months parameter exceeds the selected code's own
// ceiling. Two ids, navmc10132-w06-days-* and navmc10132-w06-months-*, both
// severity 'block' despite the w06 prefix: per the rule's own JSDoc, "The
// rule ID prefix stays w06 even though the severity is now block, so an
// existing reference to navmc10132-w06-days or navmc10132-w06-months still
// resolves." Promoted from advisory to blocker because the ceiling is the
// MCM Part V 5.b statutory limit on the punishment itself, not a style
// preference — exceeding it is unlawful.
//
// Added after the coordinator's review found this id family allowlisted
// below with no getExportBlockers proof anywhere in the suite. Closing it
// here rather than leaving it allowlisted, same as V-01 above.
// ---------------------------------------------------------------------------

describe('W-06 stops the export: an entered days or months value exceeds the code\'s own ceiling', () => {
  it('blocks the days ceiling on N09 (max 14 days), clears at the ceiling itself', () => {
    const blocking = baseForm({ punishments: [{ code: 'N09', days: '20' }] });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-w06-days-'))).toBe(true);

    // Only `days` changes, from over the N09 ceiling (14) to exactly it.
    // Exactly-at-the-ceiling is deliberately the compliant boundary, not a
    // smaller value, to prove the ceiling itself is not miscategorized as
    // a violation.
    const compliant = baseForm({ punishments: [{ code: 'N09', days: '14' }] });
    expect(getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-w06-days-'))).toBe(false);
  });

  it('blocks the months ceiling on N04 (max 2 months), clears at the ceiling itself', () => {
    // Fixture reused from tests/navmc10132-suspension.test.ts's own W-06
    // severity-promotion test, which already established N04/months:'3'
    // exceeds the code's 2-month ceiling.
    const blocking = baseForm({ punishments: [{ code: 'N04', dollarsPerMonth: '100', months: '3' }] });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-w06-months-'))).toBe(true);

    // Only `months` changes, from over the N04 ceiling (2) to exactly it.
    const compliant = baseForm({ punishments: [{ code: 'N04', dollarsPerMonth: '100', months: '2' }] });
    expect(getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-w06-months-'))).toBe(
      false,
    );
  });
});

// ===========================================================================
// IDENTITY RULES (navmc10132-validators-identity.ts) — V-09 through V-12.
//
// WHY THESE ARRIVE SEPARATELY FROM THE ELEVEN ABOVE. This file's original
// eleven gate tests, plus V-01 and W-06, covered offenses.ts, dates.ts, and
// punishment.ts only. identity.ts was left out of that reading list, out of
// the differential that proved each of those eleven tests actually goes red
// when its rule is downgraded to 'fail', and out of the first meta test's
// own scan. The coordinator's own morning audit reported V-09 through V-12
// as covered, on a proximity heuristic (getExportBlockers appearing
// somewhere in the same test file as an assertion on the rule's id) that
// was never true: every existing assertion on these four ids reads the
// LEAF function's own return value directly (checkFieldCapacities,
// checkAccusedIdentity, checkUnitEchelon, checkEdipiFormat in
// tests/navmc10132-validators.test.ts), never getExportBlockers. That
// proves the rule EMITS the issue, not that the export gate actually stops
// on it — the identical gap the file header above describes for the
// original eleven. This section closes it for identity.ts the same way.
// ===========================================================================

describe('V-09 stops the export: a capacity-bound field overflows its measured width', () => {
  it('blocks item 17 (unit) one character over its measured width, clears one character under', () => {
    // "17 UNIT" in NAVMC_10132_FIELD_METRICS (navmc10132-field-metrics.ts)
    // measures width: 538.17pt at Helvetica/Arial 8pt. navmc10132-capacity.ts
    // subtracts 2pt padding per side, so usable width is 538.17 - 4 = 534.17pt.
    // 'W' is Helvetica's widest printable character (944 per 1000 em), which
    // at 8pt measures exactly 944/1000 * 8 = 7.552pt. 71 W's measure
    // 71 * 7.552 = 536.192pt, over the 534.17pt usable width; 70 W's measure
    // 528.64pt, under it. The compliant fixture is the blocking one with
    // exactly ONE character removed, not merely a short or empty string, so
    // this proves the actual measured-width boundary V-09 checks rather than
    // proving an empty field does not overflow (V-09 explicitly skips empty
    // values, `if (value === '') continue`, which would prove nothing about
    // the width check itself).
    //
    // The assertion below checks the UN-suffixed prefix
    // navmc10132-v09-overflow-, not navmc10132-v09-overflow-17-unit, on
    // purpose: this rule's static id (what the meta test below extracts
    // from the source) is the template up to its `${`, which is the
    // un-suffixed form — the per-field suffix only exists at runtime.
    // Asserting the longer, field-specific string here would still catch
    // this fixture's own issue, but would not satisfy the meta test's
    // "the recorded anchor is a prefix of the rule's own id prefix" check,
    // and this test would silently stop counting as this rule's gate test.
    // Every other capacity-bound field is left at its baseForm default
    // (empty, which V-09 explicitly skips), so `unit` is the only field
    // that can produce a navmc10132-v09-overflow- issue in this fixture,
    // and the un-suffixed prefix is unambiguous here.
    const blocking = baseForm({ unit: 'W'.repeat(71) });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v09-overflow-')),
    ).toBe(true);

    // Only `unit` changes, one fewer 'W'.
    const compliant = baseForm({ unit: 'W'.repeat(70) });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v09-overflow-')),
    ).toBe(false);
  });
});

describe('V-10 stops the export: the accused identity (items 18-20) is incomplete', () => {
  it('blocks when item 20 (EDIPI) is blank, clears once it is entered', () => {
    // Items 18, 19, and 20 are all required; V-10 fires listing whichever
    // are blank. Item 18 and item 19 are held constant and non-empty across
    // both fixtures so only item 20 (accusedEdipi) is exercised, and a
    // malformed-but-present EDIPI is deliberately avoided here (V-12's
    // job, not V-10's, per checkAccusedIdentity's own JSDoc and
    // checkEdipiFormat's "An empty accused EDIPI is V-10's problem, not
    // this rule's" note). This is a pass-1 field (item 17-20 items,
    // spec section 13.1), so per the "Stage scoping" describe blocks above
    // it needs no stage guard, only this gate test — see the task's own
    // instruction not to add scoping here.
    const blocking = baseForm({
      accusedName: 'Doe, John A.',
      accusedRankGrade: 'Sgt/E-5',
      accusedEdipi: '',
    });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v10-accused-identity-incomplete')),
    ).toBe(true);

    // Only `accusedEdipi` changes, blank to a well-formed 10-digit EDIPI.
    const compliant = baseForm({
      accusedName: 'Doe, John A.',
      accusedRankGrade: 'Sgt/E-5',
      accusedEdipi: '1234567890',
    });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v10-accused-identity-incomplete')),
    ).toBe(false);
  });
});

describe('V-11 stops the export: item 17 (unit) is blank', () => {
  it('blocks when unit is blank, clears once it is entered', () => {
    // A pass-1 field (item 17, spec section 13.1), so per the "Stage
    // scoping" describe blocks above it needs no stage guard, only this
    // gate test — see the task's own instruction not to add scoping here.
    // The compliant value is deliberately not equal to accusedName, since
    // that shape (matching text in both fields) trips the separate,
    // 'warn'-severity navmc10132-v11-unit-matches-accused-name check
    // instead, which is irrelevant to what this test proves and never
    // reaches getExportBlockers regardless.
    const blocking = baseForm({ unit: '' });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v11-unit-blank'))).toBe(
      true,
    );

    // Only `unit` changes, blank to a real unit name.
    const compliant = baseForm({ unit: 'HQ Company, 1st Battalion' });
    expect(getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v11-unit-blank'))).toBe(
      false,
    );
  });
});

describe('V-12 stops the export: a present EDIPI-shaped field is not exactly 10 digits', () => {
  // Two independent pairs, one per item (20 and 8B), each holding the
  // OTHER EDIPI field blank throughout (an empty value is explicitly
  // skipped by checkEdipiFormat, `if (trimmed === '') continue`, so it
  // never contributes an issue and cannot cross-contaminate the other
  // item's proof).
  //
  // BOTH PAIRS ASSERT ON THE SAME UN-SUFFIXED PREFIX,
  // navmc10132-v12-edipi-format-, DELIBERATELY, for two independent
  // reasons: (1) that is this rule's actual static id, the template up
  // to its `${`, which the meta test below extracts from the source and
  // requires an anchor to be a PREFIX of, not a longer, more specific
  // string, so a per-item anchor like navmc10132-v12-edipi-format-20
  // would silently stop counting as this rule's gate test; (2)
  // checkEdipiFormat checks item 20 before item 8B in its own candidates
  // array, and asserting the shared, un-suffixed prefix means neither
  // test below depends on which item that loop happens to reach first,
  // exactly the ordering concern the task named. Each fixture still
  // proves its own item independently: only one EDIPI field is ever
  // malformed at a time (the other is blank and skipped), so whichever
  // navmc10132-v12-edipi-format- issue appears in a given fixture can
  // only be the one that fixture's own malformed field produced.

  it('blocks a malformed item 20 (accused EDIPI), clears once it is 10 digits', () => {
    const blocking = baseForm({ accusedEdipi: '12345', njpAuthorityEdipi: '' });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v12-edipi-format-')),
    ).toBe(true);

    // Only `accusedEdipi` changes, to a well-formed 10-digit EDIPI.
    const compliant = baseForm({ accusedEdipi: '1234567890', njpAuthorityEdipi: '' });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v12-edipi-format-')),
    ).toBe(false);
  });

  it('blocks a malformed item 8B (NJP authority EDIPI), clears once it is 10 digits, independent of item 20', () => {
    const blocking = baseForm({ accusedEdipi: '', njpAuthorityEdipi: 'ABCDEFGHIJ' });
    expect(
      getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v12-edipi-format-')),
    ).toBe(true);

    // Only `njpAuthorityEdipi` changes, to a well-formed 10-digit EDIPI.
    const compliant = baseForm({ accusedEdipi: '', njpAuthorityEdipi: '1234567890' });
    expect(
      getExportBlockers(compliant, [], [], []).some((i) => i.id.startsWith('navmc10132-v12-edipi-format-')),
    ).toBe(false);
  });
});

// ===========================================================================
// STAGE SCOPING (D-43, D-46) — the actual defect this file exists to close.
// Measured live: a brand new, pass-1 notification document was blocked on
// "Item 6 punishment imposed is empty" and "Item 13 has neither an appeal
// date nor the Not Appealed checkbox set," even though the stage selector
// (StageSelector.tsx, per D-46) hides both sections from a pass-1 clerk.
// Item 6 belongs to pass 3 and item 13 to pass 6 (spec section 13.1); both
// are correct, unremarkable states for a notification document.
//
// ONLY THREE RULES NEEDED SCOPING, not a table mapping every rule to a
// pass. A rule only misfires early if it complains a field is ABSENT: V-04
// (item 6 empty), the empty-item-7 branch of V-05, and the "-neither"
// branch of V-08 (item 13). Every other block rule in this file complains
// a field is WRONG, which is naturally silent when the field is empty
// (there is nothing to be wrong about yet) — V-20 does not fire on a blank
// forfeiture, V-21 does not fire on an empty punishment set, and so on for
// the rest. See the delivery report for the full rule-by-rule enumeration;
// this section proves the three that needed scoping, in both directions.
// ===========================================================================

describe('Stage scoping: a fresh pass-1 document is not blocked on pass-3/pass-6 fields', () => {
  it('does not block on empty item 6, item 7, or item 13 at stage 1', () => {
    // Matches what createEmptyNavmc10132Data and the StageSelector both
    // default a brand new document to. Navmc10132Sections.tsx gates the
    // punishment/suspension sections behind navmc10132StageAtLeast(3) and
    // the appeal block behind stage 4, so a pass-1 clerk cannot even see
    // items 6, 7, or 13 — the export gate must not demand they be filled.
    const form = baseForm({
      stage: 1,
      punishments: [],
      suspension: '',
      appealDate: '',
      notAppealed: false,
    });
    const blockers = getExportBlockers(form, [], [], []);
    expect(blockers.some((i) => i.id.startsWith('navmc10132-v04-punishment-empty'))).toBe(false);
    expect(blockers.some((i) => i.id.startsWith('navmc10132-v05-suspension-empty'))).toBe(false);
    expect(blockers.some((i) => i.id.startsWith('navmc10132-v08-item13-neither'))).toBe(false);
  });

  it('starts blocking again exactly at the stage that first owns each field', () => {
    // Item 6 and item 7 open at pass 3; item 13 opens at pass 6 (spec
    // section 13.1). Same empty shape at every stage below, only `stage`
    // moves, one pass at a time across the boundary each rule cares about.
    const shape = { punishments: [] as unknown[], suspension: '', appealDate: '', notAppealed: false };

    const atPass2 = getExportBlockers(baseForm({ ...shape, stage: 2 }), [], [], []);
    expect(atPass2.some((i) => i.id.startsWith('navmc10132-v04-punishment-empty'))).toBe(false);
    expect(atPass2.some((i) => i.id.startsWith('navmc10132-v05-suspension-empty'))).toBe(false);

    const atPass3 = getExportBlockers(baseForm({ ...shape, stage: 3 }), [], [], []);
    expect(atPass3.some((i) => i.id.startsWith('navmc10132-v04-punishment-empty'))).toBe(true);
    expect(atPass3.some((i) => i.id.startsWith('navmc10132-v05-suspension-empty'))).toBe(true);
    // Item 13 has not opened yet at pass 3.
    expect(atPass3.some((i) => i.id.startsWith('navmc10132-v08-item13-neither'))).toBe(false);

    const atPass5 = getExportBlockers(baseForm({ ...shape, stage: 5 }), [], [], []);
    expect(atPass5.some((i) => i.id.startsWith('navmc10132-v08-item13-neither'))).toBe(false);

    const atPass6 = getExportBlockers(baseForm({ ...shape, stage: 6 }), [], [], []);
    expect(atPass6.some((i) => i.id.startsWith('navmc10132-v08-item13-neither'))).toBe(true);
  });
});

describe('Stage scoping does not weaken the gate on a finished document', () => {
  // Both requirements below are the reason `navmc10132ExportGateStage`
  // (src/types/navmc.ts) exists as a function distinct from
  // `navmc10132Stage`: the export gate must not quietly drop a real
  // blocker just because a document's `stage` is unset or points at an
  // early pass it may not actually still be at.

  it('still blocks on every stage-scoped field at the final numbered pass (7)', () => {
    const form = baseForm({
      stage: 7,
      punishments: [],
      suspension: '',
      appealDate: '',
      notAppealed: false,
    });
    const blockers = getExportBlockers(form, [], [], []);
    expect(blockers.some((i) => i.id.startsWith('navmc10132-v04-punishment-empty'))).toBe(true);
    expect(blockers.some((i) => i.id.startsWith('navmc10132-v05-suspension-empty'))).toBe(true);
    expect(blockers.some((i) => i.id.startsWith('navmc10132-v08-item13-neither'))).toBe(true);
  });

  it('still blocks at stage "complete"', () => {
    const form = baseForm({
      stage: 'complete',
      punishments: [],
      suspension: '',
      appealDate: '',
      notAppealed: false,
    });
    const blockers = getExportBlockers(form, [], [], []);
    expect(blockers.some((i) => i.id.startsWith('navmc10132-v04-punishment-empty'))).toBe(true);
    expect(blockers.some((i) => i.id.startsWith('navmc10132-v05-suspension-empty'))).toBe(true);
    expect(blockers.some((i) => i.id.startsWith('navmc10132-v08-item13-neither'))).toBe(true);
  });

  it('treats a document with no `stage` key at all as complete, not pass 1 (D-46)', () => {
    // `stage` is app state, never written to the AcroForm
    // (`Navmc10132Data.stage`'s own JSDoc), so a document saved before
    // this field existed carries no `stage` key at all. That silence has
    // to read as "predates the field," never "just started": an old
    // document is more likely complete than freshly begun, and the two
    // wrong defaults are not symmetric. Defaulting to pass 1 here would
    // silently drop every later-pass blocker on a document that may
    // actually be finished; defaulting to 'complete' only risks a false
    // complaint on a genuinely early document, which is recoverable and
    // is exactly the pre-scoping behaviour every clerk already knows how
    // to read past. Built by deleting `stage` off an otherwise-ordinary
    // fixture, matching what an actually old saved document's FormData
    // looks like, rather than trusting baseForm's own `stage: 1` default
    // (from createEmptyNavmc10132Data, correct for a FRESH document, see
    // `navmc10132ExportGateStage`'s own JSDoc for why the export gate
    // cannot share that default).
    const form = baseForm({ punishments: [], suspension: '', appealDate: '', notAppealed: false });
    delete (form as { stage?: unknown }).stage;
    expect('stage' in form).toBe(false);

    const blockers = getExportBlockers(form, [], [], []);
    expect(blockers.some((i) => i.id.startsWith('navmc10132-v04-punishment-empty'))).toBe(true);
    expect(blockers.some((i) => i.id.startsWith('navmc10132-v05-suspension-empty'))).toBe(true);
    expect(blockers.some((i) => i.id.startsWith('navmc10132-v08-item13-neither'))).toBe(true);
  });
});

// ===========================================================================
// SHARED SCANNER PROOF — the three meta guards below all read
// NAVMC10132_VALIDATOR_MODULES and extractBlockSeverityRuleIds from
// tests/navmc10132-blocker-scan.ts instead of each carrying its own file
// list and its own id-extraction regex. This is the fix for a real defect
// the coordinator measured directly: the original per-guard regex stopped
// a quoted id at the FIRST quote character of any kind, backtick, single,
// or double, which cannot span
// navmc10132-v09-overflow-${field.toLowerCase().replace(/[^a-z0-9]+/g,
// '-')}` in navmc10132-validators-identity.ts (the single-quoted `'-'`
// inside the template's own .replace() call ends the match before the
// id's real closing backtick). That guard also never scanned identity.ts
// at all. A guard whose own coverage nobody measures is the exact failure
// this whole exercise exists to eliminate, so before any guard relies on
// the shared scanner, this block proves the scanner itself is not making
// the same mistake, or a new one, rather than just asserting it. See
// tests/navmc10132-blocker-scan.ts's own JSDoc for the full story and for
// what this proof still cannot catch.
// ===========================================================================

describe('Meta: the shared blocker scanner is not silently under-counting', () => {
  it('finds V-09 by name, the exact case the id-extraction regex used to miss', () => {
    const libDir = join(__dirname, '..', 'src', 'lib');
    const src = readFileSync(join(libDir, 'navmc10132-validators-identity.ts'), 'utf-8');
    const ids = extractBlockSeverityRuleIds(src);
    expect(ids).toContain('navmc10132-v09-overflow-');
  });

  it('never returns fewer ids than an independently-computed count of block severity arguments, for every scanned module', () => {
    const libDir = join(__dirname, '..', 'src', 'lib');
    for (const fileName of NAVMC10132_VALIDATOR_MODULES) {
      const src = readFileSync(join(libDir, fileName), 'utf-8');
      const extractedCount = extractBlockSeverityRuleIds(src).length;
      const independentCount = countBlockSeverityArguments(src);
      // countBlockSeverityArguments is a deliberately different regex
      // (comma-flanked 'block', no id-matching at all), so the two
      // methods can only agree by both being right, not by sharing a bug.
      expect(
        extractedCount,
        `${fileName}: the id extractor found ${extractedCount} block-severity call sites, ` +
          `but ${independentCount} comma-flanked 'block' severity arguments actually exist ` +
          `in the source. The extractor must never find fewer.`,
      ).toBeGreaterThanOrEqual(independentCount);
    }
  });
});

// ===========================================================================
// META TEST — the real deliverable.
//
// Everything above proves NAMED rules stop the export today. This test's
// job is different: it reads the validator source directly and fails when
// SOME rule, present or future, is marked severity 'block' in code but has
// no proof anywhere in the test suite that getExportBlockers actually
// stops it for that rule. Its purpose is to make the next blocker, whenever
// it is written, arrive already gated instead of repeating the archaeology
// this file did for its first eleven rules.
//
// WHAT IT SCANS. NAVMC10132_VALIDATOR_MODULES (tests/navmc10132-blocker-scan.ts),
// shared with the two meta guards below it in this file. That module
// carries the full explanation for what changed and why: this guard used
// to scan only three files, offenses/dates/punishment, and hand-excluded
// navmc10132-validators-identity.ts on the reasoning that none of the
// eleven rules this file was built to prove came from it. That reasoning
// never covered what THIS guard exists to protect against — identity.ts
// carries its own block-severity rules (V-09 through V-12), just as exposed
// to an unproven-blocker defect as anything in the other three files, and
// this guard was never checking them. The coordinator caught this by
// measuring the id-extraction regex's actual capture rate against a raw
// count of 'block' occurrences per file and finding identity.ts silently
// omitted entirely. Excluding it again would repeat the identical mistake
// one more time, so it is in the shared file list now, for every guard.
//
// HOW IT DECIDES A RULE IS A "BLOCKER". Every rule in these four modules
// builds its ValidationIssue through a same-shaped local `issue(id,
// severity, rule, citation, detail)` call. `extractBlockSeverityRuleIds`
// (tests/navmc10132-blocker-scan.ts) looks for literal occurrences of that
// shape where the severity argument is the string 'block', and takes the
// id argument (up to the first `${` for a template id) as the rule's
// static id prefix — the part every id it ever emits at runtime is
// guaranteed to start with. This is a source-text pattern match, not a
// type-checked AST walk, and the "shared scanner is not silently
// under-counting" describe block above is what proves this extraction
// itself is trustworthy before this test relies on it.
//
// WHAT "HAS A GATE TEST" MEANS HERE. For each such id prefix, this scans
// every *.test.ts file in this directory (tests/) for a file that both (a)
// calls getExportBlockers, and (b) contains an
// an `i.id.startsWith(anchor)`-shaped call whose literal anchor argument is a
// prefix of the rule's id prefix — meaning any id that rule could ever
// produce would satisfy that anchor check. That is deliberately the exact
// shape every test above (and the existing V-18..V-22 gate tests) uses, so
// a new rule is "gated" exactly when someone has written the same kind of
// proof this file writes, wherever they put it — this file, or a sibling
// like tests/njp-suspension-period.test.ts, which already carries V-22's
// gate test and should not have that test duplicated here just to satisfy
// this scan.
//
// THE ALLOWLIST IS EMPTY, AND STAYS EMPTY UNLESS A REAL DECISION EARNS AN
// ENTRY. Two id families — navmc10132-offense-article-present (V-01) and
// navmc10132-w06- (punishmentParameterCeilingIssues) — were found allowlisted
// here in an earlier pass of this file, each with no getExportBlockers-backed
// proof anywhere in the suite. That allowlist was itself a smaller copy of
// the original defect: it let this meta test pass green while two genuinely
// unproven blockers sat unwatched, which is exactly how V-18 through V-22
// survived. Both now have gate tests above (see the V-01 and W-06 describe
// blocks) and the allowlist was closed rather than carried.
//
// An entry belongs here only for a rule that is a genuine, considered,
// out-of-scope exception — not a rule someone did not get around to gating.
// Any addition needs, in the same commit, a comment naming the rule, the
// reason it is not gated, and who accepted that gap; "predates this file"
// is not by itself such a reason, as this file's own history shows. The
// empty array below is the expected steady state — and per the coordinator's
// own instruction, a prefix that turns up uncovered now that identity.ts is
// scanned does NOT get added here blind; it gets reported and left for a
// decision.
//
// WHAT THIS CANNOT CATCH, ON PURPOSE STATED HERE:
//   1. A rule documented in prose or a JSDoc comment as a "blocker" that
//      actually emits severity 'fail' or 'warn' in code. This is the EXACT
//      shape of the original V-18..V-22 defect. This scan only looks at
//      the severity string actually passed to `issue(...)`; if that string
//      is 'fail' or 'warn', the rule is invisible to this scan, precisely
//      because it is not a blocker as far as getExportBlockers is
//      concerned. Catching THAT class of defect requires a human reading a
//      rule's docstring against its own severity argument, which is how
//      the original defect was found and cannot be automated away by a
//      test that only trusts the code it is checking.
//   2. A rule whose `issue(...)` call is not literally shaped
//      `issue(<id>, 'block', ...)` in the source text — a severity chosen
//      via a variable, a ternary, or a differently-named local helper
//      would not match this scan's regex and would silently not be
//      counted as a blocker at all.
//   3. Precision of the "has a gate test" check: it requires
//      getExportBlockers and a matching startsWith anchor to appear
//      SOMEWHERE in the same file, not literally in the same test case. A
//      file that gates one rule via getExportBlockers and separately uses
//      `.id.startsWith(...)` for an unrelated string elsewhere could in
//      principle be miscounted as covering a rule it does not. In this
//      suite every such file is scoped to one validator family, so this
//      has not produced a false pass in practice, but it is a file-level
//      heuristic, not a per-test proof.
//   4. Whatever the shared scanner itself cannot catch — see
//      tests/navmc10132-blocker-scan.ts's own JSDoc on
//      extractBlockSeverityRuleIds.
// ===========================================================================

describe('Meta: every source-level export blocker has a getExportBlockers-backed gate test', () => {
  it('finds no block-severity rule in the four rule modules without a matching startsWith proof in tests/', () => {
    const libDir = join(__dirname, '..', 'src', 'lib');
    const testsDir = __dirname;

    // DELIBERATELY EMPTY. See the ALLOWLIST note above: this held two
    // genuinely unproven blockers (V-01, W-06) in an earlier pass and both
    // now have real gate tests instead. An entry here is a last resort for
    // a considered, out-of-scope exception, never a substitute for writing
    // the gate test — see the failure message below, which says so.
    const ALLOWLISTED_PREFIXES: string[] = [];

    type BlockerRef = { file: string; idPrefix: string };
    const blockers: BlockerRef[] = [];

    for (const fileName of NAVMC10132_VALIDATOR_MODULES) {
      const src = readFileSync(join(libDir, fileName), 'utf-8');
      for (const idPrefix of extractBlockSeverityRuleIds(src)) {
        blockers.push({ file: fileName, idPrefix });
      }
    }

    // Sanity check on the scan itself: if this finds nothing, the shared
    // scanner or the file list broke, and the rest of this test would
    // trivially pass for the wrong reason (nothing to check). Fail loudly
    // instead.
    expect(blockers.length).toBeGreaterThan(0);

    // Collect every `i.id.startsWith(anchor)`-shaped literal argument out of
    // every test file in this directory, but only from files that also
    // call getExportBlockers — see limitation #3 above.
    const STARTS_WITH_RE = /\.id\.startsWith\(\s*['"]([^'"]+)['"]\s*\)/g;
    const gateAnchors = new Set<string>();
    for (const testFile of readdirSync(testsDir)) {
      if (!testFile.endsWith('.test.ts')) continue;
      const content = readFileSync(join(testsDir, testFile), 'utf-8');
      if (!content.includes('getExportBlockers(')) continue;
      let m: RegExpExecArray | null;
      STARTS_WITH_RE.lastIndex = 0;
      while ((m = STARTS_WITH_RE.exec(content)) !== null) {
        gateAnchors.add(m[1]);
      }
    }
    expect(gateAnchors.size).toBeGreaterThan(0);

    const isAllowlisted = (idPrefix: string) =>
      ALLOWLISTED_PREFIXES.some((allowed) => idPrefix.startsWith(allowed));

    // A blocker is covered when some recorded anchor T is a prefix of the
    // rule's own static id prefix — meaning every id that rule could ever
    // emit at runtime necessarily starts with T, so `id.startsWith(T)`
    // would actually catch it.
    const isCovered = (idPrefix: string) =>
      Array.from(gateAnchors).some((anchor) => idPrefix.startsWith(anchor));

    const seen = new Set<string>();
    const uncovered: string[] = [];
    for (const { file, idPrefix } of blockers) {
      const key = `${file}:${idPrefix}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (isAllowlisted(idPrefix)) continue;
      if (!isCovered(idPrefix)) {
        uncovered.push(`${idPrefix}  (from ${file})`);
      }
    }

    expect(
      uncovered,
      uncovered.length
        ? `The following block-severity rule id(s) have no getExportBlockers-backed ` +
          `gate test anywhere in tests/*.test.ts. Write a blocking/compliant pair, in ` +
          `the same house pattern as the tests in this file, that calls ` +
          `getExportBlockers and asserts on the id prefix — that is the normal fix. ` +
          `Adding the prefix to ALLOWLISTED_PREFIXES instead is a last resort for a ` +
          `genuine, considered, out-of-scope exception, not a way to make this test ` +
          `pass without writing the proof; it requires a comment recording who ` +
          `accepted the gap and why, and "no test exists yet" is not such a reason ` +
          `(see the ALLOWLIST note above — that is exactly how V-01 and W-06 ended up ` +
          `here before this test's own history closed them):\n  ` + uncovered.join('\n  ')
        : undefined,
    ).toEqual([]);
  });
});

// ===========================================================================
// SECOND META TEST — attempting the ORIGINAL defect shape directly.
//
// The first meta test's limitation #1 says it cannot catch a rule
// documented in prose as a "blocker" whose code actually emits severity
// 'fail' or 'warn' — precisely the V-18..V-22 defect this whole file
// traces back to. This test attempts that catch: it reads each rule's own
// JSDoc and compares it against the severity its own issue() calls
// actually use, inside the same function.
//
// THE CONVENTION IT KEYS ON. `grep -n -i blocker` across the three scanned
// files turns up 17 lines. Read by hand, every function-level JSDoc that
// currently describes a rule as a CURRENT blocker opens with the rule's
// own label immediately followed by "(blocker...)" or ", blocker." —
// "V-06 (blocker)", "V-05 (blocker for the empty case, advisory for the
// short case)", "V-05 addendum (blocker)", "V-17, blocker.", "W-06
// (blocker)", and so on. Everything else that contains the word — the
// file-level header prose ("Covers the punishment-side blockers and
// warnings..."), the aggregate function's ordering comment ("blockers
// first (V-04, V-05, V-14, V-15, V-16)... W-06 is a blocker despite
// sitting among the W-numbered rules"), and the "SEVERITY IS 'block', NOT
// 'fail'" warning above the local issue() helper — is either not attached
// to an exported rule function at all, or does not have "blocker"
// immediately following a rule label. This scan's pattern is deliberately
// narrow enough to exclude all of those and catch only the codebase's own
// per-rule affirmative marker.
//
// THE HARD CASE, VERIFIED BY NAME BELOW: appealDecisionIncreaseIssues
// (V-16). Its JSDoc reads "V-16, downgraded from blocker to advisory." —
// the word "blocker" is present, describing a FORMER state the very same
// sentence reverses. A naive "JSDoc contains the word blocker" check would
// flag this as a false mismatch on the one rule that most directly proves
// the check is doing its job (a real, correctly-documented downgrade). The
// pattern below requires "blocker" to sit immediately after the rule's
// label, separated only by whitespace and the connecting comma or paren —
// "V-16, downgraded from blocker" has "downgraded from" filling that gap,
// so it does not match, and V-16 is correctly never flagged.
//
// suspensionTermsIssues (V-05) is the coordinator's other named case: its
// JSDoc, "V-05 (blocker for the empty case, advisory for the short case)",
// DOES match (the word directly follows the opening paren), and its body
// DOES contain a severity 'block' issue (the empty-item-7 case), so it
// correctly does not fire either — checked explicitly below by name, since
// getting V-05 right in the OTHER direction (silently never being checked
// at all) would be just as wrong as a false positive.
//
// WHAT THIS DOES AND DOES NOT CATCH:
//   - CATCHES: a rule whose JSDoc uses this codebase's own established
//     "label (blocker)" / "label, blocker" phrasing while its function
//     body emits no severity 'block' anywhere — the exact shape of the
//     original defect, reproduced as a regression guard.
//   - DOES NOT CATCH a rule described as a blocker in looser prose that
//     does not follow this convention (e.g. "this rule blocks export" or
//     "W-06 is a blocker" with other words in between, as the aggregate's
//     own ordering comment happens to phrase it) — such phrasing is
//     invisible to this pattern by design, favoring missing a case over
//     flagging a false one. If a future rule's JSDoc is written that way,
//     this test will not catch a severity regression on it; only writing
//     it in the established convention, or widening this pattern and
//     re-verifying against V-16 and V-05 again, closes that gap.
//   - DOES NOT CATCH V-01 (offenseArticlePresent): its JSDoc, "V-01: at
//     least one offense row carries an article," never uses the word
//     "blocker" at all, so there is no doc claim here to check against
//     the code. That was a real, separate gap (no getExportBlockers proof
//     anywhere), closed above by writing its gate test, not by this scan.
//   - Inherits the brace-matching caveat documented on
//     extractFunctionBody below: it is a depth-counting scan, not a real
//     parser, verified by hand against the current contents of these
//     four files rather than proven safe against arbitrary future code.
//   - Scoped to NAVMC10132_VALIDATOR_MODULES (tests/navmc10132-blocker-scan.ts),
//     the same shared file list the first meta test uses, identity.ts
//     included. Checked by hand: none of identity.ts's own JSDoc blocks use
//     the "label (blocker)" / "label, blocker" phrasing this scan keys on
//     (grep -ni blocker there turns up only the file-header prose and a
//     type-union line comment, neither attached to an exported function),
//     so widening this scan to include it changes nothing about what it
//     currently flags — it only means a future identity.ts rule written
//     with a mismatched JSDoc will now be caught the same way one in the
//     other three files already is.
// ===========================================================================

describe('Meta: a JSDoc-documented blocker rule must actually emit severity block', () => {
  it('flags a rule whose JSDoc affirmatively calls it a blocker but whose code never emits block', () => {
    const libDir = join(__dirname, '..', 'src', 'lib');
    const SCANNED_SOURCE_FILES = NAVMC10132_VALIDATOR_MODULES;

    // Matches a rule label ("V-06", "W-06", "V-05 addendum", ...)
    // immediately followed by "(blocker" or ", blocker" — this codebase's
    // own affirmative marker. Does NOT match "downgraded from blocker",
    // "blockers first (V-04, ...)", or "W-06 is a blocker", because other
    // words sit between the label's punctuation and the word "blocker" in
    // each of those. See the file note above for why that gap matters.
    const AFFIRMATIVE_BLOCKER_RE = /(?:V|W)-\d+(?:\s+\w+)?\s*[,(]\s*blocker\b/i;

    // A severity 'block' emission anywhere in a function body: this
    // codebase's local issue(id, severity, rule, citation, detail) helper
    // always places severity as a quoted literal directly after a comma.
    const HAS_BLOCK_SEVERITY_RE = /,\s*['"]block['"]/;

    /**
     * Returns the source substring from `openBraceIndex` through its
     * matching closing brace, by depth-counting characters. Not a real
     * parser: it does not special-case braces inside string, template, or
     * regex literals. Verified safe for these four files by hand — the
     * only in-body brace pairs besides each function's own block are
     * self-balanced `${expr}` template interpolations (one open, one
     * close each) and single `(x as { a?: T })` inline casts, none of
     * which straddle a function boundary in the current source. Checked
     * again for navmc10132-validators-identity.ts specifically when this
     * scan widened to include it: every `${...}` there (the V-09 and V-12
     * id templates, the capacity-field message strings) is the same
     * self-balanced one-open-one-close shape, nothing nested. A future
     * edit that introduces an unbalanced brace inside a string literal in
     * one of these bodies could desync this scan; nothing here defends
     * against that short of a real TypeScript parser.
     */
    function extractFunctionBody(src: string, openBraceIndex: number): string {
      let depth = 0;
      for (let i = openBraceIndex; i < src.length; i++) {
        const ch = src[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) return src.slice(openBraceIndex, i + 1);
        }
      }
      return src.slice(openBraceIndex);
    }

    const JSDOC_RE = /\/\*\*[\s\S]*?\*\//g;
    const EXPORTED_FUNCTION_RE = /^\s*export function (\w+)/;

    const checkedFunctions: string[] = [];
    const mismatches: string[] = [];

    for (const fileName of SCANNED_SOURCE_FILES) {
      const src = readFileSync(join(libDir, fileName), 'utf-8');
      JSDOC_RE.lastIndex = 0;
      let jm: RegExpExecArray | null;
      while ((jm = JSDOC_RE.exec(src)) !== null) {
        const jsdocText = jm[0];
        const afterIdx = jm.index + jm[0].length;
        const rest = src.slice(afterIdx);

        // Only JSDoc blocks that sit directly above an exported function
        // declaration are in scope — file headers, the aggregate's own
        // JSDoc, and the local issue() helper's warning comment all
        // precede something other than `export function`, and are
        // skipped here rather than by content.
        const funcMatch = EXPORTED_FUNCTION_RE.exec(rest);
        if (!funcMatch) continue;
        const funcName = funcMatch[1];

        const relBrace = rest.indexOf('{');
        if (relBrace === -1) continue;
        const body = extractFunctionBody(src, afterIdx + relBrace);

        checkedFunctions.push(funcName);
        if (AFFIRMATIVE_BLOCKER_RE.test(jsdocText) && !HAS_BLOCK_SEVERITY_RE.test(body)) {
          mismatches.push(
            `${funcName} (${fileName}): JSDoc affirmatively calls this a blocker, but no ` +
              `issue() call in its body uses severity 'block'.`,
          );
        }
      }
    }

    // Sanity check on the scan itself: if this finds no functions at all,
    // the regexes broke and the rest of this test would pass for the
    // wrong reason (nothing was actually checked).
    expect(checkedFunctions.length).toBeGreaterThan(0);

    // The two cases the coordinator asked to verify by name: both must be
    // reached by the scan (present in checkedFunctions) and neither must
    // be flagged.
    expect(checkedFunctions).toContain('suspensionTermsIssues'); // V-05: mixed severity, must NOT be flagged
    expect(checkedFunctions).toContain('appealDecisionIncreaseIssues'); // V-16: "downgraded from blocker", must NOT be flagged
    expect(mismatches.some((m) => m.startsWith('suspensionTermsIssues'))).toBe(false);
    expect(mismatches.some((m) => m.startsWith('appealDecisionIncreaseIssues'))).toBe(false);

    expect(
      mismatches,
      mismatches.length
        ? `The following rule(s) are documented as a blocker in their own JSDoc but ` +
          `never emit severity 'block' in code — this is the V-18..V-22 defect shape. ` +
          `Fix the severity argument to 'block' if the rule is meant to gate the ` +
          `export, or reword the JSDoc if it is not:\n  ` + mismatches.join('\n  ')
        : undefined,
    ).toEqual([]);
  });
});

// ===========================================================================
// THIRD META TEST — a stage-scoping decision must exist for every
// block-severity rule, so a new blocker arrives already CONSIDERED.
//
// WHY THIS EXISTS. The first meta test above makes sure a new blocker has
// a getExportBlockers-backed gate test. The second makes sure a rule
// documented as a blocker actually emits severity 'block'. Neither one
// asks the question this file's own header exists to answer: DOES THIS
// RULE MISFIRE ON A DOCUMENT THAT HAS NOT REACHED THE PASS ITS FIELD
// BELONGS TO? A new rule added next month, correctly gated and correctly
// severitied, can still repeat the D-43 defect if nobody stops to ask
// whether it complains about a field's ABSENCE rather than its
// WRONGNESS, and if so, which pass first owns that field. This test does
// not answer that question for anyone. It only makes sure someone did, by
// requiring every block-severity id prefix this scan finds to be a key in
// NAVMC10132_STAGE_SCOPE_DECISIONS below, so a new prefix with no entry
// fails loudly instead of silently inheriting no scope at all.
//
// SHARES ITS FILE LIST AND ITS EXTRACTION WITH THE OTHER TWO META TESTS
// NOW (tests/navmc10132-blocker-scan.ts). This guard was the first of the
// three to scan navmc10132-validators-identity.ts and to use a
// quote-balanced id extractor, back when the other two guards still used
// their own copies of both. Three guards independently trusting their own
// copies of "which files" and "how to extract an id" is exactly how the
// first two silently under-scanned for as long as they did, so all three
// now read NAVMC10132_VALIDATOR_MODULES and call
// extractBlockSeverityRuleIds from that one shared module instead of
// carrying their own. This guard keeps its own registry,
// NAVMC10132_STAGE_SCOPE_DECISIONS below, because the scoping DECISION for
// each rule is specific to what this guard checks, not something the other
// two need.
//
// THE REGISTRY BELOW IS THE DECISION, NOT A RUNTIME MAPPING. Only three
// entries actually gate anything at runtime (see the "Stage scoping"
// describe blocks above and the STAGE-SCOPED JSDoc paragraphs on
// punishmentPresenceIssues, suspensionTermsIssues, and
// v08AppealDateExclusiveOfNotAppealed). The other thirty carry a recorded
// reason instead: either the rule complains a field is WRONG, which is
// naturally silent while that field is still empty, or the field it checks
// for absence is already owned at pass 1, the earliest stage there is, so
// no stage guard can ever change its behaviour. Building one map entry per
// rule here is deliberately NOT the same mistake the task brief warns
// against (a table suppressing every rule by pass): nothing downstream
// reads this registry to decide whether to suppress a rule. It exists
// solely so this test can demand a conscious answer, and the answer for
// most rules is "no guard needed," recorded in one line instead of left
// implicit.
// ===========================================================================

describe('Meta: every source-level export blocker has a recorded stage-scoping decision', () => {
  it('finds no block-severity rule id prefix in the four rule modules without an entry in NAVMC10132_STAGE_SCOPE_DECISIONS', () => {
    const libDir = join(__dirname, '..', 'src', 'lib');

    // Every block-severity rule id prefix found across the four modules,
    // as of this file's own last update, mapped to the scoping decision
    // made for it. A short tag, not free text, so a new prefix arriving
    // with no entry fails the lookup below in an obvious way rather than
    // matching some unrelated comment by accident.
    //
    //   GATED stage>=N   — the rule is stage-scoped in code; see its own
    //                       "STAGE-SCOPED" JSDoc paragraph and the
    //                       blocking/compliant proof in the "Stage
    //                       scoping" describe blocks above.
    //   EARLIEST-PASS     — an absence-type rule whose field is already
    //                       owned at pass 1, the earliest stage there is,
    //                       so no stage can ever be too early for it.
    //   NOT-ABSENCE        — the rule complains a field is WRONG, not
    //                       absent, so it is naturally silent while that
    //                       field is still empty and needs no stage guard.
    const NAVMC10132_STAGE_SCOPE_DECISIONS: Record<string, string> = {
      // --- navmc10132-validators-offenses.ts ---
      'navmc10132-offense-article-present': 'EARLIEST-PASS: item 1, pass 1 (V-01)',
      'navmc10132-offense-summary-present-': 'EARLIEST-PASS: item 1, pass 1 (V-02)',
      'navmc10132-offense-finding-requires-article-':
        'NOT-ABSENCE: fires on an inconsistent finding, not a missing one; the finding control itself is hidden pre-pass-3 (V-03)',
      'navmc10132-punishment-requires-guilty-finding':
        'NOT-ABSENCE: silent while punishmentImposed is empty, which it is pre-pass-3 (V-13)',

      // --- navmc10132-validators-dates.ts ---
      'navmc10132-v06-rights-cert-after-punishment':
        'NOT-ABSENCE: silent unless both dates parse, and both are pre-pass-3/pre-pass-2 fields (V-06)',
      'navmc10132-v07-appeal-advisement-before-punishment':
        'NOT-ABSENCE: silent unless both dates parse; appealAdvisementDate is a pass-4 field (V-07)',
      'navmc10132-v08-item13-both':
        'NOT-ABSENCE: fires only when BOTH item-13 controls are already set, which cannot happen before pass 6 either (V-08)',
      'navmc10132-v08-item13-neither': 'GATED stage>=6: item 13, pass 6 (V-08) — the D-43 defect',

      // --- navmc10132-validators-punishment.ts ---
      'navmc10132-v04-punishment-empty': 'GATED stage>=3: item 6, pass 3 (V-04) — the D-43 defect',
      'navmc10132-v05-suspension-empty': 'GATED stage>=3: item 7, pass 3 (V-05 empty branch)',
      'navmc10132-v05-suspension-index-':
        'NOT-ABSENCE: requires an existing suspensions[] entry, which is empty pre-pass-3 (V-05 addendum)',
      'navmc10132-v31-': 'NOT-ABSENCE: requires two existing suspensions[] entries (V-31)',
      'navmc10132-v32-vacation-partial-no-detail-':
        'NOT-ABSENCE: requires an existing vacations[] entry (V-32)',
      'navmc10132-v33-vacation-suspension-index-':
        'NOT-ABSENCE: requires an existing vacations[] entry (V-33)',
      'navmc10132-v34-vacation-remark-missing-':
        'NOT-ABSENCE: requires an existing vacations[] entry asserting a vacation happened (V-34)',
      'navmc10132-v14-unauthorized-': 'NOT-ABSENCE: requires an existing punishments[] entry (V-14)',
      'navmc10132-v15-item6-overflow':
        'NOT-ABSENCE: explicit early return when punishments[] is empty (V-15)',
      'navmc10132-v17-item7-overflow':
        'NOT-ABSENCE: explicit early return when suspensions[] is empty (V-17)',
      'navmc10132-w06-days-': 'NOT-ABSENCE: requires an existing punishments[] entry with a days value (W-06)',
      'navmc10132-w06-months-':
        'NOT-ABSENCE: requires an existing punishments[] entry with a months value (W-06)',
      'navmc10132-v19-correctional-custody-grade':
        'NOT-ABSENCE: requires an existing correctional-custody punishments[] entry (V-19)',
      'navmc10132-v20-ceiling-unreadable-':
        'NOT-ABSENCE: an unset punishmentDate reads as table-not-current, which is excluded from the surfaced reasons (V-20)',
      'navmc10132-v20-forfeiture-over-ceiling-':
        'NOT-ABSENCE: requires a computed ceiling, which requires a set punishmentDate (V-20)',
      'navmc10132-v21-': 'NOT-ABSENCE: requires existing punishments[] entries (V-21)',
      'navmc10132-v22-': 'NOT-ABSENCE: requires an existing suspensions[] entry (V-22)',
      'navmc10132-v29-vacation-offence-before-suspension-':
        'NOT-ABSENCE: requires an existing vacations[] entry with offenceDate set (V-29)',
      'navmc10132-v30-vacation-authority-insufficient-':
        'NOT-ABSENCE: requires an existing vacated-full vacations[] entry (V-30)',
      'navmc10132-v18-forfeiture-basis-unknown':
        'NOT-ABSENCE: requires an existing reduction AND forfeiture punishments[] entry (V-18)',
      'navmc10132-v18-forfeiture-basis-grade':
        'NOT-ABSENCE: requires an existing reduction AND forfeiture punishments[] entry (V-18)',

      // --- navmc10132-validators-identity.ts ---
      'navmc10132-v09-overflow-':
        'NOT-ABSENCE: explicit `if (value === "") continue` per field, only fires when too long, not absent (V-09)',
      'navmc10132-v10-accused-identity-incomplete': 'EARLIEST-PASS: items 18-20, pass 1 (V-10)',
      'navmc10132-v11-unit-blank': 'EARLIEST-PASS: item 17, pass 1 (V-11)',
      'navmc10132-v12-edipi-format-':
        'NOT-ABSENCE: only fires on a present-but-malformed EDIPI, skipped when empty (V-12)',
    };

    type BlockerRef = { file: string; idPrefix: string };
    const blockers: BlockerRef[] = [];

    for (const fileName of NAVMC10132_VALIDATOR_MODULES) {
      const src = readFileSync(join(libDir, fileName), 'utf-8');
      for (const idPrefix of extractBlockSeverityRuleIds(src)) {
        blockers.push({ file: fileName, idPrefix });
      }
    }

    // Sanity check on the scan itself, matching the house pattern the
    // first meta test already uses: if this finds nothing, the shared
    // scanner or the file list broke, and the rest of this test would
    // trivially pass for the wrong reason.
    expect(blockers.length).toBeGreaterThan(0);
    expect(Object.keys(NAVMC10132_STAGE_SCOPE_DECISIONS).length).toBeGreaterThan(0);

    // Verified by name: V-09 is exactly the case the shared scanner exists
    // to catch. If this ever stops finding it, the extractor regressed.
    expect(blockers.some((b) => b.idPrefix === 'navmc10132-v09-overflow-')).toBe(true);

    const seen = new Set<string>();
    const undecided: string[] = [];
    for (const { file, idPrefix } of blockers) {
      const key = `${file}:${idPrefix}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!(idPrefix in NAVMC10132_STAGE_SCOPE_DECISIONS)) {
        undecided.push(`${idPrefix}  (from ${file})`);
      }
    }

    expect(
      undecided,
      undecided.length
        ? `The following block-severity rule id prefix(es) have no recorded stage-scoping ` +
          `decision in NAVMC10132_STAGE_SCOPE_DECISIONS above. Before adding one, decide: ` +
          `does this rule complain that a field is ABSENT (not merely wrong)? If so, which ` +
          `pass first owns that field per docs/NAVMC_10132_SPEC.md section 13.1, and does ` +
          `the rule need a navmc10132StageAtLeast(navmc10132ExportGateStage(formData), N) ` +
          `guard before it fires? If the field is owned at pass 1, or the rule only ever ` +
          `fires once other, later-owned data already exists, record that reasoning as the ` +
          `decision instead. Either way, add an entry recording the decision, do not leave ` +
          `it undecided:\n  ` + undecided.join('\n  ')
        : undefined,
    ).toEqual([]);
  });
});

// ===========================================================================
// WHAT THE THIRD META TEST CANNOT CATCH, ON PURPOSE STATED HERE:
//   1. It cannot verify that a recorded decision is actually CORRECT. A
//      rule entered as NOT-ABSENCE that in fact does complain about an
//      absent, later-pass field would satisfy this test while still
//      carrying the D-43 defect. This test only forces the question to be
//      asked and answered in one place a reviewer can read; it does not
//      grade the answer. The three rules this delivery actually found
//      needing a guard are separately proven correct by the "Stage
//      scoping" describe blocks above, which exercise real
//      getExportBlockers output at real stage boundaries — that is a
//      different, stronger kind of proof than this test attempts.
//   2. It inherits the first meta test's limitation #2: a rule whose
//      issue(...) call is not literally shaped `issue(<id>, 'block', ...)`
//      in the source text, a severity chosen via a variable, a ternary, or
//      a differently-named local helper, would not match this scan's
//      regex and would silently not be counted as a blocker at all, so no
//      decision would ever be demanded for it.
//   3. It is scoped to the four rule modules named above. A block-severity
//      rule added to a fifth NAVMC 10132 validator module, or folded into
//      letter-validators.ts itself behind a `documentType === 'navmc10132'`
//      check, is invisible to this scan and would need this test widened
//      to reach it, the same way this test itself widened the first two
//      meta tests' three-file scope to four for identity.ts.
//   4. A prefix can drift out of NAVMC10132_STAGE_SCOPE_DECISIONS being
//      dead (the rule it named was deleted or renamed) without this test
//      noticing, since it only checks scanned-prefixes-are-a-subset-of-
//      registry-keys, never the reverse. A stale entry is inert, not
//      dangerous, so this is left unchecked rather than adding a second
//      failure mode to maintain.
// ===========================================================================
