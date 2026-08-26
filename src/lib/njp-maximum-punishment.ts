/**
 * The maximum punishment an NJP authority could impose, for A-1-d
 * paragraph 3.
 *
 * A-1-d prints "The maximum punishment that could be imposed if you accept
 * NJP is:" over four blank rules. That ceiling is not a fixed sentence. It
 * varies with ONE thing, the grade of the officer who will impose it, which
 * is what the fleet means by the "type" of NJP: company grade office hours
 * versus field grade office hours. MCM Part V para 5.b(2)(A) sets the
 * company-grade ceiling and 5.b(2)(B) the field-grade one, and the
 * difference between them is large enough that printing the wrong one on a
 * refusal advisement misinforms the decision the form exists to inform.
 *
 * WHY THIS IS COMPUTED AND NOT TYPED. It was a hand fill-in through
 * 2026-08-23. Reversed on 2026-08-24 (Stephen), after seeing a rendered
 * A-1-d with the rules blank. A ceiling left blank on the one paragraph
 * that carries the right to refuse is the paragraph doing no work.
 *
 * THREE GUARDS, none of which may be removed:
 *
 * 1. NOTHING IS PRINTED WHEN THE AUTHORITY GRADE IS UNKNOWN. Item 8A sits
 *    in a LATER section than the rights advisement, so an unset grade is
 *    the normal early state, not an error. resolveAuthorityLevel returns
 *    null and the rules print blank exactly as before. Guessing a level
 *    would print a company-grade ceiling over a field-grade case.
 *
 * 2. THIS IS A CEILING, NEVER AN IMPOSED PUNISHMENT. NjpRightsCase carries
 *    no finding and no punishment on purpose, and this module reads none.
 *    It reads the authority's grade and the accused's grade, nothing from
 *    item 6.
 *
 * 3. THE NUMBERS COME OFF THE CODE TABLE, not off this file. Every day
 *    count below is read from NAVMC_10132_PUNISHMENTS through
 *    authoritySatisfies, so the advisement and the item 6 picker can never
 *    disagree about a ceiling. Only the sentences are authored here.
 *
 * Sources, all read directly from the 2024 edition:
 *   MCM Part V para 5.b     - authorized maximum punishments
 *   MCM Part V para 5.d     - limitations on combination of punishments
 *   10 U.S.C. 815(b)(2)
 *   MCO 5800.16 Vol 14 para 010302.C - USMC reduction policy
 */

import {
  NAVMC_10132_PUNISHMENTS,
  NJP_AUTHORITY_LEVEL_LABEL,
  authoritySatisfies,
  punishmentFamily,
  resolveAuthorityLevel,
  type Navmc10132Punishment,
  type NjpAuthorityLevel,
  type PunishmentFamily,
} from '@/lib/navmc10132-punishments';

// Re-exported so the A-1-d generator, njp-package, and the existing tests keep
// one import site. The definitions themselves live in navmc10132-punishments.ts
// now, beside authoritySatisfies and the code table they read, because the item
// 6 picker needs the same level and must not import a JAGMAN appendix module to
// get it.
export { NJP_AUTHORITY_LEVEL_LABEL, resolveAuthorityLevel };
export type { NjpAuthorityLevel };
import {
  NAVMC_10132_REDUCTION_BAR_FLOOR,
  reductionBarred,
  type Navmc10132Service,
} from '@/lib/navmc10132-ranks';
import { wrapHanging } from '@/lib/jagman-a1-wrap';
import { operativeRung, type ForfeitureLadder } from '@/lib/navmc10132-forfeiture-ladder';

export interface MaximumPunishmentInput {
  /** Item 8A pay grade of the NJP authority, e.g. 'O5'. */
  authorityPayGrade: string;
  /** Item 19 pay grade of the accused, e.g. 'E3'. Empty when unknown. */
  accusedPayGrade: string;
  /** Item 19 service. Decides whether the USMC reduction bar applies. */
  accusedService?: Navmc10132Service;
  /**
   * The forfeiture ceilings priced for THIS accused, when the app can price
   * them. Optional, and absent is the ordinary case.
   *
   * STEPHEN, 2026-08-26: "We should list the max based on the rank and times
   * of service." The statutory ceiling alone tells an accused he faces "one-
   * half of one month's pay per month for two months", which is a fraction,
   * not a number. He is being asked to decide whether to refuse NJP and
   * demand a court-martial on the strength of that sentence, so the sentence
   * should carry the figure.
   *
   * ABSENT MEANS THE WORDS ALONE, never a guess. The ladder declines
   * whenever the pay table cannot be selected or the grade and length of
   * service are unset, and a dollar figure on a rights advisement that the
   * app cannot stand behind is worse than the fraction.
   */
  forfeiture?: ForfeitureLadder;
  /** Item 19's completed years, named in the priced sentence. Optional. */
  accusedYearsOfService?: string;
}

