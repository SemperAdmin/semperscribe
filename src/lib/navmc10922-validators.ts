/**
 * NAVMC 10922 validators - Phase 3 of docs/NAVMC_10922_BUILD_PLAN.md.
 *
 * Pure functions: FormData in, ValidationIssue[] out, folded into
 * runLetterValidators so the existing export gate picks up the
 * blockers. Every issue carries its citation. Rule source:
 * docs/NAVMC_10922_SPEC.md section 9.
 *
 * Phase scope notes:
 * - Secondary dependents are outside the phase 1 vocabulary, so the
 *   secondary-loss narrative blocker (Ch 1 para 10) has no reachable
 *   trigger yet; a primary LOSS with an empty narrative warns instead.
 * - The DD Form 137 attachment blocker (spec error 10) arrives with
 *   the secondary engine.
 * - The certified-true-copy notary restriction (Ch 1 para 1.i) is
 *   evidence guidance, not form-data validation - it lives in the UI
 *   help text, not here.
 */

import { FormData } from '@/types';
// type-only: letter-validators imports this module at runtime, so a
// value import here would create a cycle.
import type { ValidationIssue } from '@/lib/letter-validators';
import {
  Navmc10922Dependent,
  Navmc10922Dissolution,
  NAVMC_10922_RELATIONSHIPS,
} from '@/types/navmc';
import {
  NAVMC10922_DOCS_VIEWED_CAPACITY,
  parseDateLoose,
  suggestAllowanceClaimedFrom,
  sameDay,
  formatMDYY,
} from '@/lib/navmc10922-utils';

const DAY_MS = 24 * 60 * 60 * 1000;

// --- helpers ---------------------------------------------------------

function dependents(formData: FormData): Navmc10922Dependent[] {
  return Array.isArray(formData.dependents) ? formData.dependents : [];
}

function dissolutions(formData: FormData): Navmc10922Dissolution[] {
  return Array.isArray(formData.dissolutions) ? formData.dissolutions : [];
}

function depActive(r: Navmc10922Dependent): boolean {
  return Boolean(r.name?.trim() || r.address?.trim() || r.relationship || r.dateOfBirth || r.allowanceClaimedFrom);
}

function disActive(r: Navmc10922Dissolution): boolean {
  return Boolean(r.formerMarriageOf || r.spouseName?.trim() || r.dateOfDissolution || r.placeOfDissolution?.trim() || r.reason);
}

/** Name comparison tolerant of "Last, First Middle" vs "First Middle Last". */
function sameNames(a: string, b: string): boolean {
  const tokens = (s: string) =>
    s.toUpperCase().replace(/[.,]/g, ' ').split(/\s+/).filter(Boolean).sort().join(' ');
  const ta = tokens(a);
  const tb = tokens(b);
  return ta.length > 0 && ta === tb;
}

// US states, DC, and territories - names and USPS codes - for the
// foreign-divorce heuristic. Warn-only, so false positives are cheap
// and false negatives cost nothing that the attesting officer's own
// review would not.
const US_PLACE_TOKENS = new Set([
  'ALABAMA','ALASKA','ARIZONA','ARKANSAS','CALIFORNIA','COLORADO','CONNECTICUT','DELAWARE',
  'FLORIDA','GEORGIA','HAWAII','IDAHO','ILLINOIS','INDIANA','IOWA','KANSAS','KENTUCKY',
  'LOUISIANA','MAINE','MARYLAND','MASSACHUSETTS','MICHIGAN','MINNESOTA','MISSISSIPPI',
  'MISSOURI','MONTANA','NEBRASKA','NEVADA','HAMPSHIRE','JERSEY','MEXICO','YORK','CAROLINA',
  'DAKOTA','OHIO','OKLAHOMA','OREGON','PENNSYLVANIA','RHODE','TENNESSEE','TEXAS','UTAH',
  'VERMONT','VIRGINIA','WASHINGTON','WISCONSIN','WYOMING','COLUMBIA','GUAM','RICO','SAMOA',
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA',
  'ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR','GU','VI',
  'AS','MP',
]);

