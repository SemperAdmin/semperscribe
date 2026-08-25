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
 * WHAT IS NOT ENFORCED, AND WHY. The second clause of 6.a(2) terminates a
 * suspension early at the expiration of the current enlistment. The NAVMC
 * 10132 carries no EAS field and neither does this app, so the app cannot
 * see it. Every result therefore names the EAS caveat rather than implying
 * the computed date is unconditional. Do not remove that note without adding
 * the field.
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

export interface SuspensionPeriod {
  /** Index into item 6 that item 7 suspends. */
  punishmentIndex: number;
  /** The punishment code, for messages. */
  code: string;
  /** The period as the clerk stated it, e.g. "6 months" or "45 days". */
  stated: string;
  /**
   * The date the suspension ends. On this date MCM 6.a(3) remits the
   * suspended punishment automatically unless it has been vacated first.
   * Null when the period or the NJP date is unreadable.
   */
  endsOn: string | null;
  /** The latest lawful end date under 6.a(2). Null when the date is unreadable. */
  latestLawfulEnd: string | null;
  /** True when `endsOn` is past `latestLawfulEnd`. */
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
 * Every suspension in item 7, with the date it ends and whether it is over
 * the statutory cap.
 *
 * The suspension runs from the date the punishment was imposed, item 6,
 * because item 7 suspends punishment awarded at that same proceeding. There
 * is no separate suspension date on the form and there should not be one.
 */
export function suspensionPeriods(formData: FormData): SuspensionPeriod[] {
  const njpDate = typeof formData.punishmentDate === 'string' ? formData.punishmentDate.trim() : '';
  const punishments = punishmentEntries(formData);
  const latestLawfulEnd = addMonths(njpDate, SUSPENSION_MAX_MONTHS);

  return suspensionEntries(formData).map((suspension) => {
    const entry = punishments[suspension.punishmentIndex];
    const code = entry ? resolvePunishment(entry.code)?.code ?? entry.code ?? '' : '';

    const monthsText = (suspension.months ?? '').trim();
    const daysText = (suspension.days ?? '').trim();

    let stated = '';
    let endsOn: string | null = null;

    if (monthsText !== '') {
      const months = Number(monthsText);
      stated = `${monthsText} month${months === 1 ? '' : 's'}`;
      endsOn = Number.isFinite(months) && months > 0 ? addMonths(njpDate, months) : null;
    } else if (daysText !== '') {
      const days = Number(daysText);
      stated = `${daysText} day${days === 1 ? '' : 's'}`;
      endsOn = Number.isFinite(days) && days > 0 ? addDays(njpDate, days) : null;
    }

    return {
      punishmentIndex: suspension.punishmentIndex,
      code,
      stated,
      endsOn,
      latestLawfulEnd,
      exceedsSixMonths:
        endsOn !== null && latestLawfulEnd !== null && endsOn > latestLawfulEnd,
    };
  });
}

export interface SuspensionPeriodFinding {
  id: string;
  citation: string;
  rule: string;
  detail: string;
}

/** Suspensions running longer than MCM Part V para 6.a(2) allows. */
export function suspensionPeriodFindings(formData: FormData): SuspensionPeriodFinding[] {
  return suspensionPeriods(formData)
    .filter((period) => period.exceedsSixMonths)
    .map((period) => ({
      id: `suspension-over-six-months-${period.punishmentIndex}`,
      citation: 'MCM Part V para 6.a(2)',
      rule: `The suspension of ${period.code || 'the item 6 punishment'} runs to ${period.endsOn}, past the ${SUSPENSION_MAX_MONTHS}-month limit.`,
      detail:
        `Item 7 suspends ${period.code || 'a punishment'} for ${period.stated}, which from the ` +
        `item 6 date runs to ${period.endsOn}. A suspension may not exceed ` +
        `${SUSPENSION_MAX_MONTHS} months from the date of the suspension, so the latest lawful ` +
        `end is ${period.latestLawfulEnd}. Shorten the period.`,
    }));
}

/**
 * The date by which a vacation must be executed, and what happens after it.
 *
 * This is the deadline the vacation notice exists to beat. MCM 6.a(3) remits
 * a suspended punishment "without further action" when the period ends, so a
 * notice served after `endsOn` acts on a punishment that no longer exists.
 */
export interface VacationDeadline {
  punishmentIndex: number;
  code: string;
  endsOn: string;
  /** Always populated. Names the EAS caveat the app cannot see. */
  caveat: string;
}

export function vacationDeadlines(formData: FormData): VacationDeadline[] {
  return suspensionPeriods(formData)
    .filter((period): period is SuspensionPeriod & { endsOn: string } => period.endsOn !== null)
    .map((period) => ({
      punishmentIndex: period.punishmentIndex,
      code: period.code,
      endsOn: period.endsOn,
      caveat:
        `Vacate on or before ${period.endsOn}. On that date the suspended punishment is ` +
        'remitted without further action (MCM Part V para 6.a(3)), and there is nothing left ' +
        'to vacate. The date assumes the enlistment runs at least that long: expiration of the ' +
        'current enlistment terminates a suspension early (6.a(2)), and the form carries no EAS ' +
        'field for the app to check.',
    }));
}
