/**
 * How long a suspension may run, and when it ends.
 *
 * MCM Part V para 6.a, quoted verbatim from the 2024 edition:
 *
 *   (1) An executed punishment of reduction or forfeiture of pay may be
 *       suspended only within a period of 4 months after the date of
 *       execution.
 *   (2) Suspension of a punishment may not be for a period longer than 6
 *       months from the date of the suspension, and the expiration of the
 *       current enlistment or term of service of the Servicemember involved
 *       automatically terminates the period of suspension.
 *   (3) Unless the suspension is sooner vacated, suspended portions of the
 *       punishment are remitted, without further action, upon the
 *       termination of the period of suspension.
 *   (4) Unless otherwise stated, an action suspending a punishment includes
 *       a condition that the Servicemember not violate any punitive article
 *       of the code.
 *
 * JAGMAN (JAGINST 5800.7G CH-2) para 0118.c, verbatim:
 *
 *   "Interruption of period of suspension. The running of the period of
 *   suspension of the punishment is interrupted by the unauthorized absence
 *   of the probationer or by commencement of proceedings to vacate
 *   suspension of the punishment."
 *
 * TWO THINGS THIS FILE EXISTS FOR.
 *
 * First, 6.a(2) is a HARD CAP the app did not enforce. Item 7 collected a
 * period in months or days with no ceiling of any kind, so a clerk could
 * record a twelve-month suspension and nothing objected. That is an unlawful
 * suspension recorded on a permanent record.
 *
 * Second, 6.a(3) is what gives a vacation its DEADLINE. A suspended
 * punishment is remitted automatically when the period ends, "without
 * further action". After that date there is nothing left to vacate, and a
 * vacation notice served on it is a nullity. Nothing else in the app can
 * compute that date, so the vacation document depends on this module.
 *
 * THE NUMBER THIS MODULE COMPUTES IS NEITHER A FLOOR NOR A CEILING. It is a
 * conditional date: the date the suspension ends IF nothing interrupts it
 * AND the enlistment outlasts it. Three real-world events move the actual
 * end date away from it, in OPPOSITE directions:
 *
 *   - unauthorized absence of the probationer (JAGMAN 0118.c) INTERRUPTS the
 *     running of the period, so the real date is LATER than computed;
 *   - commencement of proceedings to vacate the suspension (JAGMAN 0118.c)
 *     likewise INTERRUPTS it, so the real date is LATER than computed;
 *   - expiration of the current enlistment or term of service (MCM 6.a(2),
 *     second clause) TERMINATES the period early, so the real date is
 *     EARLIER than computed.
 *
 * The NAVMC 10132 has no field for unauthorized absence, no field for a
 * vacation proceeding already underway, and no EAS field, so this app
 * cannot see any of the three and cannot compute the real date. What it can
 * do, and must do, is say what its number actually is: every result names
 * all three conditions, states which direction each one pushes, and cites
 * it. Do NOT describe the computed date as "no earlier than" or "at least"
 * — the enlistment clause can make the real date EARLIER, so that framing is
 * affirmatively wrong and will mislead a commander into treating a remitted
 * suspension as live, or a live one as remitted. See SUSPENSION_ASSUMPTIONS
 * below; do not remove or soften an entry without adding the field that
 * would let the app check it directly.
 *
 * CALENDAR MONTHS, NOT 30-DAY BLOCKS. 6.a(2) says "6 months", and a
 * suspension imposed on 31 August runs to 28 February, not to some day count
 * from it. Month arithmetic clamps to the last day of the target month,
 * which is the ordinary reading and the one that never invents a 31st.
 */

import type { FormData } from '@/types';
import type { Navmc10132PunishmentEntry, Navmc10132Suspension } from '@/types/navmc';
import { resolvePunishment } from '@/lib/navmc10132-utils';

/** MCM Part V para 6.a(2). Months, because the order says months. */
export const SUSPENSION_MAX_MONTHS = 6;

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
    return null;
  }
  return { y, m, d };
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Days in a month, 1-indexed month. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * `iso` plus `months` calendar months, clamped to the last day of the target
 * month. 31 Aug plus 6 months is 28 Feb (29 in a leap year), never 31 Feb
 * rolled forward into March.
 */