function mentionsUsPlace(place: string): boolean {
  return place
    .toUpperCase()
    .split(/[^A-Z]+/)
    .some((t) => US_PLACE_TOKENS.has(t));
}

const issue = (
  id: string,
  severity: ValidationIssue['severity'],
  rule: string,
  citation: string,
  detail: string
): ValidationIssue => ({ id, severity, rule, citation, detail });

// --- blockers --------------------------------------------------------

function coreFields(formData: FormData): ValidationIssue[] {
  const missing: string[] = [];
  if (!formData.reason) missing.push('Reason for application (START, GAIN, or LOSS)');
  if (!String(formData.dateOfApplication ?? '').trim()) missing.push('Date of application');
  if (!String(formData.nameOfMarine ?? '').trim()) missing.push('Name of Marine');
  if (!/^\d{10}$/.test(String(formData.edipi ?? ''))) missing.push('EDIPI (10-digit DOD ID)');
  if (!String(formData.grade ?? '').trim()) missing.push('Grade');
  if (missing.length === 0) return [];
  return [issue(
    'navmc10922-core-fields', 'block',
    'Required identification fields are incomplete',
    'NAVMC 10922 Section 1; MCO 1751.3 Ch 1 para 1.e',
    `Missing: ${missing.join('; ')}.`
  )];
}

function dependentsRequired(formData: FormData): ValidationIssue[] {
  if (dependents(formData).some(depActive)) return [];
  // LOSS convention: Section 2 lists the REMAINING dependents, so a
  // childless divorce legitimately exports with an empty roster - the
  // lost dependent lives in the LOSS panel and Section 7 narrative
  // (cancelled-manual Figs 1-10/1-11/1-15).
  if (formData.reason === 'loss' && String(formData.lostDependentName ?? '').trim()) return [];
  return [issue(
    'navmc10922-dependents-required', 'block',
    'Section 2 lists no dependent',
    'MCO 1751.3 Ch 1 para 1.e - the application exists to add or remove a dependent from MCTFS',
    formData.reason === 'loss'
      ? 'A LOSS with no remaining dependents needs the lost dependent named in the LOSS panel.'
      : 'Populate at least one dependent row before export.'
  )];
}

/** START/GAIN must agree with the previously-approved flags - the
 *  discriminator the auto-derivation uses. Warn, never block: imports
 *  and edge cases the rule cannot see stay expressible. */
function reasonDerivation(formData: FormData): ValidationIssue[] {
  const anyPrev = dependents(formData).some((r) => depActive(r) && r.previouslyApproved);
  if (formData.reason === 'start' && anyPrev) {
    return [issue(
      'navmc10922-reason-derivation', 'warn',
      'START selected but a dependent is marked previously approved',
      'NAVMC 10922 Section 2 column - "If previously approved, give date of approval"',
      'A previously approved dependent means a record exists - this reads as a GAIN.'
    )];
  }
  if (formData.reason === 'gain' && !anyPrev) {
    return [issue(
      'navmc10922-reason-derivation', 'warn',
      'GAIN selected but no dependent is marked previously approved',
      'NAVMC 10922 Section 2 column - "If previously approved, give date of approval"',
      'If every listed dependent is new, this is the member\'s FIRST application - START. Mark the existing dependents previously approved, or switch the reason.'
    )];
  }
  return [];
}

/** The LOSS panel powers the narrative and evidence - warn while it
 *  sits incomplete. */
function lossDetail(formData: FormData): ValidationIssue[] {
  if (formData.reason !== 'loss') return [];
  const missing: string[] = [];
  if (!String(formData.lostDependentName ?? '').trim()) missing.push('name');
  if (!String(formData.lostDependentRelationship ?? '').trim()) missing.push('relationship');
  if (!formData.lostEventType) missing.push('loss event');
  if (!String(formData.lostEffectiveDate ?? '').trim()) missing.push('effective date');
  if (missing.length === 0) return [];
  return [issue(
    'navmc10922-loss-detail', 'warn',
    'The LOSS panel is incomplete',
    'NAVMC 10922 reason block - "LOSS (EXPLAIN IN CERTIFICATION SECTION)"',
    `Missing: ${missing.join(', ')}. These compose the Section 7 narrative and the documents checklist.`
  )];
}

