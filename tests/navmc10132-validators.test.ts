// Vitest suite for the NAVMC 10132 validators, Phase 4 of
// docs/NAVMC_10132_BUILD_PLAN.md.
//
// Covers the aggregate entry point in navmc10132-validators.ts and its four
// children, navmc10132-validators-offenses.ts, -dates.ts, -punishment.ts and
// -identity.ts. Rule labels (V-01 through V-16, W-01 through W-16) are the
// ones documented in each module's own JSDoc and in
// docs/NAVMC_10132_SPEC.md section 6. Every rule gets one case that trips it
// and one that does not, so a passing suite proves each rule is scoped
// correctly, not just that it can fire at all.
//
// Assertions target the issue's id and severity, not its message text.
// Message wording can change without the rule's identity changing.

import { describe, it, expect } from 'vitest';
import type { FormData } from '@/types';
import {
  createEmptyNavmc10132Data,
  NAVMC_10132_DEMAND,
  type Navmc10132Offense,
  type Navmc10132Victim,
} from '@/types/navmc';
import { composeRemarks } from '@/lib/navmc10132-utils';

import { runNavmc10132Validators } from '@/lib/navmc10132-validators';
import { getExportBlockers } from '@/lib/letter-validators';

import {
  offenseArticlePresent,
  offenseSummaryPresent,
  offenseFindingRequiresArticle,
  punishmentRequiresGuiltyFinding,
  offenseOrdinarilyNotMinor,
  item4WithoutArticle85Or86,
  article85Or86WithoutItem4,
  victimsWithoutVictimOffense,
  offenseIssues,
} from '@/lib/navmc10132-validators-offenses';

import {
  v06RightsCertificationNotAfterPunishment,
  v07AppealAdvisementNotBeforePunishment,
  v08AppealDateExclusiveOfNotAppealed,
  w09StaleOffenseDate,
  w11DemandOrRefusalWithPunishment,
  dateIssues,
} from '@/lib/navmc10132-validators-dates';

import {
  punishmentPresenceIssues,
  suspensionTermsIssues,
  suspensionIndexBoundsIssues,
  suspensionDuplicateTargetIssues,
  punishmentAuthorizationIssues,
  punishmentFieldCapacityIssues,
  appealDecisionIncreaseIssues,
  punishmentAuthorityGradeIssues,
  punishmentParameterCeilingIssues,
  forfeitureWholeDollarIssues,
  reductionPayGradeIssues,
  forfeitureReducedGradeIssues,
  punishmentIssues,
} from '@/lib/navmc10132-validators-punishment';

import {
  checkFieldCapacities,
  checkAccusedIdentity,
  checkUnitEchelon,
  checkEdipiFormat,
  checkVictimPii,
  checkAppealReviewThreshold,
  checkRemarkFormats,
  checkDuplicateOffenses,
  checkIncidentGrouping,
  checkUsDerivedCourt,
  identityIssues,
} from '@/lib/navmc10132-validators-identity';

// ---------------------------------------------------------------------------
// Fixture helpers
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

function victimRow(overrides: Partial<Navmc10132Victim> = {}): Navmc10132Victim {
  return { status: '', sex: '', race: '', ethnicity: '', ...overrides };
}

/** Finds the one issue whose id matches, or fails the test with a clear message. */
function findIssue(issues: { id: string }[], idPrefix: string) {
  const found = issues.find((i) => i.id.startsWith(idPrefix));
  if (!found) {
    throw new Error(
      `Expected an issue with id starting "${idPrefix}", got: ${issues.map((i) => i.id).join(', ') || '(none)'}`
    );
  }
  return found;
}

// ---------------------------------------------------------------------------
// Offense and finding validators (navmc10132-validators-offenses.ts)
// V-01, V-02, V-03, V-13, W-01, W-02, W-03, W-12
// ---------------------------------------------------------------------------

describe('V-01, no offense row has an article', () => {
  it('trips when every offense row is empty', () => {
    const form = baseForm({ offenses: offensesWith() });
    const issues = offenseArticlePresent(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-offense-article-present');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip when one offense row has an article', () => {
    const form = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave' }),
    });
    expect(offenseArticlePresent(form)).toEqual([]);
  });
});

describe('V-02, a row with an article must also have a summary', () => {
  it('trips on row A when it has an article and no summary', () => {
    const form = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave', summary: '' }),
    });
    const issues = offenseSummaryPresent(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-offense-summary-present-A');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip when the row with an article also has a summary', () => {
    const form = baseForm({
      offenses: offensesWith({
        articleLabel: 'Art. 86  Absence without leave',
        summary: 'Failed to report for the 0600 formation.',
      }),
    });
    expect(offenseSummaryPresent(form)).toEqual([]);
  });
});

describe('V-03, a finding requires an article on the same row', () => {
  it('trips on row A when it has a finding and no article', () => {
    const form = baseForm({
      offenses: offensesWith({ articleLabel: '', finding: 'Guilty' }),
    });
    const issues = offenseFindingRequiresArticle(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-offense-finding-requires-article-A');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip when the finding row also has an article', () => {
    const form = baseForm({
      offenses: offensesWith({
        articleLabel: 'Art. 86  Absence without leave',
        finding: 'Guilty',
      }),
    });
    expect(offenseFindingRequiresArticle(form)).toEqual([]);
  });
});

describe('V-13, item 6 punishment requires a Guilty finding', () => {
  it('trips when item 6 is populated and no row is marked Guilty', () => {
    const form = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave', finding: 'Not Guilty' }),
      punishmentImposed: 'Restr to the limits of HQSVCCo for 14 days.',
    });
    const issues = punishmentRequiresGuiltyFinding(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-punishment-requires-guilty-finding');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip when a row is marked Guilty', () => {
    const form = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave', finding: 'Guilty' }),
      punishmentImposed: 'Restr to the limits of HQSVCCo for 14 days.',
    });
    expect(punishmentRequiresGuiltyFinding(form)).toEqual([]);
  });

  it('does not trip when item 6 starts with None, even with no Guilty row', () => {
    const form = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave', finding: 'Not Guilty' }),
      punishmentImposed: 'None imposed, case dismissed.',
    });
    expect(punishmentRequiresGuiltyFinding(form)).toEqual([]);
  });
});

