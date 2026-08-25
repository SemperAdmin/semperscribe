/**
 * MCM Part V para 5.d, limitations on combination of punishments.
 *
 * THE GAP THIS CLOSES. Since 2026-08-24 the app PRINTS these rules on the
 * A-1-d rights advisement, telling a Marine deciding whether to refuse NJP
 * exactly what may and may not be combined. It enforced none of them in item
 * 6, so a set the advisement had just called unlawful passed export without a
 * word. Printing a rule and not checking it is worse than doing neither,
 * because the printed sentence reads as an assurance.
 *
 * THE PARAGRAPH, quoted verbatim from the 2024 edition:
 *
 *   (1) Arrest in quarters may not be imposed in combination with
 *       restriction;
 *   (2) Confinement may not be imposed in combination with correctional
 *       custody, extra duties, or restriction;
 *   (3) Correctional custody may not be imposed in combination with
 *       restriction or extra duties;
 *   (4) Restriction and extra duties may be combined to run concurrently,
 *       but the combination may not exceed the maximum imposable for extra
 *       duties;
 *   (5) Subject to the limits in subparagraphs 5d(1) through (4) all
 *       authorized punishments may be imposed in a single case in the
 *       maximum amounts.
 *
 * TWO KINDS OF RULE, AND THEY FAIL DIFFERENTLY. Subparagraphs (1) to (3) are
 * FLAT PROHIBITIONS: two families may not appear together, and no number is
 * involved, so they are checkable whatever else the form does or does not
 * carry. Subparagraph (4) is a NUMERIC CAP, and the number it caps against is
 * the extra-duty maximum, which depends on the imposing officer's grade. When
 * item 8A is unreadable the cap stays silent while the prohibitions still
 * fire, the same discipline the forfeiture ceiling uses: never block on a
 * figure the app cannot stand behind, always block on a rule that needs no
 * figure.
 *
 * THE AGGREGATE RULE IS NOT IN 5.d AT ALL, and it is the one the app's own
 * test data tripped. MCM Part V para 5.b sets each maximum per CASE, not per
 * award: "extra duties ... for not more than 14 consecutive days" is a
 * ceiling on the punishment, and two awards of ten days each is twenty days
 * of extra duty in one case. Per-code input clamping cannot see the total, so
 * it is checked here across every entry in a family.
 *
 * CONCURRENCY IS ARITHMETIC HERE, NOT A SEPARATE RULE. 5.d(4) caps "the
 * combination", so restriction and extra duties running concurrently combine
 * to the longer of the two, and running consecutively they combine to their
 * sum. One comparison covers both, which is why this module reads
 * `punishmentsConcurrent` rather than demanding it be set.
 */

import {
  punishmentFamily,
  resolvePunishment,
  resolveAuthorityLevel,
  type PunishmentFamily,
} from '@/lib/navmc10132-punishments';
import type { Navmc10132PunishmentEntry } from '@/types/navmc';

/** A family present in item 6, with its total days and the entries behind it. */
export interface FamilyTotal {
  family: PunishmentFamily;
  /** Codes contributing, in item 6 order. */
  codes: string[];
  /** Total days across every entry, 0 where the family names no days. */
  days: number;
  /** True when any contributing entry left its day count unreadable. */
  incomplete: boolean;
  /** Lowest ceiling in days this family's authorised codes allow, or null. */
  ceiling: number | null;
}

export interface CombinationFinding {
  /** Stable suffix for the validator's issue id. */
  id: string;
  /** The subparagraph or paragraph relied on. */
  citation: string;
  /** One sentence stating what is wrong. */
  rule: string;
  /** What to do about it. */
  detail: string;
}

/**
 * Pairs 5.d forbids outright, as [family, forbidden-with]. Written as the
 * order states them rather than collapsed into a matrix, so each entry can be
 * read straight against the paragraph it comes from.
 */
const FORBIDDEN_PAIRS: ReadonlyArray<{
  subparagraph: string;
  a: PunishmentFamily;
  b: PunishmentFamily;
}> = [
  { subparagraph: '5.d(1)', a: 'arrest-in-quarters', b: 'restriction' },
  { subparagraph: '5.d(2)', a: 'confinement', b: 'correctional-custody' },
  { subparagraph: '5.d(2)', a: 'confinement', b: 'extra-duties' },
  { subparagraph: '5.d(2)', a: 'confinement', b: 'restriction' },
  { subparagraph: '5.d(3)', a: 'correctional-custody', b: 'restriction' },
  { subparagraph: '5.d(3)', a: 'correctional-custody', b: 'extra-duties' },
];

/** Plain-language name for a family, for messages the clerk reads. */
const FAMILY_LABEL: Readonly<Record<PunishmentFamily, string>> = {
  admonition: 'an admonition or reprimand',
  'arrest-in-quarters': 'arrest in quarters',
  confinement: 'confinement',
  'correctional-custody': 'correctional custody',
  'extra-duties': 'extra duties',
  'forfeiture-days-pay': 'a forfeiture',
  'forfeiture-monthly': 'a forfeiture',
  reduction: 'a reduction',
  restriction: 'restriction',
};