function selfAttestation(formData: FormData): ValidationIssue[] {
  const officer = String(formData.attestingOfficerName ?? '').trim();
  const member = String(formData.nameOfMarine ?? '').trim();
  if (!officer) {
    return [issue(
      'navmc10922-attesting-unverified', 'warn',
      'Attesting officer not named - self-attestation cannot be verified',
      'MCO 1751.3 CH-1 para 3.a',
      'Enter the attesting officer name (app-side field, never printed) so the prohibition check can run.'
    )];
  }
  if (member && sameNames(officer, member)) {
    return [issue(
      'navmc10922-self-attestation', 'block',
      'Member and attesting officer are the same person',
      'MCO 1751.3 CH-1 para 3.a - self attestation is no longer allowed',
      'Only administrative personnel with authority to sign by direction sign as the attesting officer.'
    )];
  }
  return [];
}

function relationshipVocab(formData: FormData): ValidationIssue[] {
  const allowed = new Set<string>(NAVMC_10922_RELATIONSHIPS);
  const bad = dependents(formData)
    .map((r, i) => ({ r, no: i + 1 }))
    .filter((x) => depActive(x.r) && x.r.relationship && !allowed.has(x.r.relationship));
  return bad.map((x) => issue(
    `navmc10922-relationship-${x.no}`, 'block',
    `Dependent ${x.no} relationship "${x.r.relationship}" is outside the supported set`,
    'docs/NAVMC_10922_SPEC.md decision 9 - secondary dependents are a later phase',
    'Supported: ' + NAVMC_10922_RELATIONSHIPS.join(', ') + '. Secondary dependents need the consolidated DD Form 137 routing this build does not carry yet.'
  ));
}

function prevMarriedConsistency(formData: FormData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const pairs: Array<[string, string, string]> = [
    ['memberPrevMarried', 'memberPrevMarriedTimes', 'HAVE YOU BEEN PREVIOUSLY MARRIED'],
    ['spousePrevMarried', 'spousePrevMarriedTimes', 'HAS PRESENT SPOUSE BEEN PREVIOUSLY MARRIED'],
  ];
  for (const [flag, times, label] of pairs) {
    if (formData[flag] !== 'yes') continue;
    const n = Number(String(formData[times] ?? '').trim());
    if (!Number.isInteger(n) || n < 1) {
      issues.push(issue(
        `navmc10922-${times}`, 'block',
        `${label} is YES but the number of times is missing or zero`,
        'NAVMC 10922 Section 4',
        'Enter the count of prior marriages.'
      ));
    }
  }
  const anyYes = formData.memberPrevMarried === 'yes' || formData.spousePrevMarried === 'yes';
  if (anyYes && !dissolutions(formData).some(disActive)) {
    issues.push(issue(
      'navmc10922-dissolution-required', 'block',
      'A prior marriage is declared but the dissolution table is empty',
      'NAVMC 10922 Section 4 - "IF EITHER ANSWER ABOVE IS YES, GIVE INFORMATION REQUESTED BELOW"',
      'Complete one dissolution row per prior marriage of the member and spouse.'
    ));
  }
  return issues;
}

function dissolutionDates(formData: FormData): ValidationIssue[] {
  const marriage = parseDateLoose(formData.marriageDate);
  if (!marriage) return [];
  return dissolutions(formData)
    .map((r, i) => ({ r, no: i + 1, d: parseDateLoose(r.dateOfDissolution) }))
    .filter((x) => x.d && x.d.getTime() >= marriage.getTime())
    .map((x) => issue(
      `navmc10922-dissolution-date-${x.no}`, 'block',
      `Former marriage ${x.no} dissolved on or after the present marriage date`,
      'MCO 1751.3 Ch 1 para 3.c - a marriage entered without dissolution of a pre-existing marriage is not valid',
      `Dissolution ${formatMDYY(x.r.dateOfDissolution)} vs marriage ${formatMDYY(String(formData.marriageDate ?? ''))}. The present marriage is void for BAH purposes; the case routes to CMC (MFP-1).`
    ));
}