describe('W-01, an offense is ordinarily not a minor offense', () => {
  it('trips on an offense the article table marks notOrdinarilyMinor', () => {
    const form = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 94  Mutiny or sedition' }),
    });
    const issues = offenseOrdinarilyNotMinor(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-offense-not-minor-A');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip on an offense the article table marks minor', () => {
    const form = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 80  Attempts' }),
    });
    expect(offenseOrdinarilyNotMinor(form)).toEqual([]);
  });
});

describe('W-02, item 4 populated without an Article 85 or 86 offense', () => {
  it('trips when item 4 has text and no 85 or 86 offense is selected', () => {
    const form = baseForm({
      unauthorizedAbsences: 'UA from 0600 to 1800, 5 Jan 26.',
      offenses: offensesWith({ articleLabel: 'Art. 89  Disrespect of sup. comm. officer' }),
    });
    const issues = item4WithoutArticle85Or86(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-item4-without-article-85-86');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip when an 85 or 86 offense is selected', () => {
    const form = baseForm({
      unauthorizedAbsences: 'UA from 0600 to 1800, 5 Jan 26.',
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave' }),
    });
    expect(item4WithoutArticle85Or86(form)).toEqual([]);
  });

  it('does not trip when item 4 is empty', () => {
    const form = baseForm({
      unauthorizedAbsences: '',
      offenses: offensesWith({ articleLabel: 'Art. 89  Disrespect of sup. comm. officer' }),
    });
    expect(item4WithoutArticle85Or86(form)).toEqual([]);
  });
});

describe('W-03, an Article 85 or 86 offense selected without item 4', () => {
  it('trips when an 85 or 86 offense is selected and item 4 is empty', () => {
    const form = baseForm({
      unauthorizedAbsences: '',
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave' }),
    });
    const issues = article85Or86WithoutItem4(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-article-85-86-without-item4');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip when item 4 is populated', () => {
    const form = baseForm({
      unauthorizedAbsences: 'UA from 0600 to 1800, 5 Jan 26.',
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave' }),
    });
    expect(article85Or86WithoutItem4(form)).toEqual([]);
  });
});

describe('W-12, a victim-clear offense with no item 22 victim recorded', () => {
  it('trips when a victim-clear offense is selected and every victim row is fully empty', () => {
    const form = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 93  Cruelty and maltreatment' }),
      victims: [victimRow(), victimRow(), victimRow(), victimRow(), victimRow()],
    });
    const issues = victimsWithoutVictimOffense(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-victims-without-victim-offense');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip when no selected offense is on the victim-clear list', () => {
    const form = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave' }),
      victims: [victimRow(), victimRow(), victimRow(), victimRow(), victimRow()],
    });
    expect(victimsWithoutVictimOffense(form)).toEqual([]);
  });

  // W-12 INVERSION. The build notes call this out by name: the check for
  // "is there a victim recorded" is `victims.some(row => any field on that
  // row is non-empty)`, not a check that a row is fully filled out. So a
  // PARTIALLY filled victim row, incomplete data, reads as "a victim is
  // recorded" and the warning stays silent rather than firing a false
  // positive on data that is merely unfinished. This is documented and, on
  // its own terms, the safer direction: the JSDoc on
  // victimsWithoutVictimOffense says a missed prompt costs nothing worse
  // than the preparer not being reminded, while this rule was never meant
  // to accuse anyone of a wrong entry. Confirmed correct as implemented.
  it('does not trip when the victim row is only partially filled in, incomplete data does not false-positive', () => {
    const form = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 93  Cruelty and maltreatment' }),
      victims: [
        victimRow({ sex: 'Male' }), // status, race, ethnicity all still blank
        victimRow(),
        victimRow(),
        victimRow(),
        victimRow(),
      ],
    });
    expect(victimsWithoutVictimOffense(form)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Date-family validators (navmc10132-validators-dates.ts)
// V-06, V-07, V-08, W-09, W-11
// ---------------------------------------------------------------------------

describe('V-06, item 3 rights certification must not follow item 6 punishment', () => {
  it('trips when the rights certification date is after the punishment date', () => {
    const form = baseForm({ rightsAttestDate: '2026-01-05', punishmentDate: '2026-01-01' });
    const issues = v06RightsCertificationNotAfterPunishment(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v06-rights-cert-after-punishment');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip on an equal date, same-day certification and imposition is normal', () => {
    const form = baseForm({ rightsAttestDate: '2026-01-01', punishmentDate: '2026-01-01' });
    expect(v06RightsCertificationNotAfterPunishment(form)).toEqual([]);
  });
});

describe('V-07, item 11 appeal advisement must not precede item 6 punishment', () => {
  it('trips when the advisement date is before the punishment date', () => {
    const form = baseForm({ appealAdvisementDate: '2026-01-05', punishmentDate: '2026-01-10' });
    const issues = v07AppealAdvisementNotBeforePunishment(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v07-appeal-advisement-before-punishment');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip on an equal date, same-day advisement is normal', () => {
    const form = baseForm({ appealAdvisementDate: '2026-01-10', punishmentDate: '2026-01-10' });
    expect(v07AppealAdvisementNotBeforePunishment(form)).toEqual([]);
  });
});

describe('V-08, item 13 is a date XOR the Not Appealed checkbox', () => {
  it('trips with both an appeal date and Not Appealed set', () => {
    const form = baseForm({ appealDate: '2026-01-01', notAppealed: true });
    const issues = v08AppealDateExclusiveOfNotAppealed(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v08-item13-both');
    expect(issues[0].severity).toBe('block');
  });

  it('trips with neither an appeal date nor Not Appealed set', () => {
    // stage: 6 — item 13 is a pass-6 field (D-43, D-46, spec section 13.1);
    // the "-neither" branch is stage-scoped and stays silent before pass 6,
    // so this fixture has to be AT pass 6 to prove the rule still trips
    // once the document has actually reached it. See the export-gate stage
    // tests (tests/navmc10132-export-gate.test.ts) for the pass-1 case
    // proving this same rule stays SILENT on a fresh document.
    const form = baseForm({ appealDate: '', notAppealed: false, stage: 6 });
    const issues = v08AppealDateExclusiveOfNotAppealed(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v08-item13-neither');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip with only the appeal date set', () => {
    const form = baseForm({ appealDate: '2026-01-01', notAppealed: false });
    expect(v08AppealDateExclusiveOfNotAppealed(form)).toEqual([]);
  });

  it('does not trip with only Not Appealed set', () => {
    const form = baseForm({ appealDate: '', notAppealed: true });
    expect(v08AppealDateExclusiveOfNotAppealed(form)).toEqual([]);
  });
});

describe('W-09, an offense date mined from item 1 text is more than two years stale', () => {
  it('trips when the summary names a single date more than two years before item 6', () => {
    const form = baseForm({
      punishmentDate: '2026-08-24',
      offenses: offensesWith({
        articleLabel: 'Art. 86  Absence without leave',
        summary: 'Failed to report as ordered on 2020-01-01.',
      }),
    });
    const issues = w09StaleOffenseDate(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-w09-stale-offense-row-1');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip when the summary date is within the two year window', () => {
    const form = baseForm({
      punishmentDate: '2026-08-24',
      offenses: offensesWith({
        articleLabel: 'Art. 86  Absence without leave',
        summary: 'Failed to report as ordered on 2026-06-01.',
      }),
    });
    expect(w09StaleOffenseDate(form)).toEqual([]);
  });

  it('does not trip when the summary has two distinct dates, the row is left silent as ambiguous', () => {
    const form = baseForm({
      punishmentDate: '2026-08-24',
      offenses: offensesWith({
        articleLabel: 'Art. 86  Absence without leave',
        summary: 'UA from 2020-01-01 to 2020-01-05.',
      }),
    });
    expect(w09StaleOffenseDate(form)).toEqual([]);
  });
});

describe('W-11, item 2 shows a demand or refusal alongside item 6 punishment', () => {
  it('trips when the accused demands trial and item 6 carries punishment', () => {
    const form = baseForm({
      demand: NAVMC_10132_DEMAND.REFUSE,
      punishments: [{ code: 'N16', oralOrWritten: 'orally' }],
    });
    const issues = w11DemandOrRefusalWithPunishment(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-w11-demand-with-punishment');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip when the accused accepted and item 6 carries punishment', () => {
    const form = baseForm({
      demand: NAVMC_10132_DEMAND.ACCEPT,
      punishments: [{ code: 'N16', oralOrWritten: 'orally' }],
    });
    expect(w11DemandOrRefusalWithPunishment(form)).toEqual([]);
  });

  it('does not trip when the accused demands trial but item 6 carries no punishment', () => {
    const form = baseForm({ demand: NAVMC_10132_DEMAND.REFUSE, punishments: [] });
    expect(w11DemandOrRefusalWithPunishment(form)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Punishment validators (navmc10132-validators-punishment.ts)
// V-04, V-05, V-14, V-15, V-16, W-05, W-06, W-07, W-08
// ---------------------------------------------------------------------------

describe('V-04, item 6 punishment must not be empty', () => {
  it('trips when there are no punishment entries', () => {
    // stage: 3 — item 6 is a pass-3 field (D-43, D-46, spec section 13.1);
    // this rule is stage-scoped and stays silent before pass 3, so the
    // fixture has to be AT pass 3 to prove it still trips once the
    // document has reached the field it is checking. See the export-gate
    // stage tests (tests/navmc10132-export-gate.test.ts) for the pass-1
    // case proving this same rule stays SILENT on a fresh document.
    const form = baseForm({ punishments: [], stage: 3 });
    const issues = punishmentPresenceIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v04-punishment-empty');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip when at least one punishment entry is present', () => {
    const form = baseForm({ punishments: [{ code: 'N16', oralOrWritten: 'orally' }] });
    expect(punishmentPresenceIssues(form)).toEqual([]);
  });
});

describe('V-05, item 7 suspension must be NONE or a specific suspension with terms', () => {
  // The other half of the same rule: no punishment, no complaint about the
  // suspension of one.
  it('stays silent on an empty item 7 while item 6 is empty', () => {
    const form = baseForm({ suspension: '', stage: 3, punishments: [] });
    expect(suspensionTermsIssues(form)).toEqual([]);
  });

  it('trips block when item 7 is empty', () => {
    // stage: 3 — item 7 is a pass-3 field (D-43, D-46, spec section 13.1),
    // the same pass as item 6. The empty-item-7 branch is stage-scoped and
    // stays silent before pass 3, so the fixture has to be AT pass 3 to
    // prove it still trips once the document has reached the field. See
    // the export-gate stage tests (tests/navmc10132-export-gate.test.ts)
    // for the pass-1 case proving this same branch stays SILENT on a
    // fresh document.
    //
    // A PUNISHMENT IS PART OF THE FIXTURE NOW, from 2026-08-26. V-05's empty
    // branch is silent while item 6 is empty: it told the clerk to "Enter
    // the literal word NONE", which on a document with nothing imposed
    // instructs the exact predetermination Stephen ruled out, and it fired
    // beside the empty-item-6 blocker, stating one fact twice. Its real
    // subject is a punishment imposed with item 7 left blank.
    const form = baseForm({
      suspension: '',
      stage: 3,
      punishments: [{ code: 'N09', days: '10' }],
    });
    const issues = suspensionTermsIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v05-suspension-empty');
    expect(issues[0].severity).toBe('block');
  });

  it('trips warn when item 7 is non-empty and too short to state terms', () => {
    const form = baseForm({ suspension: 'Susp 10d' });
    const issues = suspensionTermsIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v05-suspension-short');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip when item 7 is the literal word NONE', () => {
    const form = baseForm({ suspension: 'NONE' });
    expect(suspensionTermsIssues(form)).toEqual([]);
  });

  it('does not trip when item 7 states a suspension long enough to hold real terms', () => {
    const form = baseForm({
      suspension:
        'Restr suspended for 90 days, automatically remitted if not sooner vacated.',
    });
    expect(suspensionTermsIssues(form)).toEqual([]);
  });
});

describe('V-05 addendum, a structured suspension must name a punishment imposed in item 6', () => {
  it('trips block when punishmentIndex points past the end of punishments', () => {
    const form = baseForm({
      punishments: [{ code: 'N09', days: '10' }],
      suspensions: [{ punishmentIndex: 1, months: '6' }],
    });
    const issues = suspensionIndexBoundsIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v05-suspension-index-0');
    expect(issues[0].severity).toBe('block');
  });

  it('trips block when punishmentIndex is negative', () => {
    const form = baseForm({
      punishments: [{ code: 'N09', days: '10' }],
      suspensions: [{ punishmentIndex: -1, months: '6' }],
    });
    const issues = suspensionIndexBoundsIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip when every suspension names an index within punishments', () => {
    const form = baseForm({
      punishments: [{ code: 'N09', days: '10' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
    });
    expect(suspensionIndexBoundsIssues(form)).toEqual([]);
  });

  it('does not trip when there are no suspensions', () => {
    const form = baseForm({ punishments: [{ code: 'N09', days: '10' }], suspensions: [] });
    expect(suspensionIndexBoundsIssues(form)).toEqual([]);
  });
});

describe('V-31, only one suspension may target a given item 6 punishment', () => {
  it('trips block on both entries when two suspensions share a punishmentIndex', () => {
    const form = baseForm({
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [
        { punishmentIndex: 0, months: '6' },
        { punishmentIndex: 0, months: '3' },
      ],
    });
    const issues = suspensionDuplicateTargetIssues(form);
    expect(issues).toHaveLength(2);
    expect(issues.every((i) => i.severity === 'block')).toBe(true);
    expect(issues.every((i) => i.id.startsWith('navmc10132-v31-'))).toBe(true);
  });

  it('keys the id on each duplicate entry\'s OWN position, so two duplicates get DIFFERENT ids', () => {
    const form = baseForm({
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [
        { punishmentIndex: 0, months: '6' },
        { punishmentIndex: 0, months: '3' },
      ],
    });
    const issues = suspensionDuplicateTargetIssues(form);
    expect(issues.map((i) => i.id)).toEqual(['navmc10132-v31-0', 'navmc10132-v31-1']);
    // Different ids, not merely different array entries with the same id.
    expect(new Set(issues.map((i) => i.id)).size).toBe(2);
  });

  it('does not trip when every suspension targets a distinct punishmentIndex', () => {
    const form = baseForm({
      punishments: [{ code: 'N09', days: '14' }, { code: 'N16', oralOrWritten: 'orally' }],
      suspensions: [
        { punishmentIndex: 0, months: '6' },
        { punishmentIndex: 1, months: '3' },
      ],
    });
    expect(suspensionDuplicateTargetIssues(form)).toEqual([]);
  });

  it('does not trip on an empty suspensions array', () => {
    const form = baseForm({ punishments: [{ code: 'N09', days: '14' }], suspensions: [] });
    expect(suspensionDuplicateTargetIssues(form)).toEqual([]);
  });

  it('does not trip on a single-entry suspensions array', () => {
    const form = baseForm({
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
    });
    expect(suspensionDuplicateTargetIssues(form)).toEqual([]);
  });

  it('stays silent on a shared out-of-bounds punishmentIndex, leaving that to V-05', () => {
    // Both entries name index 5, which is out of bounds (only index 0
    // exists). suspensionIndexBoundsIssues (V-05) owns flagging an
    // out-of-bounds index; this rule must not also fire on it, even though
    // the two entries technically "share" the same bad index.
    const form = baseForm({
      punishments: [{ code: 'N09', days: '14' }],
      suspensions: [
        { punishmentIndex: 5, months: '6' },
        { punishmentIndex: 5, months: '3' },
      ],
    });
    expect(suspensionDuplicateTargetIssues(form)).toEqual([]);
    // Confirm V-05 is the one actually catching the bad index, so this
    // fixture is proven to trip *something*, not silently miscoded.
    const boundsIssues = suspensionIndexBoundsIssues(form);
    expect(boundsIssues).toHaveLength(2);
    expect(boundsIssues.every((i) => i.severity === 'block')).toBe(true);
  });
});

describe('V-14, a selected punishment code must be authorized for release one', () => {
  it('trips on an officer-only code, N01, which release one does not offer', () => {
    const form = baseForm({ punishments: [{ code: 'N01', days: '14', suspendedFromDuty: true }] });
    const issues = punishmentAuthorizationIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toContain('navmc10132-v14-unauthorized-N01');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip on N06, correctional custody, which release one does offer', () => {
    const form = baseForm({ punishments: [{ code: 'N06', days: '7', suspendedFromDuty: false }] });
    expect(punishmentAuthorizationIssues(form)).toEqual([]);
  });
});

describe('V-15, rendered item 6 text must fit the PUNISHMENT IMPOSED field', () => {
  it('trips when the rendered text overflows and item 21 overflow routing is not set', () => {
    const form = baseForm({
      punishments: [{ code: 'N11', limits: 'A'.repeat(150), days: '14' }],
    });
    const issues = punishmentFieldCapacityIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v15-item6-overflow');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip the same overflowing text when routed to item 21 as Supplemental Page', () => {
    const form = baseForm({
      punishments: [{ code: 'N11', limits: 'A'.repeat(150), days: '14' }],
      punishmentOverflowToItem21: true,
    });
    expect(punishmentFieldCapacityIssues(form)).toEqual([]);
  });

  it('does not trip a short punishment that fits the field', () => {
    const form = baseForm({ punishments: [{ code: 'N16', oralOrWritten: 'orally' }] });
    expect(punishmentFieldCapacityIssues(form)).toEqual([]);
  });
});

describe('V-16, item 14 appeal decision text suggestive of an increase, downgraded to warn', () => {
  it('trips warn, not block, on language suggestive of an increase', () => {
    const form = baseForm({
      appealDecision: 'The reviewing authority increased the punishment on appeal.',
    });
    const issues = appealDecisionIncreaseIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v16-appeal-possible-increase');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip on an ordinary appeal decision with no increase language', () => {
    const form = baseForm({ appealDecision: 'Appeal denied, punishment affirmed.' });
    expect(appealDecisionIncreaseIssues(form)).toEqual([]);
  });
});

describe('W-05, item 8A authority must satisfy the selected code required grade', () => {
  it('trips unknown when item 8A is unset and the code needs field grade', () => {
    const form = baseForm({
      njpAuthorityPayGrade: '',
      punishments: [{ code: 'N04', dollarsPerMonth: '100', months: '2' }],
    });
    const issues = punishmentAuthorityGradeIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toContain('navmc10132-w05-authority-unknown-N04');
    expect(issues[0].severity).toBe('warn');
  });

  it('trips insufficient when item 8A is below the required grade', () => {
    const form = baseForm({
      njpAuthorityPayGrade: 'O3',
      punishments: [{ code: 'N04', dollarsPerMonth: '100', months: '2' }],
    });
    const issues = punishmentAuthorityGradeIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toContain('navmc10132-w05-authority-insufficient-N04');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip when item 8A meets the required field grade', () => {
    const form = baseForm({
      njpAuthorityPayGrade: 'O5',
      punishments: [{ code: 'N04', dollarsPerMonth: '100', months: '2' }],
    });
    expect(punishmentAuthorityGradeIssues(form)).toEqual([]);
  });

  it('does not trip on a code that only requires any authority', () => {
    const form = baseForm({
      njpAuthorityPayGrade: '',
      punishments: [{ code: 'N06', days: '7', suspendedFromDuty: false }],
    });
    expect(punishmentAuthorityGradeIssues(form)).toEqual([]);
  });
});

describe('W-06, an entered days or months value exceeds the code own ceiling', () => {
  it('trips block on days above N06 own 7 day ceiling', () => {
    const form = baseForm({ punishments: [{ code: 'N06', days: '10', suspendedFromDuty: false }] });
    const issues = punishmentParameterCeilingIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toContain('navmc10132-w06-days-N06');
    expect(issues[0].severity).toBe('block');
  });

  it('trips block on months above N04 own 2 month ceiling', () => {
    const form = baseForm({ punishments: [{ code: 'N04', dollarsPerMonth: '100', months: '3' }] });
    const issues = punishmentParameterCeilingIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toContain('navmc10132-w06-months-N04');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip when days is at or under the code own ceiling', () => {
    const form = baseForm({ punishments: [{ code: 'N06', days: '7', suspendedFromDuty: false }] });
    expect(punishmentParameterCeilingIssues(form)).toEqual([]);
  });

  it('does not trip when months is at or under the code own ceiling', () => {
    const form = baseForm({ punishments: [{ code: 'N04', dollarsPerMonth: '100', months: '2' }] });
    expect(punishmentParameterCeilingIssues(form)).toEqual([]);
  });
});

describe('W-07, a forfeiture amount must be whole dollars', () => {
  it('trips on a fractional dollars amount', () => {
    const form = baseForm({ punishments: [{ code: 'N07', dollars: '50.5' }] });
    const issues = forfeitureWholeDollarIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toContain('navmc10132-w07-dollars-N07');
    expect(issues[0].severity).toBe('warn');
  });

  it('trips on a fractional dollarsPerMonth amount', () => {
    const form = baseForm({ punishments: [{ code: 'N04', dollarsPerMonth: '100.25', months: '2' }] });
    const issues = forfeitureWholeDollarIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toContain('navmc10132-w07-dollarsPerMonth-N04');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip on whole dollar amounts', () => {
    const form = baseForm({ punishments: [{ code: 'N07', dollars: '50' }] });
    expect(forfeitureWholeDollarIssues(form)).toEqual([]);
  });
});

describe('W-08, a reduction imposed on an E-6 or above accused', () => {
  it('trips when the accused is E-6 and a reduction code is selected', () => {
    const form = baseForm({
      accusedPayGrade: 'E6',
      punishments: [{ code: 'N08', gradeReducedTo: 'E5' }],
    });
    const issues = reductionPayGradeIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-w08-reduction-e6-plus');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip when the accused is below E-6', () => {
    const form = baseForm({
      accusedPayGrade: 'E5',
      punishments: [{ code: 'N08', gradeReducedTo: 'E4' }],
    });
    expect(reductionPayGradeIssues(form)).toEqual([]);
  });

  it('does not trip when the accused is E-6 but no reduction code is selected', () => {
    const form = baseForm({
      accusedPayGrade: 'E6',
      punishments: [{ code: 'N16', oralOrWritten: 'orally' }],
    });
    expect(reductionPayGradeIssues(form)).toEqual([]);
  });

  // MCO 5800.16 Vol 14 para 010302.C sets TWO floors, not one: E-6 for
  // Marines (USMC), E-7 for Sailors (USN). This is the fix for the bug that
  // tested a single hardcoded E-6 floor for both services.
  describe('service-aware floors', () => {
    it('a USMC E-6 with a reduction still trips, and names the Marine E-6 floor', () => {
      const form = baseForm({
        accusedService: 'USMC',
        accusedPayGrade: 'E6',
        punishments: [{ code: 'N08', gradeReducedTo: 'E5' }],
      });
      const issues = reductionPayGradeIssues(form);
      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('navmc10132-w08-reduction-e6-plus');
      expect(issues[0].detail).toContain('Marines');
      expect(issues[0].detail).toContain('E-6');
    });

    it('the SAME punishment set does not trip for a USN E-6: a Sailor E-6 may lawfully be reduced', () => {
      const form = baseForm({
        accusedService: 'USN',
        accusedPayGrade: 'E6',
        punishments: [{ code: 'N08', gradeReducedTo: 'E5' }],
      });
      expect(reductionPayGradeIssues(form)).toEqual([]);
    });

    it('a USN E-7 with a reduction trips, and names the Sailor E-7 floor', () => {
      const form = baseForm({
        accusedService: 'USN',
        accusedPayGrade: 'E7',
        punishments: [{ code: 'N08', gradeReducedTo: 'E6' }],
      });
      const issues = reductionPayGradeIssues(form);
      expect(issues).toHaveLength(1);
      expect(issues[0].id).toBe('navmc10132-w08-reduction-e6-plus');
      expect(issues[0].detail).toContain('Sailors');
      expect(issues[0].detail).toContain('E-7');
    });
  });
});

describe('V-18 (BLOCKING), forfeiture must be based on the grade to which reduced', () => {
  // MCM Part V para 5.c(8), verbatim: "If the punishment includes both
  // reduction, whether or not suspended, and forfeiture of pay, the
  // forfeiture must be based on the grade to which reduced."

  it('no issue when only a forfeiture is imposed, no reduction present', () => {
    const form = baseForm({
      punishments: [{ code: 'N07', dollars: '50' }],
    });
    expect(forfeitureReducedGradeIssues(form)).toEqual([]);
  });

  it('no issue when only a reduction is imposed, no forfeiture present', () => {
    const form = baseForm({
      punishments: [{ code: 'N08', gradeReducedTo: 'LCpl' }],
    });
    expect(forfeitureReducedGradeIssues(form)).toEqual([]);
  });

  it('both present, reduction names no target grade: fails as basis-unknown', () => {
    const form = baseForm({
      punishments: [
        { code: 'N08', gradeReducedTo: '' },
        { code: 'N07', dollars: '50' },
      ],
    });
    const issues = forfeitureReducedGradeIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v18-forfeiture-basis-unknown');
    expect(issues[0].severity).toBe('block');
  });

  it('both present, gradeReducedTo LCpl (E3), forfeitureBasisGrade unset: fails as basis-grade', () => {
    const form = baseForm({
      punishments: [
        { code: 'N08', gradeReducedTo: 'LCpl' },
        { code: 'N07', dollars: '50' },
      ],
    });
    const issues = forfeitureReducedGradeIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v18-forfeiture-basis-grade');
    expect(issues[0].severity).toBe('block');
  });

  it('both present, forfeitureBasisGrade recorded as the PRE-reduction grade E4: fails, and names both E4 and E3', () => {
    const form = baseForm({
      punishments: [
        { code: 'N08', gradeReducedTo: 'LCpl' },
        { code: 'N07', dollars: '50' },
      ],
      forfeitureBasisGrade: 'E4',
    });
    const issues = forfeitureReducedGradeIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v18-forfeiture-basis-grade');
    expect(issues[0].severity).toBe('block');
    expect(issues[0].rule).toContain('E4');
    expect(issues[0].rule).toContain('E3');
  });

  it('both present, forfeitureBasisGrade recorded as the reduced grade E3: no issue', () => {
    const form = baseForm({
      punishments: [
        { code: 'N08', gradeReducedTo: 'LCpl' },
        { code: 'N07', dollars: '50' },
      ],
      forfeitureBasisGrade: 'E3',
    });
    expect(forfeitureReducedGradeIssues(form)).toEqual([]);
  });

  it('normalizes dashes and case: forfeitureBasisGrade "e-3" also passes', () => {
    const form = baseForm({
      punishments: [
        { code: 'N08', gradeReducedTo: 'LCpl' },
        { code: 'N07', dollars: '50' },
      ],
      forfeitureBasisGrade: 'e-3',
    });
    expect(forfeitureReducedGradeIssues(form)).toEqual([]);
  });

  // The whole point of the rule: "whether or not suspended." The usual
  // intuition, that a suspended reduction did not happen so the forfeiture
  // may be based on the old grade, is exactly backwards.
  it('a SUSPENDED reduction still requires the forfeiture basis to be the reduced grade', () => {
    const form = baseForm({
      punishments: [
        { code: 'N08', gradeReducedTo: 'LCpl' },
        { code: 'N07', dollars: '50' },
      ],
      suspensions: [{ punishmentIndex: 0, months: '6' }],
      forfeitureBasisGrade: 'E4', // the pre-reduction grade, wrongly used as basis
    });
    const issues = forfeitureReducedGradeIssues(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v18-forfeiture-basis-grade');
    expect(issues[0].severity).toBe('block');
  });

  it('is wired into punishmentIssues, the aggregate export', () => {
    const form = baseForm({
      punishments: [
        { code: 'N08', gradeReducedTo: 'LCpl' },
        { code: 'N07', dollars: '50' },
      ],
      forfeitureBasisGrade: 'E4',
    });
    const issues = punishmentIssues(form);
    expect(issues.some((i) => i.id === 'navmc10132-v18-forfeiture-basis-grade')).toBe(true);
  });

  it("V-18 stops the export, not merely the compliance list: a 'fail' severity renders as Non-compliant and lets the export through", () => {
    // Reduction plus forfeiture, forfeiture basis recorded at the
    // PRE-reduction grade: unlawful under MCM Part V para 5.c(8).
    // getExportBlockers runs the FULL validator suite (proving
    // runNavmc10132Validators, folded into runLetterValidators, actually
    // reaches the export gate), so this fixture trips other unrelated
    // blockers too — assert on the presence of the V-18 prefix, never on
    // the array's length or emptiness.
    const blocking = baseForm({
      punishments: [
        { code: 'N08', gradeReducedTo: 'LCpl' },
        { code: 'N07', dollars: '50' },
      ],
      forfeitureBasisGrade: 'E4',
    });
    const blockingIssues = getExportBlockers(blocking, [], [], []);
    expect(blockingIssues.some((i) => i.id.startsWith('navmc10132-v18-'))).toBe(true);

    // Same fixture, but the forfeiture basis is correctly recorded at the
    // reduced grade E3: no V-18 issue.
    const compliant = baseForm({
      punishments: [
        { code: 'N08', gradeReducedTo: 'LCpl' },
        { code: 'N07', dollars: '50' },
      ],
      forfeitureBasisGrade: 'E3',
    });
    const compliantIssues = getExportBlockers(compliant, [], [], []);
    expect(compliantIssues.some((i) => i.id.startsWith('navmc10132-v18-'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Identity, capacity, unit, remark and cross-record validators
// (navmc10132-validators-identity.ts)
// V-09, V-10, V-11, V-12, W-04, W-10, W-13, W-14, W-15, W-16
// ---------------------------------------------------------------------------

describe('V-09, a capacity-bound field must fit its measured widget width', () => {
  it('trips when item 18 accused full name overflows its widget width', () => {
    const form = baseForm({ accusedName: 'W'.repeat(120) });
    const issues = checkFieldCapacities(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v09-overflow-18-accused-full-name');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip when item 18 accused full name is a short, ordinary name', () => {
    const form = baseForm({ accusedName: 'Smith, John A.' });
    expect(checkFieldCapacities(form)).toEqual([]);
  });
});

describe('V-10, items 18 to 20 accused identity must be complete', () => {
  it('trips when the EDIPI is blank', () => {
    const form = baseForm({
      accusedName: 'Smith, John A.',
      accusedRankGrade: 'Sgt/E-5',
      accusedEdipi: '',
    });
    const issues = checkAccusedIdentity(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v10-accused-identity-incomplete');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip when name, rank/grade, and EDIPI are all present', () => {
    const form = baseForm({
      accusedName: 'Smith, John A.',
      accusedRankGrade: 'Sgt/E-5',
      accusedEdipi: '1234567890',
    });
    expect(checkAccusedIdentity(form)).toEqual([]);
  });
});

describe('V-11, item 17 unit must be present, and not the accused own name', () => {
  it('trips block when item 17 is blank', () => {
    const form = baseForm({ unit: '' });
    const issues = checkUnitEchelon(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v11-unit-blank');
    expect(issues[0].severity).toBe('block');
  });

  it('trips warn when item 17 is identical to item 18', () => {
    const form = baseForm({ unit: 'Smith, John A.', accusedName: 'Smith, John A.' });
    const issues = checkUnitEchelon(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v11-unit-matches-accused-name');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip when item 17 names a unit distinct from the accused name', () => {
    const form = baseForm({ unit: 'HQSVCCo, 1st Bn, 3d Mar', accusedName: 'Smith, John A.' });
    expect(checkUnitEchelon(form)).toEqual([]);
  });
});

describe('V-12, an EDIPI must be exactly 10 digits when present', () => {
  it('trips on a malformed accused EDIPI, item 20', () => {
    const form = baseForm({ accusedEdipi: '12345' });
    const issues = checkEdipiFormat(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v12-edipi-format-20');
    expect(issues[0].severity).toBe('block');
  });

  it('trips on a malformed NJP authority EDIPI, item 8B', () => {
    const form = baseForm({ njpAuthorityEdipi: 'abcdefghij' });
    const issues = checkEdipiFormat(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-v12-edipi-format-8b');
    expect(issues[0].severity).toBe('block');
  });

  it('does not trip on a well-formed 10-digit EDIPI', () => {
    const form = baseForm({ accusedEdipi: '1234567890', njpAuthorityEdipi: '0987654321' });
    expect(checkEdipiFormat(form)).toEqual([]);
  });

  it('does not trip on an empty EDIPI, that gap belongs to V-10', () => {
    const form = baseForm({ accusedEdipi: '', njpAuthorityEdipi: '' });
    expect(checkEdipiFormat(form)).toEqual([]);
  });
});

describe('W-04, item 21 appears to contain victim PII', () => {
  it('trips on an SSN-shaped number in remarks', () => {
    const form = baseForm({ remarksComposed: 'Victim SSN is 123-45-6789 per the report.' });
    const issues = checkVictimPii(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-w04-victim-pii');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip on ordinary remarks with no PII pattern', () => {
    const form = baseForm({
      remarksComposed: composeRemarks([
        { date: '2026-01-01', kind: 'forwarded', detail: 'court-martial' },
      ]),
    });
    expect(checkVictimPii(form)).toEqual([]);
  });
});

describe('W-10, an appealed punishment crosses a mandatory judge-advocate review threshold', () => {
  it('trips when an appeal is on file and correctional custody exceeds 7 days', () => {
    const form = baseForm({
      appealDate: '2026-01-15',
      punishments: [{ code: 'N06', days: '10', suspendedFromDuty: false }],
    });
    const issues = checkAppealReviewThreshold(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-w10-appeal-review-threshold');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip when there is no appeal on file', () => {
    const form = baseForm({
      appealDate: '',
      punishments: [{ code: 'N06', days: '10', suspendedFromDuty: false }],
    });
    expect(checkAppealReviewThreshold(form)).toEqual([]);
  });
});

describe('W-13, a structured item 21 entry must match a prescribed format', () => {
  it('trips on a hand-edited entry that does not match any prescribed format', () => {
    const form = baseForm({
      remarksComposed: '2026-01-01 ITEM 2: made up wording not from the instruction.',
    });
    const issues = checkRemarkFormats(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-w13-remark-format-0');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip on a properly composed prescribed-format entry', () => {
    const form = baseForm({
      remarksComposed: composeRemarks([
        { date: '2026-01-01', kind: 'forwarded', detail: 'court-martial' },
      ]),
    });
    expect(checkRemarkFormats(form)).toEqual([]);
  });
});

describe('W-14, the same offense appears more than once on this form', () => {
  it('trips when two rows share the same article and the same summary', () => {
    const form = baseForm({
      offenses: offensesWith(
        {
          articleLabel: 'Art. 89  Disrespect of sup. comm. officer',
          summary: 'Disrespected the duty NCO in front of the platoon.',
        },
        {
          articleLabel: 'Art. 89  Disrespect of sup. comm. officer',
          summary: 'Disrespected the duty NCO in front of the platoon.',
        }
      ),
    });
    const issues = checkDuplicateOffenses(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-w14-duplicate-offense-1');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip when two rows carry different summaries', () => {
    const form = baseForm({
      offenses: offensesWith(
        {
          articleLabel: 'Art. 89  Disrespect of sup. comm. officer',
          summary: 'Disrespected the duty NCO in front of the platoon.',
        },
        {
          articleLabel: 'Art. 89  Disrespect of sup. comm. officer',
          summary: 'Disrespected the OOD at the quarterdeck.',
        }
      ),
    });
    expect(checkDuplicateOffenses(form)).toEqual([]);
  });
});

describe('W-15, two offenses appear to share a date and place', () => {
  it('trips when two summaries name the same date and the same place', () => {
    const form = baseForm({
      offenses: offensesWith(
        { articleLabel: 'Art. 89  Disrespect of sup. comm. officer', summary: 'On 2026-01-05 at Camp Pendleton, disrespected the duty NCO.' },
        { articleLabel: 'Art. 116  Riot', summary: 'On 2026-01-05 at Camp Pendleton, incited a disturbance.' }
      ),
    });
    const issues = checkIncidentGrouping(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-w15-shared-incident-0-1');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip when the two summaries name different places', () => {
    const form = baseForm({
      offenses: offensesWith(
        { articleLabel: 'Art. 89  Disrespect of sup. comm. officer', summary: 'On 2026-01-05 at Camp Pendleton, disrespected the duty NCO.' },
        { articleLabel: 'Art. 116  Riot', summary: 'On 2026-01-05 at Twentynine Palms, incited a disturbance.' }
      ),
    });
    expect(checkIncidentGrouping(form)).toEqual([]);
  });
});

describe('W-16, the record suggests the offense was already tried in a US-derived court', () => {
  it('trips on adjudication language tied to a court-martial reference', () => {
    const form = baseForm({
      offenses: offensesWith({
        articleLabel: 'Art. 89  Disrespect of sup. comm. officer',
        summary: 'The accused was convicted at a general court-martial for this offense.',
      }),
    });
    const issues = checkUsDerivedCourt(form);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('navmc10132-w16-us-derived-court');
    expect(issues[0].severity).toBe('warn');
  });

  it('does not trip on a bare recommendation to pursue court-martial', () => {
    const form = baseForm({
      offenses: offensesWith({
        articleLabel: 'Art. 89  Disrespect of sup. comm. officer',
        summary: 'Disrespected the duty NCO in front of the platoon.',
      }),
      remarksComposed: composeRemarks([
        { date: '2026-01-01', kind: 'forwarded', detail: 'court-martial' },
      ]),
    });
    expect(checkUsDerivedCourt(form)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Citation discipline
// ---------------------------------------------------------------------------

describe('Citation discipline', () => {
  it('every issue emitted anywhere in the four rule groups carries a non-empty citation', () => {
    // A deliberately messy but internally consistent form, built to trip
    // several rules across all four modules in one pass: V-02 (row A has an
    // article but no summary), W-01 (Art. 94 is not ordinarily minor), V-04
    // (no punishment entries), V-05 (suspension empty), V-06 (rights cert
    // after punishment), V-10 (identity incomplete), V-11 (unit blank).
    const messyForm = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 94  Mutiny or sedition', summary: '' }),
      unit: '',
      accusedName: '',
      accusedRankGrade: '',
      accusedEdipi: '',
      punishments: [],
      suspension: '',
      rightsAttestDate: '2026-01-05',
      punishmentDate: '2026-01-01',
    });

    const issues = [
      ...offenseIssues(messyForm),
      ...dateIssues(messyForm),
      ...punishmentIssues(messyForm),
      ...identityIssues(messyForm),
    ];

    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue.citation, `issue ${issue.id} must carry a citation`).toEqual(
        expect.any(String)
      );
      expect(
        issue.citation.trim().length,
        `issue ${issue.id} citation must not be empty`
      ).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Aggregate entry point (navmc10132-validators.ts)
// ---------------------------------------------------------------------------

describe('runNavmc10132Validators, the aggregate entry point', () => {
  it('returns every kind of issue for a messy navmc10132 form', () => {
    const form = baseForm({
      offenses: offensesWith({ articleLabel: 'Art. 86  Absence without leave' }),
      unit: '',
    });
    const issues = runNavmc10132Validators(form);
    expect(issues.length).toBeGreaterThan(0);
    expect(findIssue(issues, 'navmc10132-v11-unit-blank')).toBeTruthy();
  });

  it('is a no-op, returns an empty array, for a document that is not navmc10132', () => {
    const form = baseForm({ documentType: 'navmc10132a', unit: '', accusedName: '' });
    expect(runNavmc10132Validators(form)).toEqual([]);
  });

  it('is a no-op for a document with no recognizable documentType at all', () => {
    const form = { documentType: 'letter' } as FormData;
    expect(runNavmc10132Validators(form)).toEqual([]);
  });
});
