/**
 * DD Form 1561 validators. Pure: FormData in, ValidationIssue[] out, folded
 * into runLetterValidators so the export gate (getExportBlockers) sees the
 * blockers. Rule source: docs/DD1561_FSA_SPEC.md P3 and DoD FMR Vol 7A Ch 27
 * (Oct 2025); the FMR logic itself lives in dd1561-rules.ts.
 *
 * Severity: `block` for anything that would put a wrong or incomplete
 * entitlement on the form (missing required data, EDIPI format, date order,
 * every eligibility blocker, the 30-day test, block 14 unconfirmed); `warn`
 * for notes the certifying officer should read. Part II blocks 15a-c and 16
 * and both signatures are never required (owner decision, spec P4.4).
 */
import type { FormData } from '@/types';
// type-only: letter-validators imports this module at runtime.
import type { ValidationIssue } from '@/lib/letter-validators';
import {
  dd1561FsaTRows,
  dd1561ShipSegments,
  dd1561Type,
  evaluateDd1561Eligibility,
  fsaTCountFor,
  isIsoDate,
  isValidEdipi,
} from '@/lib/dd1561-rules';

const FORM = 'DD Form 1561 (DEC 2017)';

const issue = (
  slug: string,
  severity: ValidationIssue['severity'],
  rule: string,
  citation: string,
  detail: string,
  field?: string,
): ValidationIssue => ({ id: `dd1561-${slug}`, severity, rule, citation, detail, ...(field ? { field } : {}) });

const str = (data: FormData, key: string): string => String(data[key] ?? '').trim();

/** Every top-level ISO date key and the block it prints in. */
const DATE_KEYS: ReadonlyArray<[string, string]> = [
  ['dd1561MobilizedDepartureDate', 'block 6'],
  ['dd1561PriorPeriodFrom', 'block 8g prior period'],
  ['dd1561PriorPeriodTo', 'block 8g prior period'],
  ['dd1561MemberSignedDate', 'block 9a'],
  ['dd1561FsaTFirstTravelDate', 'block 10 first travel day'],
  ['dd1561FsaRDetachDate', 'block 11'],
  ['dd1561FsaRLeaveFrom', 'block 11 leave'],
  ['dd1561FsaRLeaveTo', 'block 11 leave'],
  ['dd1561FsaRProceedFrom', 'block 11 proceed'],
  ['dd1561FsaRProceedTo', 'block 11 proceed'],
  ['dd1561FsaRFirstTravelDate', 'block 11 first travel day'],
  ['dd1561FsaRReportDate', 'block 11'],
  ['dd1561OrdersDate', 'block 13'],
  ['dd1561CertifiedDate', 'block 16'],
];

/** a <= b for two ISO dates; true when either is missing (checked elsewhere). */
const notAfter = (a: string, b: string): boolean => !isIsoDate(a) || !isIsoDate(b) || a <= b;

const isNonNegativeInt = (v: unknown): boolean => {
  if (v === undefined || v === null || v === '') return true;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isInteger(n) && n >= 0;
};