/** One printed element of the ceiling. `label` opens an enumerated item. */
export interface MaximumPunishmentBlock {
  kind: 'lead' | 'item' | 'tail' | 'source';
  label?: string;
  text: string;
}

export interface MaximumPunishment {
  level: NjpAuthorityLevel;
  blocks: MaximumPunishmentBlock[];
  /** Things deliberately left off the list, and why. Surfaced in the UI. */
  notes: string[];
}

/**
 * The families the enlisted ceiling is stated in. Membership comes from
 * punishmentFamily in navmc10132-punishments.ts, the same classifier the MCM
 * Part V para 5.d combination gates read, so the two rules can never disagree
 * about what counts as restriction.
 */
type Family = PunishmentFamily;

/**
 * Print order, following MCM Part V para 5.b(2)'s own order: correctional
 * custody, forfeiture, reduction, extra duties, restriction. Admonition and
 * reprimand are not in this list because 5.b states them in its opening
 * clause ("In addition to or in lieu of admonition or reprimand"), and the
 * lead sentence below reproduces that position rather than demoting them to
 * a numbered item.
 */
const FAMILY_ORDER: readonly Family[] = [
  'correctional-custody',
  'forfeiture-days-pay',
  'forfeiture-monthly',
  'reduction',
  'extra-duties',
  'restriction',
];

/**
 * Codes an authority at `level` may impose on an enlisted accused.
 *
 * Read through authoritySatisfies rather than off a level-to-code map, so a
 * change to a code's requiredAuthority moves it here automatically. Note
 * this is NOT filtered by releaseOneAvailable: a ceiling the app declines
 * to offer in item 6 is still a ceiling the commander may impose, and
 * understating the maximum on a refusal advisement is the one error this
 * paragraph cannot afford. N05 is the live case - withheld from the picker
 * pending spec D-10, but its 60 days are already covered by N14 and N15,
 * so nothing is double counted.
 */
function authorizedCodes(level: NjpAuthorityLevel): Navmc10132Punishment[] {
  const grade = level === 'field-grade' ? 'O5' : 'O3';
  return NAVMC_10132_PUNISHMENTS.filter((code) => {
    if (code.appliesTo === 'officer') return false;
    if (punishmentFamily(code.code) === null) return false;
    return authoritySatisfies(code.requiredAuthority, grade) === true;
  });
}

/** Highest day count any authorized code in `family` names, or null. */
function familyCap(codes: Navmc10132Punishment[], family: Family, key: 'maxDays' | 'maxDaysPay' | 'maxMonths'): number | null {
  const values = codes
    .filter((c) => punishmentFamily(c.code) === family)
    .map((c) => c[key])
    .filter((v): v is number => typeof v === 'number');
  return values.length === 0 ? null : Math.max(...values);
}

const LEAD =
  'In addition to or in lieu of a punitive admonition or reprimand, ' +
  'any or all of the following, in the amounts stated:';

/**
 * Builds the ceiling. Returns null when the authority grade is unreadable,
 * which is guard 1 above and is the normal state before item 8A is filled.
 */