function conditionalAnswers(formData: FormData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (formData.courtOrderInEffect === 'yes' && !String(formData.courtOrderDatePlace ?? '').trim()) {
    issues.push(issue(
      'navmc10922-court-order-detail', 'block',
      'Court order declared but date and place are blank',
      'NAVMC 10922 Section 4 - "IF YES, STATE DATE AND PLACE ... AND ATTACH A COPY"',
      'State the date and county/state of issue, and attach the order or agreement.'
    ));
  }
  if (formData.naturalParentArmedForces === 'yes' && !String(formData.naturalParentInfo ?? '').trim()) {
    issues.push(issue(
      'navmc10922-section5-detail', 'block',
      'Section 5 answered YES with no identifying information',
      'NAVMC 10922 Section 5',
      'List the natural parent\'s full name, EDIPI, grade, type and branch of service, inclusive dates, and each child\'s full name.'
    ));
  }
  if (formData.spouseArmedForces === 'yes') {
    const required: Array<[string, string]> = [
      ['spouseEdipi', 'EDIPI'], ['spouseGrade', 'Grade'], ['spouseTypeOfService', 'Type of service'],
      ['spouseBranch', 'Branch of service'], ['spouseServiceDates', 'Inclusive dates of active service'],
      ['spouseBaq', 'BAQ status'],
    ];
    const missing = required.filter(([k]) => !String(formData[k] ?? '').trim()).map(([, label]) => label);
    if (missing.length) {
      issues.push(issue(
        'navmc10922-section6-detail', 'block',
        'Section 6 answered YES with incomplete spouse service data',
        'NAVMC 10922 Section 6 - "IF YES, COMPLETE THE BLOCKS BELOW"',
        `Missing: ${missing.join('; ')}.`
      ));
    }
  }
  return issues;
}

function capacity(formData: FormData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const activeDeps = dependents(formData).filter(depActive).length;
  if (activeDeps > 6) {
    issues.push(issue(
      'navmc10922-capacity-dependents', 'block',
      `${activeDeps} dependents exceed the form's 6 rows`,
      'NAVMC 10922 Section 2; docs/NAVMC_10922_SPEC.md decision 2 - continuation sheets deferred',
      'Export blocks until the continuation-sheet phase lands.'
    ));
  }
  const activeDis = dissolutions(formData).filter(disActive).length;
  const declared = (Number(formData.memberPrevMarriedTimes) || 0) + (Number(formData.spousePrevMarriedTimes) || 0);
  if (activeDis > 4 || declared > 4) {
    issues.push(issue(
      'navmc10922-capacity-dissolutions', 'block',
      `${Math.max(activeDis, declared)} prior marriages exceed the form's 4 dissolution rows`,
      'NAVMC 10922 Section 4 header - "(Continue on separate sheet if necessary)"; continuation sheets deferred (decision 2)',
      'Export blocks until the continuation-sheet phase lands.'
    ));
  }
  const overCap = String(formData.documentsViewed ?? '').length;
  if (overCap > NAVMC10922_DOCS_VIEWED_CAPACITY) {
    issues.push(issue(
      'navmc10922-docs-viewed-overflow', 'block',
      `Section 7 documents-viewed text is ${overCap} characters; the printed line fits ~${NAVMC10922_DOCS_VIEWED_CAPACITY}`,
      'XFA field 93: multiLine in a one-line box, vScrollPolicy="off" - overflow clips silently in Adobe',
      'Shorten the list. Clipped text vanishes with no indicator on the official form.'
    ));
  }
  return issues;
}

// --- warnings --------------------------------------------------------

