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
    const blocking = baseForm({ punishments: [] });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v04-punishment-empty'))).toBe(
      true,
    );

    // One punishment entry added. Only `punishments` changes.
    const compliant = baseForm({ punishments: [{ code: 'N09', days: '14' }] });
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
    const blocking = baseForm({ suspension: '' });
    expect(getExportBlockers(blocking, [], [], []).some((i) => i.id.startsWith('navmc10132-v05-'))).toBe(true);

    // Only `suspension` changes, to the literal word the instruction asks for.
    const compliant = baseForm({ suspension: 'NONE' });
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
    // Only `appealDate` changes from the compliant baseline, cleared back
    // to the empty-field default instead of holding a date. Item 13 cannot
    // be left blank; the instruction requires an affirmative record either
    // way.
    const blocking = baseForm({ appealDate: '', notAppealed: false });
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
// META TEST — the real deliverable.
//
// Everything above proves eleven NAMED rules stop the export today. This
// test's job is different: it reads the validator source directly and
// fails when SOME rule, present or future, is marked severity 'block' in
// code but has no proof anywhere in the test suite that getExportBlockers
// actually stops it for that rule. Its purpose is to make the twelfth
// blocker, whenever it is written, arrive already gated instead of
// repeating the eleven-rule archaeology this file just did.
//
// WHAT IT SCANS. The three modules this file's brief named as the ones to
// read for rule behavior: navmc10132-validators-offenses.ts,
// -dates.ts and -punishment.ts. navmc10132-validators-identity.ts is
// DELIBERATELY EXCLUDED — none of the eleven rules this file covers come
// from it, it was out of scope for the reading list this file was built
// from, and it has its own pre-existing 'block' rules (V-10, V-11, and
// others) that this exercise never audited. Folding it in here would
// either fail this file for gaps nobody asked this file to close, or
// require an allowlist so broad it stops meaning anything. If identity.ts
// needs the same treatment, it earns its own pass, not a silent tuck-in
// here.
//
// HOW IT DECIDES A RULE IS A "BLOCKER". Every rule in these three modules
// builds its ValidationIssue through a same-shaped local `issue(id,
// severity, rule, citation, detail)` call. This scan looks for literal
// occurrences of that shape where the severity argument is the string
// 'block', and takes the id argument (up to the first `${` for a template
// id) as the rule's static id prefix — the part every id it ever emits at
// runtime is guaranteed to start with. This is a source-text pattern match,
// not a type-checked AST walk.
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
// empty array below is the expected steady state.
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
// ===========================================================================

describe('Meta: every source-level export blocker has a getExportBlockers-backed gate test', () => {
  it('finds no block-severity rule in the offense/date/punishment modules without a matching startsWith proof in tests/', () => {
    const libDir = join(__dirname, '..', 'src', 'lib');
    const testsDir = __dirname;

    // Deliberately by name, not a directory glob: see the identity.ts note
    // above for why navmc10132-validators-identity.ts is left out.
    const SCANNED_SOURCE_FILES = [
      'navmc10132-validators-offenses.ts',
      'navmc10132-validators-dates.ts',
      'navmc10132-validators-punishment.ts',
    ];

    // DELIBERATELY EMPTY. See the ALLOWLIST note above: this held two
    // genuinely unproven blockers (V-01, W-06) in an earlier pass and both
    // now have real gate tests instead. An entry here is a last resort for
    // a considered, out-of-scope exception, never a substitute for writing
    // the gate test — see the failure message below, which says so.
    const ALLOWLISTED_PREFIXES: string[] = [];

    type BlockerRef = { file: string; idPrefix: string };
    const blockers: BlockerRef[] = [];

    // Matches `issue(\n  '<id>',\n  'block',` (or "..." / `...`) in any of
    // the scanned files' own local issue() helper calls. Captures the id
    // literal, template placeholders included.
    const ISSUE_BLOCK_RE = /issue\(\s*[`'"]([^`'"]+)[`'"]\s*,\s*['"]block['"]/g;

    for (const fileName of SCANNED_SOURCE_FILES) {
      const src = readFileSync(join(libDir, fileName), 'utf-8');
      let match: RegExpExecArray | null;
      ISSUE_BLOCK_RE.lastIndex = 0;
      while ((match = ISSUE_BLOCK_RE.exec(src)) !== null) {
        const rawId = match[1];
        const templateStart = rawId.indexOf('${');
        const idPrefix = templateStart === -1 ? rawId : rawId.slice(0, templateStart);
        blockers.push({ file: fileName, idPrefix });
      }
    }

    // Sanity check on the scan itself: if this finds nothing, the regex or
    // the file list broke, and the rest of this test would trivially pass
    // for the wrong reason (nothing to check). Fail loudly instead.
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
//     three files rather than proven safe against arbitrary future code.
//   - Scoped to the same three modules as the first meta test, for the
//     same reason (see the identity.ts note above); a rule in
//     navmc10132-validators-identity.ts is outside what this file covers.
// ===========================================================================

describe('Meta: a JSDoc-documented blocker rule must actually emit severity block', () => {
  it('flags a rule whose JSDoc affirmatively calls it a blocker but whose code never emits block', () => {
    const libDir = join(__dirname, '..', 'src', 'lib');
    const SCANNED_SOURCE_FILES = [
      'navmc10132-validators-offenses.ts',
      'navmc10132-validators-dates.ts',
      'navmc10132-validators-punishment.ts',
    ];

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
     * regex literals. Verified safe for these three files by hand — the
     * only in-body brace pairs besides each function's own block are
     * self-balanced `${expr}` template interpolations (one open, one
     * close each) and single `(x as { a?: T })` inline casts, none of
     * which straddle a function boundary in the current source. A future
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
