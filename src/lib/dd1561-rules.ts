/**
 * DD Form 1561 (DEC 2017) rules. Pure functions, no UI or PDF imports.
 *
 * Rule source: DoD 7000.14-R (FMR) Vol 7A Ch 27, "Family Separation
 * Allowance (FSA)", October 2025. Paragraph and table numbers in comments
 * cite that edition. Spec: docs/DD1561_FSA_SPEC.md. Data model and key
 * meanings: src/types/dd1561.ts. Field names: src/lib/dd1561-fields.ts.
 *
 * Owner decisions (spec P1a, P4):
 *  - The app never computes a dollar amount or paid days. It reports
 *    eligibility and QUALIFYING day counts only. A qualifying count includes
 *    the departure day, the return day and the 31st of a month (FMR 4.4.1.1,
 *    4.4.2.1, 4.4.3); the 30-day-month payment rule (Table 27-1 note 1) is
 *    deliberately not modelled.
 *  - Identifiers are the 10-digit EDIPI. A value that is not ten digits is
 *    never printed, so a mistyped SSN cannot reach the form.
 *  - Blocks 9b and 15d (signatures) are never set. Blocks 15a-c and 16 are
 *    set only from the optional certifier fields.
 *
 * Printed formats (Phase 4 relies on these):
 *  - Single dates: DDMMYY, six digits, no separators (24 Nov 2026 -> 241126),
 *    as the form's "(DDMMYY)" captions ask.
 *  - Inclusive dates (blocks 10b, 11 leave and proceed): "DDMMYY - DDMMYY",
 *    from first, one space, hyphen, one space. Fits the narrowest field
 *    (11 leave dates, 105 pt) at the form's font sizes.
 *  - Block 10c NO. OF DAYS: the inclusive count of that row's printed dates,
 *    as a plain integer.
 */
import type { FormData } from '@/types';
import {
  DD1561_EMPTY_FSA_T_ROW,
  DD1561_EMPTY_SHIP_SEGMENT,
  type Dd1561FsaTRow,
  type Dd1561FsaType,
  type Dd1561ShipSegment,
} from '@/types/dd1561';
import { DD1561_FIELDS, DD1561_FSA_R, DD1561_FSA_T_ROWS } from '@/lib/dd1561-fields';

/** "More than 30 days" (FMR 2.3.1.2, 2.3.1.3): the 31st day is the first that qualifies. */
export const DD1561_QUALIFYING_THRESHOLD = 30;
/** Block 10 has three rows on the form; rows past this print on a continuation page (Phase 4). */
export const DD1561_FORM_FSA_T_ROWS = DD1561_FSA_T_ROWS.length;
/** Same check the other forms use (navmc11106-validators.ts, spec P1a). */
export const DD1561_EDIPI_RE = /^\d{10}$/;

export const isValidEdipi = (v: unknown): boolean => DD1561_EDIPI_RE.test(String(v ?? '').trim());

// ---------------------------------------------------------------------------
// Dates. ISO yyyy-mm-dd in state; arithmetic in whole UTC days so the
// worker time zone (tests pin America/Los_Angeles) can never shift a day.
// ---------------------------------------------------------------------------

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function dayNumber(iso: unknown): number | null {
  const m = ISO_RE.exec(String(iso ?? ''));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t / DAY_MS;
}