function lossNarrative(formData: FormData): ValidationIssue[] {
  if (formData.reason !== 'loss') return [];
  if (String(formData.documentsViewed ?? '').trim()) return [];
  // Phase 1 vocabulary is primary-only, so this stays a warning. When
  // the secondary engine lands, a secondary-dependent LOSS upgrades to
  // a blocker per Ch 1 para 10.
  return [issue(
    'navmc10922-loss-narrative', 'warn',
    'LOSS application with no explanation in the certification area',
    'NAVMC 10922 reason block - "LOSS (EXPLAIN IN CERTIFICATION SECTION)"; MCO 1751.3 Ch 1 para 10 mandates it for secondary dependent losses',
    'State the reason for the loss and its effective date in the Section 7 documents-viewed line.'
  )];
}

function evidenceReminders(formData: FormData): ValidationIssue[] {
  const rels = new Set(dependents(formData).filter(depActive).map((r) => r.relationship));
  const issues: ValidationIssue[] = [];
  if (rels.has('ADOPTED SON') || rels.has('ADOPTED DAUGHTER')) {
    issues.push(issue(
      'navmc10922-evidence-adopted', 'warn',
      'Adopted child claimed - adoption decree required',
      'MCO 1751.3 Figure 1-1 (Adopted Children item 2)',
      'Attach the adoption decree showing the member is the child\'s legal parent. Command-approvable; doubtful cases route to CMC (MFP-1).'
    ));
  }
  if (rels.has('STEPSON') || rels.has('STEPDAUGHTER')) {
    issues.push(issue(
      'navmc10922-evidence-step', 'warn',
      'Stepchild claimed - marriage and parentage evidence required',
      'MCO 1751.3 Figure 1-1 (Step-Children items 2-3)',
      'Attach the marriage license/certificate to the child\'s legal parent and documentation that the spouse is the child\'s parent.'
    ));
  }
  if (rels.has('CHILD BORN OUT OF WEDLOCK')) {
    issues.push(issue(
      'navmc10922-evidence-wedlock', 'warn',
      'Child born out of wedlock claimed - parentage evidence required',
      'FMR Vol 7A Ch 26 (May 2025) para 3.2.1.3.3',
      'Birth certificate citing the member, or a court order, or a signed notarized affidavit of parentage. Custody with another party routes the case to BAH-Diff rules; doubtful cases go to CMC (MFP-1).'
    ));
  }
  if (rels.has('SPOUSE')) {
    issues.push(issue(
      'navmc10922-evidence-spouse', 'warn',
      'Spouse claimed - marriage certificate must be viewed',
      'MCO 1751.3 Ch 1 paras 3.f-3.g',
      'US ceremonial: certificate viewed by the CO. Foreign: original certificate plus certified English translation by a certified translator. The CO is not authorized to disapprove either.'
    ));
  }
  return issues;
}

/** Proxy/telephone and common-law marriages are CMC (MFP-1)
 *  determinations - the CO cannot approve them. Fires only when the
 *  spouse is NEW on this application (a previously approved spouse was
 *  already adjudicated). */
function cmcMarriageRouting(formData: FormData): ValidationIssue[] {
  const newSpouse = dependents(formData).some(
    (r) => depActive(r) && r.relationship === 'SPOUSE' && !r.previouslyApproved
  );
  if (!newSpouse) return [];
  const t = String(formData.marriageType ?? '');
  if (t === 'proxy-telephone') {
    return [issue(
      'navmc10922-cmc-marriage', 'warn',
      'Proxy/telephone marriage - the commanding officer cannot approve this application',
      'MCO 1751.3 Ch 1 para 3.b - valid if performed in a jurisdiction recognizing common-law marriage with no prohibition on proxy marriages',
      'Forward the NAVMC 10922 with a certified true copy of the license and certificate of marriage from the contracting state to CMC (MFP-1) for determination.'
    )];
  }
  if (t === 'common-law') {
    return [issue(
      'navmc10922-cmc-marriage', 'warn',
      'Common-law marriage - the commanding officer cannot approve this application',
      'MCO 1751.3 Ch 1 para 3.a',
      'Forward the NAVMC 10922 with certified true copies of the declaration and registration of informal marriage from the contracting state to CMC (MFP-1) for determination.'
    )];
  }
  if (t === 'indian-tribal') {
    return [issue(
      'navmc10922-cmc-marriage', 'warn',
      'Indian tribal marriage - considered doubtful in all cases',
      'MCO 1751.3 Ch 1 para 3.e - valid only when both parties were tribe members living as part of the tribe or on a reservation',
      'Forward the NAVMC 10922 with supporting documentation to CMC (MFP-1) for determination.'
    )];
  }
  return [];
}