export function runDd1561Validators(data: FormData): ValidationIssue[] {
  if (data.documentType !== 'dd1561') return [];
  const out: ValidationIssue[] = [];
  const type = dd1561Type(data);

  // --- Blocks 1-4 ---
  const missing: string[] = [];
  if (!str(data, 'dd1561MemberName')) missing.push('1 Name');
  if (!str(data, 'dd1561Grade')) missing.push('2 Grade');
  if (!str(data, 'dd1561Edipi')) missing.push('3 DoD ID (EDIPI)');
  if (!str(data, 'dd1561BranchOrganization')) missing.push('4 Branch and organization');
  if (!str(data, 'dd1561DependentAddresses')) missing.push('7 Dependent address(es)');
  if (missing.length > 0) {
    out.push(issue('core-fields', 'block', 'Required member fields are incomplete', `${FORM} Part I`, `Missing: ${missing.join('; ')}.`));
  }
  const edipi = str(data, 'dd1561Edipi');
  if (edipi && !isValidEdipi(edipi)) {
    out.push(issue('edipi-format', 'block', 'Block 3 takes the 10-digit DoD ID (EDIPI)', `${FORM} block 3`, 'Enter the ten-digit EDIPI. Never enter a Social Security number.', 'dd1561Edipi'));
  }

  // --- Dates are real dates ---
  const badDates = DATE_KEYS.filter(([k]) => str(data, k) && !isIsoDate(str(data, k))).map(([, b]) => b);
  const tRowsAll = dd1561FsaTRows(data);
  if (tRowsAll.some((r) => (r.from && !isIsoDate(r.from)) || (r.to && !isIsoDate(r.to)))) badDates.push('block 10 rows');
  if (dd1561ShipSegments(data).some((s) => (s.from && !isIsoDate(s.from)) || (s.to && !isIsoDate(s.to)))) badDates.push('FSA-S segments');
  if (badDates.length > 0) {
    out.push(issue('date-invalid', 'block', 'A date is not a real calendar date', FORM, `Check: ${[...new Set(badDates)].join(', ')}.`));
  }

  // --- Block 6 ---
  if (data.dd1561Mobilized === true && !str(data, 'dd1561MobilizedDepartureDate')) {
    out.push(issue('mobilized-date-missing', 'block', 'A mobilized member enters block 6', `${FORM} block 6; DoD FMR Vol 7A Ch 27 par 2.3.1.3 NOTE`, 'Enter the date the member departed the residence for the unit home station.', 'dd1561MobilizedDepartureDate'));
  }

  // --- Block 8f ---
  if (data.dd1561DualMilitary === true) {
    const spouseMissing: string[] = [];
    if (!isValidEdipi(data.dd1561SpouseEdipi)) spouseMissing.push("spouse's 10-digit EDIPI");
    if (!str(data, 'dd1561SpouseBranchComponent')) spouseMissing.push('branch and component');
    if (!data.dd1561SpouseResidingTogether) spouseMissing.push('was / was not residing together');
    if (spouseMissing.length > 0) {
      out.push(issue('spouse-fields', 'block', 'Block 8f is incomplete', `${FORM} block 8f; DoD FMR Vol 7A Ch 27 par 2.3.4.1`, `Missing: ${spouseMissing.join('; ')}. Never enter a Social Security number.`));
    }
  }

  // --- Block 8g ---
  if (type === 'T' || type === 'S') {
    const last = data.dd1561LastTdyWithin30 ?? '';
    if (!last) {
      out.push(issue('8g-unanswered', 'block', 'Block 8g must be answered', `${FORM} block 8g; DoD FMR Vol 7A Ch 27 par 4.4.2, 4.4.4`, 'Say whether the last TDY or deployment was within 30 days of this one.', 'dd1561LastTdyWithin30'));
    }
    if (last === 'was') {
      const pf = str(data, 'dd1561PriorPeriodFrom');
      const pt = str(data, 'dd1561PriorPeriodTo');
      if (!pf || !pt || !data.dd1561PriorPeriodType) {
        out.push(issue('prior-period-missing', 'block', 'The prior TDY or deployment is needed', `${FORM} block 8g; DoD FMR Vol 7A Ch 27 par 4.4.2`, 'Enter the kind (TDY or ship) and the dates of the prior period.'));
      } else if (!notAfter(pf, pt)) {
        out.push(issue('prior-period-order', 'block', 'The prior period ends before it starts', `${FORM} block 8g`, 'Check the prior period dates.'));
      }
    }
  }

  // --- Part II by type ---
  if (type === 'T') {
    if (tRowsAll.length === 0) {
      out.push(issue('fsa-t-rows-missing', 'block', 'Block 10 needs at least one TDY location', `${FORM} block 10`, 'Enter the TDY location and its inclusive dates.'));
    }
    if (tRowsAll.some((r) => !r.location.trim() || !r.from || !r.to)) {
      out.push(issue('fsa-t-row-incomplete', 'block', 'A block 10 row is incomplete', `${FORM} block 10`, 'Every row needs a location, a from date and a to date.'));
    }
    if (tRowsAll.some((r) => !notAfter(r.from, r.to))) {
      out.push(issue('fsa-t-row-order', 'block', 'A TDY row ends before it starts', `${FORM} block 10b`, 'Each row\'s from date must be on or before its to date.'));
    }
    if (tRowsAll.some((r, i) => i > 0 && !notAfter(tRowsAll[i - 1].from, r.from))) {
      out.push(issue('fsa-t-rows-out-of-order', 'block', 'TDY rows are out of order', `${FORM} block 10`, 'List the TDY legs in date order.'));
    }
    if (!isNonNegativeInt(data.dd1561FsaTLeaveBeforeDays) || !isNonNegativeInt(data.dd1561FsaTLeaveAfterDays)) {
      out.push(issue('fsa-t-leave-days', 'block', 'Leave days must be whole numbers', 'DoD FMR Vol 7A Ch 27 par 4.4.1.2', 'Enter leave, proceed and permissive days as 0 or more.'));
    }
    const count = fsaTCountFor(data);
    if (tRowsAll.length > 0 && isIsoDate(count.constructiveDeparture) && isIsoDate(count.constructiveReturn)
      && count.constructiveDeparture > count.constructiveReturn) {
      out.push(issue('fsa-t-constructive-order', 'block', 'Leave leaves no TDY period', 'DoD FMR Vol 7A Ch 27 par 4.4.1.2.1-4.4.1.2.2', 'The constructive departure falls after the constructive return. Check the leave days.'));
    }
  }

  if (type === 'R') {
    const need: string[] = [];
    if (!str(data, 'dd1561FsaRLastPds')) need.push('last PDS');
    if (!str(data, 'dd1561FsaRDetachDate')) need.push('date departed');
    if (!str(data, 'dd1561FsaRNewPds')) need.push('PDS reported to');
    if (!str(data, 'dd1561FsaRReportDate')) need.push('date reported');
    if (Boolean(str(data, 'dd1561FsaRLeaveFrom')) !== Boolean(str(data, 'dd1561FsaRLeaveTo'))) need.push('both leave dates');
    if (Boolean(str(data, 'dd1561FsaRProceedFrom')) !== Boolean(str(data, 'dd1561FsaRProceedTo'))) need.push('both proceed dates');
    if (need.length > 0) {
      out.push(issue('fsa-r-fields', 'block', 'Block 11 is incomplete', `${FORM} block 11`, `Missing: ${need.join('; ')}.`));
    }
    const d = str(data, 'dd1561FsaRDetachDate');
    const lf = str(data, 'dd1561FsaRLeaveFrom');
    const lt = str(data, 'dd1561FsaRLeaveTo');
    const pf = str(data, 'dd1561FsaRProceedFrom');
    const pt = str(data, 'dd1561FsaRProceedTo');
    const rp = str(data, 'dd1561FsaRReportDate');
    const ordered = [
      notAfter(d, rp),
      notAfter(d, lf), notAfter(lf, lt), notAfter(lt, rp),
      notAfter(d, pf), notAfter(pf, pt), notAfter(pt, rp),
    ].every(Boolean);
    if (!ordered) {
      out.push(issue('fsa-r-date-order', 'block', 'Block 11 dates are out of order', `${FORM} block 11; DoD FMR Vol 7A Ch 27 Table 27-1 rule 2`, 'Departed on or before leave, leave from on or before leave to, proceed time inside the travel, and all on or before the report date.'));
    }
  }

  if (type === 'S') {
    const need: string[] = [];
    if (!str(data, 'dd1561FsaSShipUnit')) need.push('12a ship / unit');
    if (!str(data, 'dd1561FsaSHomeport')) need.push('12b homeport');
    const segs = dd1561ShipSegments(data);
    if (!segs.some((s) => s.from && s.status !== 'remain-aboard-disciplinary')) need.push('commencing date');
    if (need.length > 0) {
      out.push(issue('fsa-s-fields', 'block', 'Block 12 is incomplete', `${FORM} block 12`, `Missing: ${need.join('; ')}.`));
    }
    if (segs.some((s) => !notAfter(s.from, s.to)) || segs.some((s, i) => i > 0 && !notAfter(segs[i - 1].from, s.from))) {
      out.push(issue('fsa-s-date-order', 'block', 'Ship dates are out of order', 'DoD FMR Vol 7A Ch 27 par 4.4.3', 'Each segment must end on or after it starts, and segments must be in date order.'));
    }
  }

  // --- Block 13, 14 ---
  if (type) {
    const need: string[] = [];
    if (!str(data, 'dd1561OrdersAuthority')) need.push('orders number or authority');
    if (!str(data, 'dd1561OrdersDate')) need.push('orders date');
    if (need.length > 0) {
      out.push(issue('orders-missing', 'block', 'Block 13 is incomplete', `${FORM} block 13`, `Missing: ${need.join('; ')}.`));
    }
  }
  if (data.dd1561BahWithDependentsConfirmed !== true) {
    out.push(issue('bah-unconfirmed', 'block', 'Block 14 is not confirmed', `${FORM} block 14`, 'Confirm the member draws BAH (or occupies government quarters) as a member with dependents or a member married to a member.', 'dd1561BahWithDependentsConfirmed'));
  }

  // --- 9a on or before 16 ---
  if (!notAfter(str(data, 'dd1561MemberSignedDate'), str(data, 'dd1561CertifiedDate'))) {
    out.push(issue('certified-before-member', 'block', 'Block 16 is before block 9a', `${FORM} blocks 9a, 16`, 'The certifying officer dates the form on or after the member signs.', 'dd1561CertifiedDate'));
  }

  // --- Eligibility (FMR) ---
  const elig = evaluateDd1561Eligibility(data);
  for (const b of elig.blockers) out.push(issue(b.code, 'block', b.message, b.citation, b.message));
  for (const w of elig.warnings) out.push(issue(w.code, 'warn', w.message, w.citation, w.message));

  return out;
}