export function addMonths(iso: string, months: number): string | null {
  const parts = parseIso(iso);
  if (parts === null || !Number.isFinite(months)) return null;
  const total = parts.m - 1 + Math.trunc(months);
  const year = parts.y + Math.floor(total / 12);
  const month = (total % 12 + 12) % 12 + 1;
  const day = Math.min(parts.d, daysInMonth(year, month));
  return toIso(new Date(Date.UTC(year, month - 1, day)));
}

/** `iso` plus a whole number of days. */
export function addDays(iso: string, days: number): string | null {
  const parts = parseIso(iso);
  if (parts === null || !Number.isFinite(days)) return null;
  const base = Date.UTC(parts.y, parts.m - 1, parts.d);
  return toIso(new Date(base + Math.trunc(days) * 86400000));
}

/**
 * Which way a real-world condition moves the actual suspension end date
 * away from `endsOnIfUninterrupted`.
 *
 * 'later': the condition INTERRUPTS (tolls) the running of the period —
 * JAGMAN 0118.c's word is "interrupted" — so the real end date is later
 * than computed.
 *
 * 'earlier': the condition TERMINATES the period outright — MCM 6.a(2)'s
 * word is "terminates" — so the real end date is earlier than computed.
 */
export type SuspensionAssumptionDirection = 'later' | 'earlier';

/**
 * One condition, unmodeled by this app, that the computed suspension end
 * date silently assumes will not occur.
 *
 * SHAPE RATIONALE. A single prose caveat (what this module used to emit)
 * can only be read, not reasoned about: a UI that wants to render the three
 * conditions as a list has to parse a sentence, and a reviewer checking
 * whether a lengthening condition got worded as a shortening one — the
 * exact failure this module exists to prevent, see the module docstring —
 * has to read prose carefully rather than compare a value. `direction` is
 * therefore a closed union, not free text, so both a renderer and a test can
 * key off it directly. `id` is a stable, non-prose key for the same reason:
 * a test asserting "the enlistment condition is 'earlier'" should not have
 * to match against the exact English sentence, which is free to be reworded
 * for clarity without breaking anything that depends on the direction being
 * correct.
 */
export interface SuspensionAssumption {
  id: 'unauthorized-absence' | 'vacation-proceedings-commenced' | 'enlistment-expiration';
  /** The event, in plain language. */
  condition: string;
  direction: SuspensionAssumptionDirection;
  citation: string;
  /** One sentence stating the effect, direction-first, for prose rendering. */
  effect: string;
}

/**
 * The three conditions this app cannot see, in citation order: both JAGMAN
 * 0118.c interruptions, then the MCM 6.a(2) termination. Order is citation
 * order, not severity or likelihood — there is no basis in either source
 * for ranking them.
 */
export const SUSPENSION_ASSUMPTIONS: readonly SuspensionAssumption[] = [
  {
    id: 'unauthorized-absence',
    condition: "the probationer's unauthorized absence",
    direction: 'later',
    citation: 'JAGMAN (JAGINST 5800.7G CH-2) para 0118.c',
    effect:
      "Unauthorized absence interrupts the running of the period, so it can push the real end date LATER than this one.",
  },
  {
    id: 'vacation-proceedings-commenced',
    condition: 'commencement of proceedings to vacate the suspension',
    direction: 'later',
    citation: 'JAGMAN (JAGINST 5800.7G CH-2) para 0118.c',
    effect:
      'Commencing proceedings to vacate the suspension interrupts the running of the period, so it can push the real end date LATER than this one.',
  },
  {
    id: 'enlistment-expiration',
    condition: 'expiration of the current enlistment or term of service (EAS)',
    direction: 'earlier',
    citation: 'MCM Part V para 6.a(2)',
    effect:
      'Expiration of the current enlistment automatically terminates the suspension, so it can make the real end date EARLIER than this one. The form carries no EAS field for the app to check.',
  },
];

/** One rendered sentence per assumption, direction-first, in citation order. */
function renderAssumptions(assumptions: readonly SuspensionAssumption[]): string {
  return assumptions.map((a) => `${a.effect} (${a.citation})`).join(' ');
}

/**
 * The prose form of `SUSPENSION_ASSUMPTIONS` anchored to a computed end
 * date, for callers that want a single string rather than the structured
 * list. Deliberately does NOT say "no earlier than" or "at least" — see the
 * module docstring for why that framing is wrong.
 */