function foreignDivorceHeuristic(formData: FormData): ValidationIssue[] {
  const out: ValidationIssue[] = [];
  dissolutions(formData).forEach((r, i) => {
    const no = i + 1;
    if (r.foreignDivorce) {
      // Explicit flag - authoritative, fires regardless of place text.
      out.push(issue(
        `navmc10922-foreign-divorce-${no}`, 'warn',
        `Former marriage ${no} dissolved by a foreign nation divorce - doubtful case, CO cannot approve`,
        'MCO 1751.3 Ch 1 paras 3.h and 4.b',
        'Request legal review, then forward with certified true copies of the original marriage certificate and divorce decree, English translations of both, and proof of residency to CMC (MFP-1). The evidence checklist carries these items.'
      ));
      return;
    }
    if (r.reason === 'divorce' && r.placeOfDissolution?.trim() && !mentionsUsPlace(r.placeOfDissolution)) {
      out.push(issue(
        `navmc10922-foreign-divorce-${no}`, 'warn',
        `Former marriage ${no} place of dissolution names no US state - possible foreign nation divorce`,
        'MCO 1751.3 Ch 1 paras 3.h and 4.b - foreign nation divorce cases are doubtful and the CO may not approve until CMC (MFP-1) rules',
        `"${r.placeOfDissolution}" - if this divorce was granted in a foreign nation, check the row's foreign-divorce box so the required evidence set attaches.`
      ));
    }
  });
  return out;
}

function lifeEventClock(formData: FormData): ValidationIssue[] {
  const event = parseDateLoose(formData.lifeEventDate);
  const app = parseDateLoose(formData.dateOfApplication);
  if (!event || !app) return [];
  const days = Math.floor((app.getTime() - event.getTime()) / DAY_MS);
  if (days <= 30) return [];
  return [issue(
    'navmc10922-30-day', 'warn',
    `Application dated ${days} days after the life event`,
    'MCO 1751.3 Ch 1 para 1.f - substantiating documentation shall be submitted within 30 days of a life event',
    'Late submission does not void the claim; expect the command to ask why.'
  )];
}

function claimedFromOverrides(formData: FormData): ValidationIssue[] {
  return dependents(formData)
    .map((r, i) => ({ r, no: i + 1, s: suggestAllowanceClaimedFrom(r, formData.marriageDate) }))
    // previously approved rows carry the APPROVAL date per the printed
    // column header - the acquisition-date comparison does not apply
    .filter((x) => !x.r.previouslyApproved)
    .filter((x) => x.s && x.r.allowanceClaimedFrom?.trim() && !sameDay(x.r.allowanceClaimedFrom, x.s.date))
    .map((x) => issue(
      `navmc10922-claimed-from-${x.no}`, 'warn',
      `Dependent ${x.no} DATE ALLOWANCE CLAIMED FROM differs from the computed acquisition date`,
      x.s!.citation,
      `Entered ${formatMDYY(x.r.allowanceClaimedFrom)}, computed ${formatMDYY(x.s!.date)} (${x.s!.basis === 'marriage' ? 'marriage date' : 'date of birth'}). Overrides are allowed; be ready to substantiate.`
    ));
}