function readDays(entry: Navmc10132PunishmentEntry): number | null {
  const raw = (entry.days ?? '').trim();
  if (raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * Item 6 grouped by family, with day totals and the ceiling each family may
 * reach at this authority's grade.
 *
 * The ceiling is the LOWEST of the contributing codes' own maxDays, not the
 * highest. A set carrying only N09 is capped at 14 even under a field-grade
 * commander who could have used N13, because the code actually imposed is
 * what the record says was imposed.
 */
export function familyTotals(
  entries: readonly Navmc10132PunishmentEntry[],
): Map<PunishmentFamily, FamilyTotal> {
  const totals = new Map<PunishmentFamily, FamilyTotal>();

  entries.forEach((entry) => {
    const code = resolvePunishment(entry.code);
    if (!code) return;
    const family = punishmentFamily(code.code);
    if (family === null) return;

    const existing = totals.get(family) ?? {
      family,
      codes: [],
      days: 0,
      incomplete: false,
      ceiling: null,
    };

    existing.codes.push(code.code);

    if (code.parameters.includes('days')) {
      const days = readDays(entry);
      if (days === null) existing.incomplete = true;
      else existing.days += days;
    }

    if (typeof code.maxDays === 'number') {
      existing.ceiling =
        existing.ceiling === null ? code.maxDays : Math.min(existing.ceiling, code.maxDays);
    }

    totals.set(family, existing);
  });

  return totals;
}

export interface CombinationInput {
  entries: readonly Navmc10132PunishmentEntry[];
  /** Item 8A pay grade. Empty or unreadable silences the numeric caps only. */
  authorityPayGrade: string;
  /** Item 6's own concurrency flag. Decides how 5.d(4) adds up. */
  concurrent: boolean;
}

/**
 * Every 5.d violation in this set, plus the per-case aggregate excesses.
 *
 * Returns findings rather than ValidationIssues so the rules stay testable
 * without the validator's plumbing, and so the caller owns the issue ids.
 */
export function combinationFindings(input: CombinationInput): CombinationFinding[] {
  const totals = familyTotals(input.entries);
  const findings: CombinationFinding[] = [];

  // --- Flat prohibitions. No ceiling needed, so no reason to stay silent. ---
  FORBIDDEN_PAIRS.forEach(({ subparagraph, a, b }) => {
    const first = totals.get(a);
    const second = totals.get(b);
    if (!first || !second) return;
    findings.push({
      id: `combination-${a}-${b}`,
      citation: `MCM Part V para ${subparagraph}`,
      rule: `${FAMILY_LABEL[a]} and ${FAMILY_LABEL[b]} may not be imposed together.`.replace(
        /^./,
        (c) => c.toUpperCase(),
      ),
      detail:
        `Item 6 carries ${first.codes.join(', ')} and ${second.codes.join(', ')}. ` +
        `${subparagraph} forbids that combination outright, whatever the days. Remove one of ` +
        'them.',
    });
  });

  // --- Per-case aggregate ceilings, MCM Part V para 5.b -------------------
  // A ceiling is stated per case, so two awards in one family add up. Skipped
  // where any contributing entry has no readable day count, because a partial
  // total understates the case and would clear a set that does not comply.
  totals.forEach((total) => {
    if (total.ceiling === null || total.incomplete) return;
    if (total.codes.length < 2) return; // one entry is already clamped at input
    if (total.days <= total.ceiling) return;
    findings.push({
      id: `combination-aggregate-${total.family}`,
      citation: 'MCM Part V para 5.b',
      rule: `${total.days} days of ${FAMILY_LABEL[total.family]} exceeds the ${total.ceiling}-day maximum for the case.`,
      detail:
        `Item 6 carries ${total.codes.join(' and ')}, totalling ${total.days} days. The maximum ` +
        'is a ceiling on the punishment in a single case, not on each award, so two awards add ' +
        'up. Reduce the total to ' +
        `${total.ceiling} days or fewer.`,
    });
  });

  // --- 5.d(4), the one numeric combination cap ----------------------------
  const restriction = totals.get('restriction');
  const extraDuties = totals.get('extra-duties');
  if (restriction && extraDuties && !restriction.incomplete && !extraDuties.incomplete) {
    // The cap is "the maximum imposable for extra duties", which turns on the
    // imposing officer's grade. Unreadable item 8A means the app cannot state
    // the number, so it says nothing rather than guessing one.
    const level = resolveAuthorityLevel(input.authorityPayGrade);
    const cap = extraDuties.ceiling;

    if (level !== null && cap !== null) {
      const combined = input.concurrent
        ? Math.max(restriction.days, extraDuties.days)
        : restriction.days + extraDuties.days;

      if (combined > cap) {
        findings.push({
          id: 'combination-restriction-extra-duties',
          citation: 'MCM Part V para 5.d(4)',
          rule: `Restriction and extra duties combine to ${combined} days, over the ${cap}-day maximum imposable for extra duties.`,
          detail:
            `Restriction runs ${restriction.days} days and extra duties ${extraDuties.days} days, ` +
            `${input.concurrent ? 'concurrently' : 'consecutively'}, so the combination is ` +
            `${combined} days. ` +
            (input.concurrent
              ? `Reduce the longer of the two to ${cap} days or fewer.`
              : 'Tick "Punishments run concurrently" if that is what the commander ordered, ' +
                `which makes the combination ${Math.max(restriction.days, extraDuties.days)} days, ` +
                'or reduce the days. 5.d(4) authorises this combination only to run concurrently.'),
        });
      }
    }
  }

  return findings;
}