export function suspensionAssumptionsCaveat(endsOnIfUninterrupted: string): string {
  return (
    `This date, ${endsOnIfUninterrupted}, holds only if nothing interrupts or terminates the ` +
    `suspension first. ${renderAssumptions(SUSPENSION_ASSUMPTIONS)} If none of these occur, MCM ` +
    `Part V para 6.a(3) remits the suspended punishment without further action on ` +
    `${endsOnIfUninterrupted}, and there is nothing left to vacate after that date.`
  );
}

export interface SuspensionPeriod {
  /**
   * This suspension's own position in item 7's `suspensions` array. NOT the
   * same thing as `punishmentIndex` below, and must not be confused with
   * it: nothing in this app forbids two item-7 suspensions from naming the
   * same `punishmentIndex` (`suspensionIndexBoundsIssues` checks bounds
   * only, never uniqueness), so `punishmentIndex` cannot be used to find
   * "the one suspension a caller means" — only `suspensionIndex` can.
   * `vacationHandoff` receives a suspension's index as its own parameter
   * for exactly this reason; match against this field, never against
   * `punishmentIndex`.
   */
  suspensionIndex: number;
  /** Index into item 6 that item 7 suspends. */
  punishmentIndex: number;
  /** The punishment code, for messages. */
  code: string;
  /** The period as the clerk stated it, e.g. "6 months" or "45 days". */
  stated: string;
  /**
   * The date the suspension ends IF nothing interrupts or terminates it
   * first — see SUSPENSION_ASSUMPTIONS. On this date, and only if none of
   * those three conditions occurred, MCM 6.a(3) remits the suspended
   * punishment automatically unless it has been vacated first. Null when
   * the period or the NJP date is unreadable.
   */
  endsOnIfUninterrupted: string | null;
  /** The latest lawful end date under 6.a(2). Null when the date is unreadable. */
  latestLawfulEnd: string | null;
  /** True when `endsOnIfUninterrupted` is past `latestLawfulEnd`. */
  exceedsSixMonths: boolean;
}

function suspensionEntries(formData: FormData): Navmc10132Suspension[] {
  return Array.isArray(formData.suspensions)
    ? (formData.suspensions as Navmc10132Suspension[])
    : [];
}

function punishmentEntries(formData: FormData): Navmc10132PunishmentEntry[] {
  return Array.isArray(formData.punishments)
    ? (formData.punishments as Navmc10132PunishmentEntry[])
    : [];
}

/**
 * Every suspension in item 7, with the date it ends if uninterrupted and
 * whether that date is over the statutory cap.
 *
 * The suspension runs from the date the punishment was imposed, item 6,
 * because item 7 suspends punishment awarded at that same proceeding. There
 * is no separate suspension date on the form and there should not be one.
 */
export function suspensionPeriods(formData: FormData): SuspensionPeriod[] {
  const njpDate = typeof formData.punishmentDate === 'string' ? formData.punishmentDate.trim() : '';
  const punishments = punishmentEntries(formData);
  const latestLawfulEnd = addMonths(njpDate, SUSPENSION_MAX_MONTHS);

  return suspensionEntries(formData).map((suspension, suspensionIndex) => {
    const entry = punishments[suspension.punishmentIndex];
    const code = entry ? resolvePunishment(entry.code)?.code ?? entry.code ?? '' : '';

    const monthsText = (suspension.months ?? '').trim();
    const daysText = (suspension.days ?? '').trim();

    let stated = '';
    let endsOnIfUninterrupted: string | null = null;

    if (monthsText !== '') {
      const months = Number(monthsText);
      stated = `${monthsText} month${months === 1 ? '' : 's'}`;
      endsOnIfUninterrupted = Number.isFinite(months) && months > 0 ? addMonths(njpDate, months) : null;
    } else if (daysText !== '') {
      const days = Number(daysText);
      stated = `${daysText} day${days === 1 ? '' : 's'}`;
      endsOnIfUninterrupted = Number.isFinite(days) && days > 0 ? addDays(njpDate, days) : null;
    }

    return {
      suspensionIndex,
      punishmentIndex: suspension.punishmentIndex,
      code,
      stated,
      endsOnIfUninterrupted,
      latestLawfulEnd,
      exceedsSixMonths:
        endsOnIfUninterrupted !== null &&
        latestLawfulEnd !== null &&
        endsOnIfUninterrupted > latestLawfulEnd,
    };
  });
}