function custodianConsistency(formData: FormData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const flagged = dependents(formData)
    .map((r, i) => ({ r, no: i + 1 }))
    .filter((x) => depActive(x.r) && x.r.livesOutsideHousehold);
  const c = formData.custodian ?? {};
  const custodianFilled = Boolean(String(c.name ?? '').trim() || String(c.address ?? '').trim());

  if (flagged.length > 0 && !custodianFilled) {
    issues.push(issue(
      'navmc10922-custodian-missing', 'warn',
      'A dependent lives outside the household but Section 3 is empty',
      'NAVMC 10922 Section 3 - "Furnish the following information concerning custodian of any dependent named above"',
      `Dependent(s) ${flagged.map((x) => x.no).join(', ')} flagged. Name the custodian, relationship, and address.`
    ));
  }
  if (flagged.length === 0 && custodianFilled) {
    issues.push(issue(
      'navmc10922-custodian-orphaned', 'warn',
      'Section 3 names a custodian but no dependent is flagged as living outside the household',
      'docs/NAVMC_10922_SPEC.md section 9 warning 7',
      'Flag the dependent in Section 2, or clear Section 3.'
    ));
  }
  if (flagged.length > 1) {
    issues.push(issue(
      'navmc10922-custodian-capacity', 'warn',
      `${flagged.length} dependents flagged outside the household - the form holds one custodian row`,
      'NAVMC 10922 Section 3; continuation sheets deferred (decision 2)',
      'One custodian row can cover several dependents only when they share the custodian. Different custodians need a continuation sheet.'
    ));
  }
  return issues;
}

function currencyForCmcRouting(formData: FormData, now: Date): ValidationIssue[] {
  const app = parseDateLoose(formData.dateOfApplication);
  if (!app) return [];
  // Any CMC (MFP-1)-routed condition starts the 6-week clock: foreign
  // divorce (flag or heuristic), or a new spouse via a marriage type
  // the CO cannot approve.
  const routed =
    foreignDivorceHeuristic(formData).length > 0 ||
    cmcMarriageRouting(formData).length > 0;
  if (!routed) return [];
  const days = Math.floor((now.getTime() - app.getTime()) / DAY_MS);
  if (days <= 42) return [];
  return [issue(
    'navmc10922-6-week', 'warn',
    `Application signed ${days} days ago and the case appears CMC-routed`,
    'MCO 1751.3 Figures 1-2 through 1-6 - forms must be current within 6 weeks of signature when submitted to CMC (MFP-1)',
    'Re-sign or re-date before forwarding.'
  )];
}

function swornConsistency(formData: FormData): ValidationIssue[] {
  const parts = [formData.swornDay, formData.swornMonth, formData.swornYear2Digit]
    .map((v) => String(v ?? '').trim());
  const filled = parts.filter(Boolean).length;
  if (filled === 0 || filled === 3) return [];
  return [issue(
    'navmc10922-sworn-incomplete', 'warn',
    'The subscribed-and-sworn date is partially filled',
    'NAVMC 10922 Section 7',
    'Complete day, month, and 2-digit year, or leave all three for the attesting officer.'
  )];
}

// --- entry point -----------------------------------------------------

export function runNavmc10922Validators(formData: FormData, now: Date = new Date()): ValidationIssue[] {
  if (formData.documentType !== 'navmc10922') return [];
  return [
    ...coreFields(formData),
    ...dependentsRequired(formData),
    ...reasonDerivation(formData),
    ...lossDetail(formData),
    ...selfAttestation(formData),
    ...relationshipVocab(formData),
    ...prevMarriedConsistency(formData),
    ...dissolutionDates(formData),
    ...conditionalAnswers(formData),
    ...capacity(formData),
    ...lossNarrative(formData),
    ...evidenceReminders(formData),
    ...cmcMarriageRouting(formData),
    ...foreignDivorceHeuristic(formData),
    ...lifeEventClock(formData),
    ...claimedFromOverrides(formData),
    ...custodianConsistency(formData),
    ...currencyForCmcRouting(formData, now),
    ...swornConsistency(formData),
  ];
}