/** Whole dollars with separators, as the advisement prints them. */
function money(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

/** "E3" as the pay table stores it, "E-3" as this appendix reads it. */
function hyphenated(payGrade: string): string {
  const match = /^E(\d)$/i.exec(payGrade.trim());
  return match ? `E-${match[1]}` : payGrade;
}

/**
 * "which at E-6 with 12 years of service is $2,371 per month", or empty.
 *
 * PRICED ON THE ACCUSED'S PRESENT GRADE, always, even where a reduction
 * would move the lawful basis. This sentence answers "what am I facing", and
 * at the moment the advisement is served no reduction has been imposed. The
 * reduced-grade figures follow in their own note, so the accused sees both
 * and neither is presented as the other.
 */
function forfeitureAt(
  ladder: ForfeitureLadder | undefined,
  pick: (rung: ForfeitureLadder['rungs'][number]) => number,
  suffix: string,
  yearsOfService: string,
): string {
  const present = ladder?.rungs[0];
  if (present === undefined) return '';
  const years = yearsOfService.trim();
  const grade = hyphenated(present.ceiling.payGrade);
  const at = years === ''
    ? `at ${grade}`
    : `at ${grade} with ${years} years of service`;
  return `, which ${at} is ${money(pick(present))}${suffix}`;
}

export function maximumPunishment(input: MaximumPunishmentInput): MaximumPunishment | null {
  const level = resolveAuthorityLevel(input.authorityPayGrade);
  if (level === null) return null;

  const codes = authorizedCodes(level);
  const notes: string[] = [];
  const items: string[] = [];

  // MCO 5800.16 Vol 14 para 010302.C, quoted verbatim from the order:
  // "Marines in the grade of E-6 or above and Sailors in the grade of E-7 or
  // above may not be reduced in paygrade."
  //
  // TWO SERVICES, TWO FLOORS. The bar is not one rule about Marines. It sets
  // a different floor for each service, and reading it as E-6 for everyone
  // both understates a Navy E-6's exposure (he MAY be reduced) and overstates
  // a Navy E-7's (he may not, but the ceiling would have said he could).
  // An unset service defaults to USMC, this being a NAVMC form. An unreadable
  // grade applies no bar, because a claim the app cannot support is worse
  // than a blank.
  const service: Navmc10132Service = input.accusedService ?? 'USMC';
  const barred = reductionBarred(input.accusedPayGrade, service);

  for (const family of FAMILY_ORDER) {
    switch (family) {
      case 'correctional-custody': {
        const days = familyCap(codes, family, 'maxDays');
        if (days !== null) {
          items.push(`Correctional custody for not more than ${days} consecutive days.`);
        }
        break;
      }
      case 'forfeiture-days-pay': {
        // Only stated at company grade. Once the field-grade monthly
        // forfeiture is authorized it subsumes this one, and listing both
        // would read as two separate forfeitures.
        const days = familyCap(codes, family, 'maxDaysPay');
        const monthly = familyCap(codes, 'forfeiture-monthly', 'maxMonths');
        if (days !== null && monthly === null) {
          const figure = forfeitureAt(
            input.forfeiture,
            (rung) => rung.ceiling.sevenDaysPay,
            '',
            input.accusedYearsOfService ?? '',
          );
          items.push(`Forfeiture of not more than ${days} days’ pay${figure}.`);
        }
        break;
      }
      case 'forfeiture-monthly': {
        const months = familyCap(codes, family, 'maxMonths');
        if (months !== null) {
          const figure = forfeitureAt(
            input.forfeiture,
            (rung) => rung.ceiling.halfMonthPay,
            ' per month',
            input.accusedYearsOfService ?? '',
          );
          items.push(
            'Forfeiture of not more than one-half of one month’s pay per ' +
              `month for ${months} months${figure}.`,
          );
        }
        break;
      }
      case 'reduction': {
        const has = codes.some((c) => punishmentFamily(c.code) === 'reduction');
        if (!has) break;
        if (barred) {
          const who = service === 'USN' ? 'Sailor' : 'Marine';
          const floor = NAVMC_10132_REDUCTION_BAR_FLOOR[service];
          notes.push(
            `Reduction is omitted from the ceiling: the accused is ${input.accusedPayGrade} and a ` +
              `${who} in the grade of E-${floor} or above may not be reduced in pay grade ` +
              '(MCO 5800.16 Vol 14 para 010302.C).',
          );
          break;
        }
        items.push(
          'Reduction to the next inferior pay grade, if that grade is within the ' +
            'promotion authority of the officer imposing the reduction or any officer ' +
            'subordinate to that officer.',
        );
        break;
      }
      case 'extra-duties': {
        const days = familyCap(codes, family, 'maxDays');
        if (days !== null) {
          items.push(
            'Extra duties, including fatigue or other duties, for not more than ' +
              `${days} consecutive days.`,
          );
        }
        break;
      }
      case 'restriction': {
        const days = familyCap(codes, family, 'maxDays');
        if (days !== null) {
          items.push(
            'Restriction to specified limits, with or without suspension from duty, ' +
              `for not more than ${days} consecutive days.`,
          );
        }
        break;
      }
    }
  }

  const extraDutyCap = familyCap(codes, 'extra-duties', 'maxDays');
  const custodyCap = familyCap(codes, 'correctional-custody', 'maxDays');

  // MCM Part V para 5.d. Only the two subparagraphs that bear on an enlisted
  // accused ashore are stated. 5.d(1) is arrest in quarters, an officer
  // punishment. 5.d(2) is vessel confinement, and the vessel case is served
  // A-1-c, which prints no ceiling at all because that accused cannot refuse.
  const tail: string[] = [];
  if (custodyCap !== null) {
    tail.push('Correctional custody may not be combined with restriction or extra duties.');
  }
  if (extraDutyCap !== null) {
    tail.push(
      'Restriction and extra duties may be combined to run concurrently, but the ' +
        `combination may not exceed ${extraDutyCap} days.`,
    );
  }
  tail.push(
    'Subject to those limits, all of the above may be imposed in a single case in ' +
      'the maximum amounts.',
  );

  /**
   * The reduced-grade figures, where a reduction is on the table.
   *
   * MCM Part V para 5.c(8) prices a forfeiture imposed WITH a reduction on
   * the grade reduced to, which is always the smaller figure. An accused
   * told only the present-grade number has been told the higher of two
   * ceilings and none of the reason it might be lower. Omitted entirely
   * where reduction is barred or where the ladder carries no reduced rung,
   * because there is then no second basis to state.
   */
  const reduced = input.forfeiture?.rungs.find((rung) => rung.reduced);

  /**
   * ONLY THE CEILINGS THIS AUTHORITY CAN ACTUALLY IMPOSE. The first version
   * printed both the monthly and the seven-day figure at the reduced grade
   * regardless of level, so a company-grade advisement offered a monthly
   * forfeiture no company-grade commander may impose, under a list that
   * correctly omitted it. The note now restates whichever forfeiture the
   * list above actually carries, and nothing else.
   */
  const restated: string[] = [];
  if (reduced !== undefined) {
    if (items.some((text) => text.includes('one-half of one month'))) {
      restated.push(`${money(reduced.ceiling.halfMonthPay)} per month`);
    }
    if (items.some((text) => /Forfeiture of not more than \d+ days/.test(text))) {
      restated.push(`${money(reduced.ceiling.sevenDaysPay)}`);
    }
  }

  const reductionNote: string =
    !barred && reduced !== undefined && restated.length > 0 &&
    items.some((text) => text.startsWith('Reduction'))
      ? 'If a reduction is imposed as well, the forfeiture must be computed on the grade ' +
        `reduced to (MCM Part V para 5.c(8)). At ${hyphenated(reduced.ceiling.payGrade)} the ` +
        `ceiling above is ${restated.join(' and ')}.`
      : '';

  // The pay table is named ONLY where a figure priced on it was printed. A
  // source line citing a table nothing was computed from would suggest the
  // words above carry a number they do not.
  const payTableSource =
    input.forfeiture !== undefined && input.forfeiture.rungs.length > 0
      ? ` Dollar figures computed by this app from the basic pay table ` +
        `effective ${input.forfeiture.payTable.effectiveFrom}, and are ceilings, ` +
        'not amounts imposed.'
      : '';

  const blocks: MaximumPunishmentBlock[] = [
    { kind: 'lead', text: LEAD },
    ...items.map((text, i) => ({ kind: 'item' as const, label: `(${i + 1}) `, text })),
    { kind: 'tail', text: tail.join(' ') },
    ...(reductionNote === '' ? [] : [{ kind: 'tail' as const, text: reductionNote }]),
    {
      kind: 'source',
      text:
        'Source: MCM, 2024 ed., Part V, paras 5.b(2) and 5.d, and ' +
        'MCO 5800.16 Vol 14 para 010302.C.' +
        payTableSource,
    },
  ];

  return { level, blocks, notes };
}

/**
 * The ceiling wrapped to a fixed-width column budget, ready for the fill
 * engine. Enumerated items hang under their own text rather than under the
 * number, matching how the offense list in paragraph 1 wraps.
 */
export function renderMaximumPunishment(
  input: MaximumPunishmentInput,
  width: number,
): string[] | null {
  const max = maximumPunishment(input);
  if (max === null) return null;

  // Enumerated items sit three columns in, the same indent paragraphs 1 and
  // 2 of the appendix give their own note blocks, so the list reads as a
  // list rather than as continuation prose under the lead sentence. The
  // lead, the combination limits, and the source line stay flush left with
  // the rest of paragraph 3.
  const ITEM_INDENT = '   ';

  const lines: string[] = [];
  max.blocks.forEach((block, index) => {
    // A blank line before the tail and before the source, so the list does
    // not run straight into the combination limits as one wall of text.
    if ((block.kind === 'tail' || block.kind === 'source') && index > 0) {
      lines.push('');
    }
    const indent = block.kind === 'item' ? ITEM_INDENT : '';
    const prefix = block.label ?? '';
    const budget = Math.max(width - indent.length, prefix.length + 1);
    lines.push(...wrapHanging(block.text, budget, prefix).map((l) => indent + l));
  });
  return lines;
}