export interface SuspensionPeriodFinding {
  id: string;
  citation: string;
  rule: string;
  detail: string;
}

/**
 * Suspensions running longer than MCM Part V para 6.a(2) allows.
 *
 * `id` IS KEYED ON suspensionIndex, NOT punishmentIndex. Nothing forbids
 * two item-7 suspensions from naming the same punishmentIndex, so keying
 * on punishmentIndex would let two over-limit suspensions against the same
 * punishment produce the SAME finding id — and downstream, the same
 * `ValidationIssue.id` (navmc10132-validators-punishment.ts wraps this as
 * `navmc10132-v22-${id}`). Components render validation lists with
 * `key={issue.id}` (ComplianceDialog.tsx, PackageDialog.tsx), so a
 * duplicate id does not just look odd in a log — React silently drops one
 * of the two issues from the screen. suspensionIndex is unique across the
 * array by construction; punishmentIndex is not.
 */
export function suspensionPeriodFindings(formData: FormData): SuspensionPeriodFinding[] {
  return suspensionPeriods(formData)
    .filter((period) => period.exceedsSixMonths)
    .map((period) => ({
      id: `suspension-over-six-months-${period.suspensionIndex}`,
      citation: 'MCM Part V para 6.a(2)',
      rule: `The suspension of ${period.code || 'the item 6 punishment'} runs to ${period.endsOnIfUninterrupted}, past the ${SUSPENSION_MAX_MONTHS}-month limit.`,
      detail:
        `Item 7 suspends ${period.code || 'a punishment'} for ${period.stated}, which from the ` +
        `item 6 date runs to ${period.endsOnIfUninterrupted}. A suspension may not exceed ` +
        `${SUSPENSION_MAX_MONTHS} months from the date of the suspension, so the latest lawful ` +
        `end is ${period.latestLawfulEnd}. Shorten the period.`,
    }));
}

/**
 * Suspensions with a computable `endsOnIfUninterrupted`, i.e. every
 * suspension W-17 has something concrete to warn about. Exported so the
 * validator layer (navmc10132-validators-punishment.ts, W-17) does not have
 * to re-derive "has a computed date" from `suspensionPeriods` itself.
 */
export function suspensionsWithComputedEnd(
  formData: FormData,
): (SuspensionPeriod & { endsOnIfUninterrupted: string })[] {
  return suspensionPeriods(formData).filter(
    (period): period is SuspensionPeriod & { endsOnIfUninterrupted: string } =>
      period.endsOnIfUninterrupted !== null,
  );
}

/**
 * The date by which a vacation must be executed, and what happens after it.
 *
 * This is the deadline the vacation notice exists to beat. MCM 6.a(3) remits
 * a suspended punishment "without further action" when the period ends, so a
 * notice served after `endsOnIfUninterrupted` acts on a punishment that no
 * longer exists — PROVIDED the date held, which is exactly what
 * `assumptions` and `caveat` qualify.
 */
export interface VacationDeadline {
  /**
   * This suspension's own position in item 7's `suspensions` array. Match
   * a specific suspension against THIS field, never against
   * `punishmentIndex` — see the identical note on `SuspensionPeriod`.
   */
  suspensionIndex: number;
  punishmentIndex: number;
  code: string;
  endsOnIfUninterrupted: string;
  /**
   * The three conditions this app cannot see, machine-readable so a caller
   * can render them as a list, filter by direction, or check citations,
   * rather than parsing `caveat`. See SuspensionAssumption for the shape
   * rationale.
   */
  assumptions: readonly SuspensionAssumption[];
  /** Always populated. Prose form of `assumptions`, anchored to `endsOnIfUninterrupted`. */
  caveat: string;
}

export function vacationDeadlines(formData: FormData): VacationDeadline[] {
  return suspensionsWithComputedEnd(formData).map((period) => ({
    suspensionIndex: period.suspensionIndex,
    punishmentIndex: period.punishmentIndex,
    code: period.code,
    endsOnIfUninterrupted: period.endsOnIfUninterrupted,
    assumptions: SUSPENSION_ASSUMPTIONS,
    caveat: suspensionAssumptionsCaveat(period.endsOnIfUninterrupted),
  }));
}