function fromDayNumber(n: number): string {
  const d = new Date(n * DAY_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** True for a real calendar date written yyyy-mm-dd. */
export function isIsoDate(v: unknown): v is string {
  return dayNumber(v) !== null;
}

/** ISO date plus n days (n may be negative); '' for an invalid date. */
export function addDays(iso: string, n: number): string {
  const d = dayNumber(iso);
  return d === null ? '' : fromDayNumber(d + n);
}

/**
 * Inclusive calendar-day count, both ends counted (FMR 4.4.1.1, 4.4.3).
 * null when either date is invalid or `to` is before `from`.
 */
export function inclusiveDays(from: string, to: string): number | null {
  const a = dayNumber(from);
  const b = dayNumber(to);
  if (a === null || b === null || b < a) return null;
  return b - a + 1;
}

/** yyyy-mm-dd -> DDMMYY (the form's order); '' for an invalid date. */
export function toDdmmyy(iso: string): string {
  if (!isIsoDate(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}${m}${y.slice(2)}`;
}

/** "DDMMYY - DDMMYY"; '' unless both dates are valid. */
export function formatInclusiveDates(from: string, to: string): string {
  const a = toDdmmyy(from);
  const b = toDdmmyy(to);
  return a && b ? `${a} - ${b}` : '';
}

const later = (a: string, b: string): string => (isIsoDate(b) && (!isIsoDate(a) || b > a) ? b : a);

/** Leave/permissive day counts arrive as numbers or, from a text input, strings. */
function dayCount(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim() || 0);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// ---------------------------------------------------------------------------
// Reading the form data
// ---------------------------------------------------------------------------

const str = (data: FormData, key: string): string => String(data[key] ?? '').trim();

export function dd1561Type(data: FormData): '' | Dd1561FsaType {
  const t = data.dd1561FsaType;
  return t === 'T' || t === 'R' || t === 'S' ? t : '';
}

export const fsaTRowHasContent = (r: Dd1561FsaTRow): boolean => Boolean(r.location.trim() || r.from || r.to);

/** Block 10 rows with defaults filled in; fully empty rows dropped. */
export function dd1561FsaTRows(data: FormData): Dd1561FsaTRow[] {
  const rows: Dd1561FsaTRow[] = Array.isArray(data.dd1561FsaTRows) ? data.dd1561FsaTRows : [];
  return rows.map((r) => ({ ...DD1561_EMPTY_FSA_T_ROW, ...r })).filter(fsaTRowHasContent);
}

/** FSA-S segments with defaults filled in; segments with no dates dropped. */
export function dd1561ShipSegments(data: FormData): Dd1561ShipSegment[] {
  const segs: Dd1561ShipSegment[] = Array.isArray(data.dd1561FsaSSegments) ? data.dd1561FsaSSegments : [];
  return segs.map((s) => ({ ...DD1561_EMPTY_SHIP_SEGMENT, ...s })).filter((s) => Boolean(s.from || s.to));
}

// ---------------------------------------------------------------------------
// Day counting (qualifying days only)
// ---------------------------------------------------------------------------

/** One continuous counted period. */
export interface Dd1561Period {
  /** ISO. First counted day (constructive where leave applies). */
  from: string;
  /** ISO. Last counted day; '' when the period is still open (FSA-S still deployed). */
  to: string;
  /** Inclusive qualifying days; null when open or the dates are invalid. */
  days: number | null;
  /** days > 30 (FMR 2.3.1.2, 2.3.1.3). */
  exceedsThirty: boolean;
  /** ISO. The 31st counted day, the day the period qualifies; '' when it does not (FMR 4.3 Example). */
  qualifiedOn: string;
}

function period(from: string, to: string): Dd1561Period {
  const days = to ? inclusiveDays(from, to) : null;
  const exceedsThirty = days !== null && days > DD1561_QUALIFYING_THRESHOLD;
  return { from, to, days, exceedsThirty, qualifiedOn: exceedsThirty ? addDays(from, DD1561_QUALIFYING_THRESHOLD) : '' };
}

/**
 * Constructive day of departure from the PDS (FMR 4.4.1.2.1): the actual date
 * of detachment plus the days of authorized leave, proceed time and permissive
 * travel used, or the first day of authorized travel, whichever is later.
 * FMR 4.4.1 Ex. 1: detach 25 May + 5 days leave = 30 May.
 */
export function constructiveDeparture(actualDeparture: string, leaveProceedPermissiveDays: number, firstTravelDate = ''): string {
  const base = addDays(actualDeparture, dayCount(leaveProceedPermissiveDays));
  return base ? later(base, firstTravelDate) : '';
}

/**
 * Constructive day of return to the PDS (FMR 4.4.1.2.2): the actual date of
 * return minus the days of leave and permissive travel used.
 * FMR 4.4.1 Ex. 2: return 5 Jul - 5 days leave = 30 Jun.
 */
export function constructiveReturn(actualReturn: string, leavePermissiveDays: number): string {
  return addDays(actualReturn, -dayCount(leavePermissiveDays));
}

export interface Dd1561FsaTInput {
  rows: Dd1561FsaTRow[];
  /** dd1561FsaTLeaveBeforeDays */
  leaveBeforeDays?: number;
  /** dd1561FsaTLeaveAfterDays */
  leaveAfterDays?: number;
  /** dd1561FsaTFirstTravelDate */
  firstTravelDate?: string;
}

export interface Dd1561FsaTPrintedRow {
  location: string;
  /** ISO dates as printed: row 1 `from` and the last row `to` are constructive. */
  from: string;
  to: string;
  /** Block 10b string. */
  inclusiveDates: string;
  /** Block 10c: inclusive count of the printed dates; null when invalid. */
  days: number | null;
}

export interface Dd1561FsaTCount {
  rows: Dd1561FsaTPrintedRow[];
  /**
   * Continuous periods, in order. Rows join one period when the next row
   * starts on or the day after the previous row ends and is not flagged
   * `interruptedBefore` (FMR 4.4.1.3 consecutive TDYs combine; 4.4.1.5 an
   * interruption never combines). A gap of more than one day also splits:
   * the member was back at the PDS, which is the 4.4.2 interim case, never a
   * single continuous period.
   */
  periods: Dd1561Period[];
  constructiveDeparture: string;
  constructiveReturn: string;
  /** Days of the longest period (0 when none can be counted). */
  qualifyingDays: number;
  /** Some period exceeds 30 days. */
  exceedsThirty: boolean;
}

/**
 * FSA-T single-period count (FMR 4.4.1): actual days including the departure
 * day, the return day and the 31st (4.4.1.1), including authorized travel
 * time (4.4.1.2), on constructive dates when leave or proceed time is used
 * (4.4.1.2.1-2). Leave, hospitalization and short PDS visits during the TDY
 * do not interrupt (4.4.1.5) and need no input; a real interruption is the
 * row flag `interruptedBefore`.
 *
 * POC travel for the member's convenience (4.4.1.4) is not modelled: enter
 * the travel days that governed the travel payment as the row dates.
 */
export function countFsaT(input: Dd1561FsaTInput): Dd1561FsaTCount {
  const rows = input.rows.map((r) => ({ ...DD1561_EMPTY_FSA_T_ROW, ...r })).filter(fsaTRowHasContent);
  const first = rows[0];
  const last = rows[rows.length - 1];
  const depart = first ? constructiveDeparture(first.from, input.leaveBeforeDays ?? 0, input.firstTravelDate ?? '') : '';
  const ret = last ? constructiveReturn(last.to, input.leaveAfterDays ?? 0) : '';

  const printed: Dd1561FsaTPrintedRow[] = rows.map((r, i) => {
    const from = i === 0 ? depart : r.from;
    const to = i === rows.length - 1 ? ret : r.to;
    return { location: r.location.trim(), from, to, inclusiveDates: formatInclusiveDates(from, to), days: inclusiveDays(from, to) };
  });

  const periods: Dd1561Period[] = [];
  let start = '';
  let end = '';
  printed.forEach((r, i) => {
    if (!isIsoDate(r.from) || !isIsoDate(r.to)) return;
    const joins = start !== '' && !rows[i].interruptedBefore && r.from <= addDays(end, 1);
    if (joins) {
      end = later(end, r.to);
      return;
    }
    if (start) periods.push(period(start, end));
    start = r.from;
    end = r.to;
  });
  if (start) periods.push(period(start, end));

  const qualifyingDays = Math.max(0, ...periods.map((p) => p.days ?? 0));
  return {
    rows: printed,
    periods,
    constructiveDeparture: depart,
    constructiveReturn: ret,
    qualifyingDays,
    exceedsThirty: periods.some((p) => p.exceedsThirty),
  };
}

export interface Dd1561FsaSCount {
  periods: Dd1561Period[];
  /** Block 12 commencing date: the first counted segment's `from` (Table 27-1 rules 3-4). */
  commencingDate: string;
  qualifyingDays: number;
  exceedsThirty: boolean;
  /** The last period has no end date yet, so the 30-day test cannot be decided. */
  openEnded: boolean;
}

/**
 * FSA-S count (FMR 4.4.3): actual calendar days, including the 31st, the day
 * of departure from homeport (or of joining the ship away from homeport) and
 * the day of return. Consecutive ships combine (Ex. 5); days at homeport under
 * orders to remain aboard count (2.3.1.2.2, Ex. 6). Days kept aboard for
 * disciplinary reasons do not count, and this module also treats them as
 * ending the continuous period, since the ship is at homeport (interpretation
 * of 2.3.1.2.2). Leave, TAD, hospitalization and short homeport visits by the
 * member need no input: they do not interrupt (4.4.3).
 */
export function countFsaS(segments: Dd1561ShipSegment[]): Dd1561FsaSCount {
  const segs = segments.map((s) => ({ ...DD1561_EMPTY_SHIP_SEGMENT, ...s })).filter((s) => isIsoDate(s.from));
  const periods: Dd1561Period[] = [];
  let start = '';
  let end = '';
  let open = false;
  const close = () => {
    if (start) periods.push(period(start, open ? '' : end));
    start = '';
    end = '';
    open = false;
  };
  for (const s of segs) {
    if (s.status === 'remain-aboard-disciplinary') {
      close();
      continue;
    }
    const segOpen = !isIsoDate(s.to);
    const joins = start !== '' && !open && s.from <= addDays(end, 1);
    if (!joins) {
      close();
      start = s.from;
      end = segOpen ? s.from : s.to;
      open = segOpen;
      continue;
    }
    if (segOpen) open = true;
    else end = later(end, s.to);
  }
  close();
  const firstCounted = segs.find((s) => s.status !== 'remain-aboard-disciplinary');
  return {
    periods,
    commencingDate: firstCounted?.from ?? '',
    qualifyingDays: Math.max(0, ...periods.map((p) => p.days ?? 0)),
    exceedsThirty: periods.some((p) => p.exceedsThirty),
    openEnded: periods.length > 0 && periods[periods.length - 1].to === '',
  };
}

export interface Dd1561RedeploymentInput {
  priorType: '' | 'T' | 'S';
  priorFrom: string;
  priorTo: string;
  currentType: '' | Dd1561FsaType;
  /** The current period (first counted period of this claim). */
  current: Dd1561Period | undefined;
}

export interface Dd1561RedeploymentResult {
  /** Prior dates are present and valid. */
  evaluated: boolean;
  priorDays: number | null;
  /** Prior period exceeded 30 days (it qualified). */
  priorQualified: boolean;
  /** Days from the day after the prior period through the day before redeployment (4.4.2.3.1); null when invalid or overlapping. */
  interimDays: number | null;
  redeploymentDays: number | null;
  /** Prior and current are the same kind; TDY and ship never combine (4.4.5.1). */
  sameKind: boolean;
  /** Prior qualified, interim <= 30, redeployment > 30, same kind: FSA continues through the interim (4.4.2.3, 4.4.4.3; Table 27-4 rules 20-21). */
  continues: boolean;
  /** Interim + redeployment when it continues; the redeployment alone when only it exceeds 30; else 0. Days, never money. */
  creditedDays: number;
  citation: string;
}

/**
 * The 8g interim / redeployment rule (FMR 4.4.2 for FSA-T, 4.4.4 for FSA-S;
 * Table 27-4 rules 20-21). Ex. 1: 45-day TDY, 30-day interim, 35-day
 * redeployment -> 65 days. Ex. 2: interim 31 days -> redeployment alone (40).
 * Ex. 3: interim 0 -> continues (0 + 41). The redeployment must itself exceed
 * 30 days in every case (4.4.2.3.2).
 */
export function evaluateRedeployment(input: Dd1561RedeploymentInput): Dd1561RedeploymentResult {
  const kind = input.currentType === 'S' ? 'S' : 'T';
  const citation = kind === 'S' ? 'DoD FMR Vol 7A Ch 27 par 4.4.4; Table 27-4 rule 21' : 'DoD FMR Vol 7A Ch 27 par 4.4.2; Table 27-4 rule 20';
  const priorDays = inclusiveDays(input.priorFrom, input.priorTo);
  const cur = input.current;
  const redeploymentDays = cur?.days ?? null;
  const evaluated = priorDays !== null && cur !== undefined && isIsoDate(cur.from);
  let interimDays: number | null = null;
  if (evaluated && cur) {
    const startInterim = addDays(input.priorTo, 1);
    if (cur.from === startInterim) interimDays = 0;
    else if (cur.from > startInterim) interimDays = inclusiveDays(startInterim, addDays(cur.from, -1));
  }
  const sameKind = input.priorType !== '' && input.priorType === kind && input.currentType !== 'R';
  const priorQualified = priorDays !== null && priorDays > DD1561_QUALIFYING_THRESHOLD;
  const redeployQualified = redeploymentDays !== null && redeploymentDays > DD1561_QUALIFYING_THRESHOLD;
  const continues = evaluated && sameKind && priorQualified && interimDays !== null
    && interimDays <= DD1561_QUALIFYING_THRESHOLD && redeployQualified;
  const creditedDays = continues ? (interimDays ?? 0) + (redeploymentDays ?? 0) : redeployQualified ? (redeploymentDays ?? 0) : 0;
  return { evaluated, priorDays, priorQualified, interimDays, redeploymentDays, sameKind, continues, creditedDays, citation };
}

export interface Dd1561FsaRStart {
  /** Inclusive leave-en-route days (block 11 leave dates). */
  leaveDays: number;
  /** Inclusive proceed-time days (block 11 proceed dates). */
  proceedDays: number;
  /**
   * FSA-R credit start: the constructive date of detachment, actual
   * detachment plus leave and proceed days, or the first day of authorized
   * travel, whichever is later (Table 27-1 rules 1-2). No FSA-R accrues
   * during leave en route or proceed time (Table 27-4 note 4).
   */
  startDate: string;
}

export function fsaRStart(data: FormData): Dd1561FsaRStart {
  const leaveDays = inclusiveDays(str(data, 'dd1561FsaRLeaveFrom'), str(data, 'dd1561FsaRLeaveTo')) ?? 0;
  const proceedDays = inclusiveDays(str(data, 'dd1561FsaRProceedFrom'), str(data, 'dd1561FsaRProceedTo')) ?? 0;
  const startDate = constructiveDeparture(str(data, 'dd1561FsaRDetachDate'), leaveDays + proceedDays, str(data, 'dd1561FsaRFirstTravelDate'));
  return { leaveDays, proceedDays, startDate };
}

export function fsaTCountFor(data: FormData): Dd1561FsaTCount {
  return countFsaT({
    rows: dd1561FsaTRows(data),
    leaveBeforeDays: dayCount(data.dd1561FsaTLeaveBeforeDays),
    leaveAfterDays: dayCount(data.dd1561FsaTLeaveAfterDays),
    firstTravelDate: str(data, 'dd1561FsaTFirstTravelDate'),
  });
}

export interface Dd1561DayCount {
  type: '' | Dd1561FsaType;
  /** Periods of the selected type (FSA-T or FSA-S); empty for FSA-R, which has no 30-day test. */
  periods: Dd1561Period[];
  /** Days of the longest period. */
  qualifyingDays: number;
  /** FSA-T/S: some period exceeds 30 days. FSA-R: always false (no 30-day test). */
  exceedsThirty: boolean;
  /** FSA-S only: the period has no end date yet. */
  openEnded: boolean;
  /** Present when 8g is 'was' and the type is T or S. */
  redeployment?: Dd1561RedeploymentResult;
  /** FSA-R only. */
  fsaR?: Dd1561FsaRStart;
}

/** Day count for the selected type. Never mixes TDY and ship periods (FMR 4.4.5.1). */
export function dd1561DayCount(data: FormData): Dd1561DayCount {
  const type = dd1561Type(data);
  const base: Dd1561DayCount = { type, periods: [], qualifyingDays: 0, exceedsThirty: false, openEnded: false };
  if (type === 'R') return { ...base, fsaR: fsaRStart(data) };
  if (type === '') return base;
  const count = type === 'T' ? fsaTCountFor(data) : countFsaS(dd1561ShipSegments(data));
  const result: Dd1561DayCount = {
    ...base,
    periods: count.periods,
    qualifyingDays: count.qualifyingDays,
    exceedsThirty: count.exceedsThirty,
    openEnded: 'openEnded' in count ? count.openEnded : false,
  };
  if (data.dd1561LastTdyWithin30 === 'was') {
    const pt = data.dd1561PriorPeriodType;
    result.redeployment = evaluateRedeployment({
      priorType: pt === 'T' || pt === 'S' ? pt : '',
      priorFrom: str(data, 'dd1561PriorPeriodFrom'),
      priorTo: str(data, 'dd1561PriorPeriodTo'),
      currentType: type,
      current: count.periods[0],
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Eligibility
// ---------------------------------------------------------------------------

export interface Dd1561Finding {
  code: string;
  message: string;
  citation: string;
}

export interface Dd1561Eligibility {
  /** No blockers. Unanswered questions are warnings, not blockers. */
  eligible: boolean;
  blockers: Dd1561Finding[];
  warnings: Dd1561Finding[];
  /** Which bases for "member with dependents" hold (FMR 2.1, 2.3.4). */
  basis: { spouse: boolean; children: boolean; parent: boolean; dualMilitaryCouple: boolean };
}

const FMR = 'DoD FMR Vol 7A Ch 27';

/**
 * Eligibility from the member's answers: dependency (FMR 2.2, 3.1), member
 * married to member (2.3.4), dependents near the duty station (3.3),
 * permissive orders (1.1, 4.1.1.3), FSA-R transportation and tour election
 * (2.3.1.1, 4.1.1, 4.1.3), the 30-day test for FSA-T and FSA-S (2.3.1.2,
 * 2.3.1.3, 4.4), and notes for the Reserve Component PDS rule (2.3.1.3 NOTE).
 * See the report in the Phase 2 hand-off for each interpretation.
 */
export function evaluateDd1561Eligibility(data: FormData): Dd1561Eligibility {
  const blockers: Dd1561Finding[] = [];
  const warnings: Dd1561Finding[] = [];
  const block = (code: string, message: string, citation: string) => blockers.push({ code, message, citation });
  const warn = (code: string, message: string, citation: string) => warnings.push({ code, message, citation });
  const type = dd1561Type(data);

  if (!type) block('type-missing', 'Choose exactly one FSA type: FSA-T, FSA-R or FSA-S. Only one FSA is paid for a period.', `${FMR} par 2.1; DD 1561 block 5`);

  // --- Who counts as a dependent ---
  const marital = data.dd1561MaritalStatus ?? '';
  const dualMil = data.dd1561DualMilitary === true;
  const spouse = marital === 'married' && !dualMil;
  const hasChildren = data.dd1561HasChildren === true;
  const custody = data.dd1561ChildCustody ?? '';
  const children = hasChildren && (custody === 'member' || custody === 'joint-14-plus');
  const claimsParent = data.dd1561ClaimsParent === true;
  const parent = claimsParent && data.dd1561ParentDependencyApproved === true && data.dd1561ParentResidesWithMember === true;
  const residing = data.dd1561SpouseResidingTogether ?? '';
  const couple = dualMil && residing === 'was';
  const otherDeps = children || parent;

  // Findings about one candidate basis are blockers only when no other basis holds.
  const pending: Dd1561Finding[] = [];
  const candidate = (code: string, message: string, citation: string) => pending.push({ code, message, citation });
  // Unanswered questions about a candidate basis: warnings, or blockers when no basis holds yet.
  const unanswered: Dd1561Finding[] = [];
  const ask = (code: string, message: string, citation: string) => unanswered.push({ code, message, citation });

  if (!marital) warn('marital-status-unanswered', 'Answer marital status (block 8a).', `${FMR} par 3.1.2; DD 1561 block 8a`);
  if (marital === 'legally-separated') {
    candidate('legally-separated-spouse', 'A legally separated spouse is not a dependent for FSA.', `${FMR} par 3.1.2; DD 1561 block 8a`);
  }
  if (hasChildren) {
    if (!custody) ask('custody-unanswered', 'Say who had legal custody of the child(ren) when orders were received (block 8b).', `${FMR} par 2.2.1.1; DD 1561 block 8b`);
    if (custody === 'other-person') {
      candidate('child-custody-other', 'A child in the legal custody of another person is not a dependent for FSA.', `${FMR} par 2.2.1.1, 3.1.2; DD 1561 block 8b`);
    }
    if (custody === 'joint-under-14') {
      candidate('child-joint-under-14', 'Under joint custody the child must reside with the member at least 14 days a month.', `${FMR} par 2.2.1.1, 3.1.3`);
    }
    if (custody === 'joint-14-plus') {
      warn('custody-document', 'Joint custody counts only when a signed court order, divorce decree or notarized custody affidavit shows it.', `${FMR} par 2.2.1.1`);
    }
  }
  if (claimsParent) {
    if (data.dd1561ParentDependencyApproved !== true) {
      candidate('parent-dependency-not-approved', 'A parent counts only with a current, approved dependency determination.', 'DD 1561 block 8e');
    }
    if (data.dd1561ParentResidesWithMember !== true) {
      candidate('parent-not-in-member-home', 'A parent counts only when residing in the home the member controls and maintains for mutual use.', `${FMR} par 3.1.4; DD 1561 block 8e`);
    }
  }
  if (dualMil) {
    if (marital && marital !== 'married') warn('dual-mil-not-married', 'Block 8f is for a member married to another member, but the marital status is not married.', 'DD 1561 block 8f');
    if (!residing) ask('dual-mil-residing-unanswered', 'Say whether the spouse was residing with the member immediately before the separation (block 8f).', `${FMR} par 2.3.4.1; DD 1561 block 8f`);
    if (residing === 'was-not') {
      candidate('dual-mil-not-residing-together', 'A member married to a member is entitled only if they were residing together immediately before being separated by orders.', `${FMR} par 2.3.4.1; DD 1561 block 8f`);
    }
  }

  const anyBasis = spouse || children || parent || couple;
  if (anyBasis) {
    warnings.push(...unanswered);
    for (const f of pending) warnings.push({ ...f, code: `${f.code}-not-counted`, message: `${f.message} It does not count, but another dependent does.` });
  } else if (unanswered.length > 0) {
    blockers.push(...unanswered, ...pending);
  } else if (pending.length > 0) {
    blockers.push(...pending);
  } else {
    block('no-dependents', 'FSA is payable only to a member with dependents or a member married to another member.', `${FMR} par 2.1, 2.3.1`);
  }

  // --- Disqualifiers that apply whatever the basis ---
  // Owner decision 2026-11-24: read FMR 3.1.5 as excluding the dependent who
  // draws active-duty basic pay, not the whole claim. FSA stands on the other
  // dependents; block 8c is left blank because its sentence would be untrue.
  if (data.dd1561DependentOnActiveDuty === true) {
    warn(
      'dependent-on-active-duty',
      couple
        ? 'A dependent on active duty does not count, but a member married to a member remains entitled.'
        : 'A dependent on active duty does not count for FSA. The claim stands on your other dependents; if that dependent was the only one, FSA does not apply.',
      `${FMR} par 3.1.5; DD 1561 block 8c`,
    );
  }
  if (data.dd1561SoleDependentInstitutionalized === true) {
    block('sole-dependent-institutionalized', 'Not entitled when the sole dependent is in an institution for a known or expected period over 1 year.', `${FMR} par 3.1.1; Table 27-3 rule 5; DD 1561 block 8d`);
  }

  // --- Member married to member ---
  if (couple) {
    if (!otherDeps && data.dd1561SpouseReceivingFsa === true) {
      block('dual-mil-one-per-couple', 'A couple with no other dependents gets one FSA a month. The spouse already draws it; this member may become entitled when the spouse\'s entitlement ends.', `${FMR} par 2.3.4.1.1, 2.3.4.1.2`);
    } else if (!otherDeps) {
      warn('dual-mil-payee', 'One FSA per couple: it goes to the member whose orders caused the separation, or the senior member if both departed the same day.', `${FMR} par 2.3.4.1.1`);
    } else {
      warn('dual-mil-with-dependents', 'With dependents who resided with the couple, each member\'s entitlement is decided separately, but both cannot be paid FSA on behalf of the same dependent at once except as 2.3.4.2 allows.', `${FMR} par 2.3.4.2, 2.3.4.3; Table 27-4 rule 24, note 8`);
    }
  }

  // --- Orders ---
  if (data.dd1561PermissiveOrders === true) {
    if (type === 'R' && data.dd1561FsaRSecretarialWaiver === true) {
      warn('permissive-orders-waiver', 'Permissive orders do not carry FSA; this claim rests on the Secretarial waiver (or the 4.1.3.4 overseas exception).', `${FMR} par 1.1, 4.1.3.4, 4.1.4`);
    } else {
      block('permissive-orders', 'FSA is not authorized for duty under permissive orders.', `${FMR} par 1.1, 4.1.1.3`);
    }
  }

  // --- Dependents at or near the duty location ---
  if (data.dd1561AllDependentsNear === true) {
    if (type === 'S') {
      warn('dependents-near-port', 'FSA-S does not require dependents away from homeport, but is precluded while the ship stays over 30 days at a port where the member lives with the dependents.', `${FMR} par 2.3.1.2 NOTE, 4.5.2; Table 27-1 note 3`);
    } else {
      block('dependents-near', 'No FSA accrues when all dependents live at or near the duty station (50 miles or 1.5 hours one way, or the member commutes daily).', `${FMR} par 3.3.1, 3.3.2${type === 'T' ? ', 2.3.1.3 NOTE' : ''}`);
    }
  }

  // --- FSA-R conditions ---
  if (type === 'R') {
    const medical = data.dd1561FsaRCertifiedMedical === true;
    const waiver = data.dd1561FsaRSecretarialWaiver === true;
    if (data.dd1561FsaRElectedUnaccompanied === true && !medical && !waiver) {
      block('fsa-r-elected-unaccompanied', 'Electing an unaccompanied tour where an accompanied tour is authorized carries no FSA-R, including tour extensions, unless a dependent cannot accompany for certified medical reasons or the Secretary waives it.', `${FMR} par 4.1.3.1, 2.3.1.1.2; Table 27-2 rule 2, note 3`);
    } else if (data.dd1561FsaRTransportAuthorized === true && !medical && !waiver) {
      block('fsa-r-transport-authorized', 'FSA-R needs dependent transportation to or near the PDS to be not authorized at government expense.', `${FMR} par 2.3.1.1.1, 4.1.1.1`);
    } else if (data.dd1561FsaRTransportAuthorized === undefined && data.dd1561FsaRElectedUnaccompanied !== true) {
      warn('fsa-r-transport-unanswered', 'Say whether dependent transportation to the new PDS is authorized at government expense.', `${FMR} par 2.3.1.1`);
    }
    if (medical && (data.dd1561FsaRTransportAuthorized === true || data.dd1561FsaRElectedUnaccompanied === true)) {
      warn('fsa-r-certified-medical', 'Certified-medical FSA-R: block 11 still prints "transportation is not authorized", which does not fit this case. Attach the medical certification.', `${FMR} par 2.3.1.1.2, 4.1.1.2; spec H7`);
    }
    if (waiver) {
      warn('fsa-r-waiver', 'A Secretarial waiver is effective on the date granted. Attach it.', `${FMR} par 4.1.3.1, 4.1.4.1`);
    }
  }

  // --- 30-day test, FSA-T and FSA-S ---
  if (type === 'T' || type === 'S') {
    const count = dd1561DayCount(data);
    const cite = type === 'T' ? `${FMR} par 2.3.1.3, 4.4.1` : `${FMR} par 2.3.1.2, 4.4.3`;
    const label = type === 'T' ? 'TDY/TAD' : 'duty aboard ship away from homeport';
    if (count.periods.some((p) => p.days !== null) && !count.exceedsThirty && !count.openEnded) {
      block('not-more-than-30', `The ${label} counts ${count.qualifyingDays} days. FSA-${type} needs more than 30 continuous days.`, cite);
    }
    if (count.openEnded && !count.exceedsThirty) {
      warn('not-yet-30', 'FSA-S is paid only once more than 30 continuous days are completed; credit then runs from the first day.', `${FMR} Table 27-1 note 1; par 4.4.3`);
    }
    if (count.periods.length > 1) {
      warn('periods-not-combined', 'The rows form separate periods. Days before and after an interruption are never combined.', type === 'T' ? `${FMR} par 4.4.1.5` : `${FMR} par 4.4.3`);
    }
    const r = count.redeployment;
    if (r?.evaluated) {
      if (!r.sameKind) {
        warn('redeployment-kind-mismatch', 'TDY and ship periods may not be combined; the prior period does not continue this one.', `${FMR} par 4.4.5.1`);
      } else if (r.continues) {
        warn('redeployment-continues', `The prior period qualified and the ${r.interimDays}-day interim is 30 days or less, so FSA continues through the interim and redeployment (${r.creditedDays} days).`, r.citation);
      } else if (r.interimDays !== null && r.interimDays > DD1561_QUALIFYING_THRESHOLD) {
        warn('redeployment-interim-over-30', `The interim is ${r.interimDays} days, over 30, so it is not covered; the redeployment stands alone. Block 8g should read "was not".`, r.citation);
      } else if (!r.priorQualified) {
        warn('redeployment-prior-not-qualified', 'The prior period did not exceed 30 days, so it does not continue into this one.', r.citation);
      }
    }
  }

  if (data.dd1561Mobilized === true) {
    warn('reserve-component-pds', 'For a mobilized Reserve Component member the PDS is where the member was ordered to active duty or entered it; the commuting test runs from there (the form\'s HOR).', `${FMR} par 2.3.1.3 NOTE; DD 1561 block 10`);
  }

  return { eligible: blockers.length === 0, blockers, warnings, basis: { spouse, children, parent, dualMilitaryCouple: couple } };
}

// ---------------------------------------------------------------------------
// Check boxes (block 5, 8a-8g and the was / was-not pairs)
// ---------------------------------------------------------------------------

export interface Dd1561CheckBoxes {
  typeFsaT: boolean;
  typeFsaR: boolean;
  typeFsaS: boolean;
  cert8a: boolean;
  cert8b: boolean;
  cert8c: boolean;
  cert8d: boolean;
  cert8e: boolean;
  cert8f: boolean;
  cert8fSpouseWas: boolean;
  cert8fSpouseWasNot: boolean;
  cert8g: boolean;
  cert8gLastTdyWas: boolean;
  cert8gLastTdyWasNot: boolean;
}

/**
 * Which boxes to X. Each box is X'd only when the member's answer makes the
 * printed certification true; an unanswered question leaves it blank. Block
 * 5 and each was / was-not pair are derived from one single-valued answer, so
 * at most one box per group can be set (the form has no radio groups; spec
 * P1b). The keys match DD1561_FIELDS.
 *
 *  8a "not divorced or legally separated from my spouse": married (incl. 8f).
 *  8b child not in another's legal custody: children with custody member / joint 14+.
 *  8c dependent other than spouse not on active duty: a child or parent is claimed and the answer is no.
 *  8d sole dependent not institutionalized over 1 year: answered no.
 *  8e parent with approved dependency in the member's home: all three true.
 *  8f married to an active-duty member; pair from dd1561SpouseResidingTogether.
 *  8g X'd once answered; pair from dd1561LastTdyWithin30.
 */
export function dd1561CheckBoxes(data: FormData): Dd1561CheckBoxes {
  const type = dd1561Type(data);
  const dualMil = data.dd1561DualMilitary === true;
  const residing = dualMil ? data.dd1561SpouseResidingTogether : '';
  const last = data.dd1561LastTdyWithin30;
  const custody = data.dd1561ChildCustody;
  const hasChildren = data.dd1561HasChildren === true;
  const claimsParent = data.dd1561ClaimsParent === true;
  return {
    typeFsaT: type === 'T',
    typeFsaR: type === 'R',
    typeFsaS: type === 'S',
    cert8a: data.dd1561MaritalStatus === 'married',
    cert8b: hasChildren && (custody === 'member' || custody === 'joint-14-plus'),
    cert8c: (hasChildren || claimsParent) && data.dd1561DependentOnActiveDuty === false,
    cert8d: data.dd1561SoleDependentInstitutionalized === false,
    cert8e: claimsParent && data.dd1561ParentDependencyApproved === true && data.dd1561ParentResidesWithMember === true,
    cert8f: dualMil,
    cert8fSpouseWas: residing === 'was',
    cert8fSpouseWasNot: residing === 'was-not',
    cert8g: last === 'was' || last === 'was-not',
    cert8gLastTdyWas: last === 'was',
    cert8gLastTdyWasNot: last === 'was-not',
  };
}

// ---------------------------------------------------------------------------
// Printed strings and the AcroForm value map
// ---------------------------------------------------------------------------

/** Block 10 rows as printed, every row (rows past three go on the continuation page). */
export function dd1561FsaTPrintedRows(data: FormData): Dd1561FsaTPrintedRow[] {
  return fsaTCountFor(data).rows;
}

/** Rows 4+ of block 10, for the Phase 4 continuation page. */
export function dd1561FsaTContinuationRows(data: FormData): Dd1561FsaTPrintedRow[] {
  return dd1561FsaTPrintedRows(data).slice(DD1561_FORM_FSA_T_ROWS);
}

/** Block 11 strings. */
export function dd1561FsaRStrings(data: FormData) {
  return {
    lastPermanentDutyStation: str(data, 'dd1561FsaRLastPds'),
    departedDate: toDdmmyy(str(data, 'dd1561FsaRDetachDate')),
    leaveDates: formatInclusiveDates(str(data, 'dd1561FsaRLeaveFrom'), str(data, 'dd1561FsaRLeaveTo')),
    proceedDates: formatInclusiveDates(str(data, 'dd1561FsaRProceedFrom'), str(data, 'dd1561FsaRProceedTo')),
    reportedTo: str(data, 'dd1561FsaRNewPds'),
    reportedDate: toDdmmyy(str(data, 'dd1561FsaRReportDate')),
  };
}

/** Block 12 strings. The commencing date is the first counted ship segment. */
export function dd1561FsaSStrings(data: FormData) {
  return {
    commencingDate: toDdmmyy(countFsaS(dd1561ShipSegments(data)).commencingDate),
    shipUnit: str(data, 'dd1561FsaSShipUnit'),
    homeport: str(data, 'dd1561FsaSHomeport'),
  };
}

/** Block 13 strings. */
export function dd1561OrdersStrings(data: FormData) {
  return { authority: str(data, 'dd1561OrdersAuthority'), dated: toDdmmyy(str(data, 'dd1561OrdersDate')) };
}

/** Field names that the value map never sets: the two /Sig fields. */
export const DD1561_NEVER_SET_FIELDS: readonly string[] = [DD1561_FIELDS.memberSignature, DD1561_FIELDS.certifierSignature];

/**
 * AcroForm values keyed by the names in dd1561-fields.ts: strings for text
 * fields, booleans for check boxes. Phase 4 hands this to the filler.
 *
 *  - Every text and check-box field is present (text '' when empty), so the
 *    filler can clear stale values, EXCEPT:
 *  - 9b and 15d (signatures) are never present.
 *  - 15a, 15b, 15c and 16 are present only when the optional certifier field
 *    has a value; they are never defaulted.
 *  - Part II prints only the block for the selected type (10, 11 or 12);
 *    block 13 prints for every type.
 *  - Blocks 3 and 8f print the EDIPI only when it is exactly ten digits; the
 *    spouse fields print only when 8f applies. No SSN can reach the form.
 *  - Block 6 prints only for a mobilized member.
 *  - Rows 4+ of block 10 are not here: dd1561FsaTContinuationRows.
 */
export function dd1561FieldValues(data: FormData): Record<string, string | boolean> {
  const F = DD1561_FIELDS;
  const type = dd1561Type(data);
  const boxes = dd1561CheckBoxes(data);
  const dualMil = data.dd1561DualMilitary === true;
  const edipi = (key: string) => (isValidEdipi(data[key]) ? str(data, key) : '');

  const out: Record<string, string | boolean> = {
    [F.memberName]: str(data, 'dd1561MemberName'),
    [F.grade]: str(data, 'dd1561Grade'),
    [F.dodId]: edipi('dd1561Edipi'),
    [F.branchOrganization]: str(data, 'dd1561BranchOrganization'),
    [F.mobilizedDepartureDate]: data.dd1561Mobilized === true ? toDdmmyy(str(data, 'dd1561MobilizedDepartureDate')) : '',
    [F.dependentAddresses]: String(data.dd1561DependentAddresses ?? '').trim(),
    [F.spouseDodId]: dualMil ? edipi('dd1561SpouseEdipi') : '',
    [F.spouseBranchComponent]: dualMil ? str(data, 'dd1561SpouseBranchComponent') : '',
    [F.memberSignedDate]: toDdmmyy(str(data, 'dd1561MemberSignedDate')),
  };
  for (const [key, value] of Object.entries(boxes)) out[F[key as keyof Dd1561CheckBoxes]] = value;

  const tRows = type === 'T' ? dd1561FsaTPrintedRows(data) : [];
  DD1561_FSA_T_ROWS.forEach((names, i) => {
    const r = tRows[i];
    out[names.location] = r?.location ?? '';
    out[names.inclusiveDates] = r?.inclusiveDates ?? '';
    out[names.days] = r && r.days !== null ? String(r.days) : '';
  });

  const rStrings = type === 'R' ? dd1561FsaRStrings(data) : null;
  for (const [key, name] of Object.entries(DD1561_FSA_R)) {
    out[name] = rStrings ? rStrings[key as keyof typeof rStrings] : '';
  }

  const s = type === 'S' ? dd1561FsaSStrings(data) : null;
  out[F.fsaSCommencingDate] = s?.commencingDate ?? '';
  out[F.fsaSShipUnit] = s?.shipUnit ?? '';
  out[F.fsaSHomeport] = s?.homeport ?? '';

  const orders = dd1561OrdersStrings(data);
  out[F.ordersAuthority] = orders.authority;
  out[F.ordersDated] = orders.dated;

  const certifier: Array<[string, string]> = [
    [F.certifierName, str(data, 'dd1561CertifierName')],
    [F.certifierTitle, str(data, 'dd1561CertifierTitle')],
    [F.certifierOrganization, str(data, 'dd1561CertifierOrganization')],
    [F.certifiedDate, toDdmmyy(str(data, 'dd1561CertifiedDate'))],
  ];
  for (const [name, value] of certifier) if (value) out[name] = value;

  return out;
}
