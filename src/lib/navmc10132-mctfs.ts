/**
 * MCTFS unit diary transaction statements for an NJP, built from the
 * NAVMC 10132's own data.
 *
 * SOURCE. MCTFSPRIUM paragraphs 70502 (forfeitures and fines), 70503
 * (non-judicial punishment information, TTC 268), 70504 (pay grade
 * corrections and NJP, TTC 320), 70507 (reduction, TTC 056), and 70508
 * (courts-martial and NJP statistical data, TTC 212), as supplied by
 * Stephen on 2026-08-24.
 *
 * SEMPERSCRIBE HAS NO MCTFS CONNECTION, and this module never pretends
 * otherwise. It formats statements for a human to read and type into the
 * unit diary. It touches no DOM, no clipboard, no network.
 *
 * THREE FACTS THAT MAKE THIS DERIVABLE RATHER THAN GUESSWORK:
 *
 * 1. The app's punishment code table IS MCTFS Table 19. TTC 212 note 4:
 *    "bytes 1-3 refer to MCTFS Table 19. Byte-1 of the punishment code
 *    indicates if the punishment is associated with a 'C' Courts-martial or
 *    'N' Non Judicial Punishment." N01 through N17 are exactly that.
 *
 * 2. Item 2's three election strings are BYTE-IDENTICAL to the PRIUM's own
 *    VESSEL OPTION CODES A, B, and C. The form's text and the transaction's
 *    text are the same sentences, so the option letter is a lookup, not an
 *    interpretation.
 *
 * 3. Byte 4 of a punishment code comes from item 7. TTC 212 note 4: "enter
 *    'Y' (yes) if the member was punished or 'N' (no) to indicate the
 *    punishment was suspended." Item 7 is already a 1:1 selection over item
 *    6, so every code's fourth byte is known.
 *
 * THE RULE THAT DECIDES WHICH TRANSACTION A PUNISHMENT GETS. PRIUM 70503
 * note 2: "Punishment that does not affect pay, pay grade, or any other
 * personnel data item may be reported with a history statement." So a
 * forfeiture takes TTC 283, a reduction takes TTC 056, and restriction,
 * extra duties, correctional custody, admonition, and reprimand take a HIST
 * statement. That is read off each code's own parameters rather than off a
 * list of code strings here, so a table change carries through.
 *
 * WHAT THIS MODULE REFUSES TO DO. It will not emit a truncated TTC 212.
 * That transaction holds three articles and four punishments, the form holds
 * five offence rows and item 6 can carry more, and silently filling slots
 * one to four would produce a statement that looks complete and understates
 * the record permanently (the 212 remark is retained in MCTFS). Overflow is
 * a blocker naming what will not fit, per Stephen's 2026-08-24 ruling.
 */

import type { FormData } from '@/types';
import type { Navmc10132PunishmentEntry, Navmc10132Suspension } from '@/types/navmc';
import { NAVMC_10132_DEMAND } from '@/types/navmc';
import { resolveArticle, resolvePunishment } from '@/lib/navmc10132-utils';

/** One transaction, ready to be read and typed. */
export interface MctfsStatement {
  /** Transaction and sequence, e.g. 'TTC 268 000'. */
  ttc: string;
  /** The statement exactly as it should be entered. */
  text: string;
  /** The PRIUM paragraph this comes from. */
  authority: string;
  /** Anything the clerk must know before entering it. */
  notes: string[];
}

export interface MctfsReport {
  statements: MctfsStatement[];
  /** Hard stops. Non-empty means do NOT enter what is below. */
  blockers: string[];
  /** Data the form does not carry yet. */
  missing: string[];
  /** Follow-on actions the PRIUM requires but this NJP does not itself report. */
  reminders: string[];
}

/** TTC 212 000 holds exactly this many of each. PRIUM 70508. */
export const TTC_212_MAX_ARTICLES = 3;
export const TTC_212_MAX_PUNISHMENTS = 4;

/**
 * Item 2 election to VESSEL OPTION CODE.
 *
 * The three PRIUM option descriptions and the three NAVMC_10132_DEMAND
 * strings are the same sentences, so this map is an identity between two
 * spellings of one fact. Compared against the constants rather than against
 * literal text, so a byte-level edit to the form's own wording breaks this
 * loudly at the type level instead of silently returning ''.
 */
export function vesselOptionCode(demand: string): 'A' | 'B' | 'C' | '' {
  switch (demand.trim()) {
    case NAVMC_10132_DEMAND.ACCEPT:
      return 'A';
    case NAVMC_10132_DEMAND.REFUSE:
      return 'B';
    case NAVMC_10132_DEMAND.VESSEL:
      return 'C';
    default:
      return '';
  }
}

/** Item 2 counsel opportunity to LAWYER OPTION CODE. PRIUM 70503. */
export function lawyerOptionCode(counselOpportunity: string): 'A' | 'B' | '' {
  const value = counselOpportunity.trim();
  if (value === 'have') return 'A';
  if (value === 'have not') return 'B';
  return '';
}

/** ISO YYYY-MM-DD to the PRIUM's 8-byte YYYYMMDD. '' when unreadable. */
export function mctfsDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  return match ? `${match[1]}${match[2]}${match[3]}` : '';
}

/**
 * A dollar figure in the PRIUM's own shape.
 *
 * PRIUM 70502.1: "Dollar amounts shall be reported by showing the actual
 * dollar figures followed by a decimal point and two zeros; for example,
 * 00018.00 to indicate 18 dollars. There must be leading zeros in the dollar
 * amount." The template already prints the ".00", so this returns the
 * zero-padded whole-dollar part alone.
 */
export function mctfsDollars(amount: number): string {
  return String(Math.trunc(Math.abs(amount))).padStart(5, '0');
}

/** Two-byte zero-padded count, for the MONTHS fields. */
function twoByte(value: number): string {
  return String(Math.trunc(Math.abs(value))).padStart(2, '0');
}

function str(formData: FormData, key: string): string {
  const value: unknown = formData[key];
  return typeof value === 'string' ? value.trim() : '';
}

function punishmentEntries(formData: FormData): Navmc10132PunishmentEntry[] {
  return Array.isArray(formData.punishments)
    ? (formData.punishments as Navmc10132PunishmentEntry[])
    : [];
}

function suspensionEntries(formData: FormData): Navmc10132Suspension[] {
  return Array.isArray(formData.suspensions)
    ? (formData.suspensions as Navmc10132Suspension[])
    : [];
}

/**
 * The set of item 6 indexes item 7 suspends. Byte 4 of every TTC 212
 * punishment code, and the TTC 283 / TTC 056 versus HIST branch, both read
 * from this.
 */
function suspendedIndexes(formData: FormData): Set<number> {
  return new Set(suspensionEntries(formData).map((s) => s.punishmentIndex));
}

/** The suspension period for one item 6 index, as the PRIUM wants it stated. */
function suspensionPeriod(formData: FormData, index: number): string {
  const found = suspensionEntries(formData).find((s) => s.punishmentIndex === index);
  if (!found) return '';
  if (found.months && found.months.trim() !== '') return `${twoByte(Number(found.months))} MO`;
  if (found.days && found.days.trim() !== '') return `${found.days.trim()} DAYS`;
  return '';
}

export interface GuiltyArticle {
  /** Row letter A through E. */
  row: string;
  /** MCTFS Table 18 value, the bare article number. */
  code: string;
  label: string;
}

export interface GuiltyArticleResult {
  /** Distinct article codes, in row order, ready for the ART slots. */
  articles: GuiltyArticle[];
  /** Guilty rows whose article label resolved to no MCTFS code. NEVER dropped. */
  unresolved: Array<{ row: string; label: string }>;
  /** Guilty rows folded into an earlier row carrying the same article code. */
  deduped: Array<{ row: string; label: string; sameAs: string }>;
}

/**
 * Articles the Marine was found GUILTY of, deduplicated, in row order.
 *
 * DEDUPLICATION IS NOT TIDYING, it buys slots. The article crosswalk is
 * MANY-TO-ONE by design (navmc10132-articles.ts): Art. 92 alone carries 22
 * form labels that all resolve to code 92. A case charging two different
 * Art. 92 offenses would otherwise spend two of TTC 212's three article
 * slots on the same number, and the statistical record gains nothing from
 * the repeat. The folded rows are reported back so the clerk sees what
 * happened rather than wondering why row C vanished.
 *
 * AN UNRESOLVED LABEL IS NEVER SILENTLY DROPPED. The offense dropdown is a
 * closed list, so a label with no code is a data error, and a guilty offense
 * disappearing from a permanently retained statistical record is the worst
 * outcome this module can produce.
 */
export function guiltyArticles(formData: FormData): GuiltyArticleResult {
  const rows: unknown = formData.offenses;
  const result: GuiltyArticleResult = { articles: [], unresolved: [], deduped: [] };
  if (!Array.isArray(rows)) return result;

  const letters = ['A', 'B', 'C', 'D', 'E'];
  const seen = new Map<string, string>();

  rows.forEach((raw, index) => {
    const record = (raw ?? {}) as Record<string, unknown>;
    const label = typeof record.articleLabel === 'string' ? record.articleLabel.trim() : '';
    if (label === '') return;
    if (record.finding !== 'Guilty') return;

    const row = letters[index] ?? String(index + 1);
    const article = resolveArticle(label);
    if (!article) {
      result.unresolved.push({ row, label });
      return;
    }

    const firstRow = seen.get(article.mctfsCode);
    if (firstRow !== undefined) {
      result.deduped.push({ row, label, sameAs: firstRow });
      return;
    }

    seen.set(article.mctfsCode, row);
    result.articles.push({ row, code: article.mctfsCode, label });
  });

  return result;
}

/**
 * Every TTC 212 punishment code, four bytes each.
 *
 * PRIUM 70508 note 3 is explicit that the slots are packed, not sparse:
 * "When reporting multiple punishments, do not skip any prompts for example
 * PUN1 (blank), PUN2 (blank), PUN3 N01, PUN4 N07." Note 2 says the same for
 * the article slots. So this returns a dense list and the caller fills from
 * slot 1.
 */
export function ttc212PunishmentCodes(formData: FormData): string[] {
  const suspended = suspendedIndexes(formData);
  return punishmentEntries(formData)
    .map((entry, index) => {
      const code = resolvePunishment(entry.code);
      if (!code) return '';
      // Byte 4: Y when the punishment was actually imposed, N when suspended.
      return `${code.code}${suspended.has(index) ? 'N' : 'Y'}`;
    })
    .filter((code) => code !== '');
}

/** Pads a slot list out to `count` blanks, since the prompts are positional. */
function slots(values: string[], count: number): string[] {
  const out = values.slice(0, count);
  while (out.length < count) out.push('');
  return out;
}

/**
 * Every statement this NJP requires, plus what is missing and what is
 * blocked.
 *
 * DOA AND ED. PRIUM 70508 fixes the Date of Action for TTC 212 as "the date
 * the Courts-martial or Nonjudicial Punishment is adjudged," which is item 6.
 * The same date is used for the other statements' DOA, and each ED is the
 * date the PRIUM names for that transaction, which is NOT always the same
 * date: a vacated forfeiture's ED is the date the suspension was vacated
 * (70502.g note 1), not the date of the NJP. Where the two can diverge the
 * statement carries a note saying so rather than quietly assuming.
 */
export function mctfsNjpStatements(formData: FormData): MctfsReport {
  const statements: MctfsStatement[] = [];
  const blockers: string[] = [];
  const missing: string[] = [];
  const reminders: string[] = [];

  const njpDate = mctfsDate(str(formData, 'punishmentDate'));
  const electionDate = mctfsDate(str(formData, 'electionDate'));
  const authorityEdipi = str(formData, 'njpAuthorityEdipi');
  const vesselOpt = vesselOptionCode(str(formData, 'demand'));
  const lawyerOpt = lawyerOptionCode(str(formData, 'counselOpportunity'));

  if (njpDate === '') missing.push('the item 6 punishment date, which is the DOA and the ED');
  if (vesselOpt === '') missing.push('the item 2 election, which sets VESSEL OPT');
  if (lawyerOpt === '') missing.push('the item 2 counsel opportunity, which sets LAWYER OPT');
  if (authorityEdipi === '') {
    missing.push(
      "the NJP authority's EDIPI (item 8B), required by TTC 212 and never blank or zeros",
    );
  }

  const articleResult = guiltyArticles(formData);
  const articles = articleResult.articles;
  const punishmentCodes = ttc212PunishmentCodes(formData);

  // A guilty offense the crosswalk cannot code is a BLOCKER, not a note.
  // The 212 remark is retained permanently, and entering it short one
  // article records the case as smaller than it was.
  articleResult.unresolved.forEach(({ row, label }) => {
    blockers.push(
      `Row ${row} ("${label}") carries a Guilty finding but resolves to no MCTFS article code. ` +
        'The offense dropdown is a closed list, so this is a data error. Fix item 1 before ' +
        'entering TTC 212.',
    );
  });

  if (articles.length === 0) {
    blockers.push(
      'No offense carries a Guilty finding, so there is no NJP to report. TTC 212 requires at ' +
        'least one punitive article (PRIUM 70508 note 2).',
    );
  }
  if (punishmentCodes.length === 0) {
    blockers.push(
      'Item 6 carries no punishment code. TTC 212 requires at least one punishment ' +
        '(PRIUM 70508 note 3).',
    );
  }

  // The capacity blockers. Named individually, because "too many offenses"
  // is not an instruction and "row D and row E will not fit" is.
  if (articles.length > TTC_212_MAX_ARTICLES) {
    const overflow = articles.slice(TTC_212_MAX_ARTICLES);
    blockers.push(
      `TTC 212 000 holds ${TTC_212_MAX_ARTICLES} punitive articles and this case has ` +
        `${articles.length}. These will not fit: ` +
        `${overflow.map((a) => `row ${a.row} (${a.label})`).join(', ')}. The PRIUM describes no ` +
        'continuation sequence, so decide which articles the statistical record carries before ' +
        'entering anything.',
    );
  }
  if (punishmentCodes.length > TTC_212_MAX_PUNISHMENTS) {
    const overflow = punishmentCodes.slice(TTC_212_MAX_PUNISHMENTS);
    blockers.push(
      `TTC 212 000 holds ${TTC_212_MAX_PUNISHMENTS} punishment codes and item 6 carries ` +
        `${punishmentCodes.length}. These will not fit: ${overflow.join(', ')}. The PRIUM ` +
        'describes no continuation sequence, so decide which punishments the statistical ' +
        'record carries before entering anything.',
    );
  }

  // --- TTC 268 000, the NJP itself -------------------------------------
  statements.push({
    ttc: 'TTC 268 000',
    text:
      `${njpDate || '[NJP DATE]'} NJP AWD VESSEL OPT ${vesselOpt || '[?]'} ` +
      `LAWYER OPT ${lawyerOpt || '[?]'} ED ${njpDate || '[NJP DATE]'} |`,
    authority: 'MCTFSPRIUM 70503',
    notes: [
      'The HIST statement on this entry should carry the statistical information and all ' +
        'punishment awarded (PRIUM 70503). Use the transcription aid block for that text.',
      'Do NOT also report TTC 053. A three-month promotion restriction posts AUTOMATICALLY ' +
        'when TTC 268 is reported (PRIUM 70503 note 1, 70702).',
      ...(electionDate !== '' && electionDate !== njpDate
        ? [
            `Item 2 was elected ${electionDate} and punishment imposed ${njpDate}. The ED on ` +
              'this entry is the NJP date, not the election date.',
          ]
        : []),
    ],
  });

  // --- TTC 212 000, the statistical record ------------------------------
  // Only the prompts that carry a value are printed. The prompts are
  // positional and the clerk steps through all of them, but printing
  // "ART3 " with nothing after it in a transcription aid invites someone to
  // type a stray character into an empty prompt. The note below says the
  // rest are left blank.
  const articleSlots = slots(
    articles.map((a) => a.code),
    Math.min(Math.max(articles.length, 1), TTC_212_MAX_ARTICLES),
  );
  const punishmentSlots = slots(
    punishmentCodes,
    Math.min(Math.max(punishmentCodes.length, 1), TTC_212_MAX_PUNISHMENTS),
  );

  statements.push({
    ttc: 'TTC 212 000',
    text:
      `${njpDate || '[NJP DATE]'} CM-NJP CD N CA-CO EDIPI ${authorityEdipi || '[EDIPI]'} ` +
      articleSlots.map((code, i) => `ART${i + 1} ${code}`).join(' ') +
      ' ' +
      punishmentSlots.map((code, i) => `PUN${i + 1} ${code}`).join(' ') +
      ' |',
    authority: 'MCTFSPRIUM 70508',
    notes: [
      "Byte 4 of each punishment code is Y when imposed and N when SUSPENDED (PRIUM 70508 " +
        'note 4). It is derived from item 7 here, so check item 7 before entering this.',
      'The CA-CO EDIPI must already be on the MCTFS master file. SemperScribe cannot verify ' +
        'that (PRIUM 70508 note 1).',
      'Slots are filled from the first prompt with no gaps (PRIUM 70508 notes 2 and 3). Any ' +
        'prompt after the last value shown is left blank.',
      ...articleResult.deduped.map(
        ({ row, label, sameAs }) =>
          `Row ${row} ("${label}") is the same punitive article as row ${sameAs} and shares its ` +
          'slot. The article crosswalk is many-to-one, so two labels can be one article.',
      ),
    ],
  });

  // --- TTC 212 001, one per victim --------------------------------------
  const victims: unknown = formData.victims;
  if (Array.isArray(victims)) {
    victims.forEach((raw, index) => {
      const record = (raw ?? {}) as Record<string, unknown>;
      const sex = typeof record.sex === 'string' ? record.sex.trim() : '';
      const race = typeof record.race === 'string' ? record.race.trim() : '';
      const ethnicity = typeof record.ethnicity === 'string' ? record.ethnicity.trim() : '';
      if (sex === '' && race === '' && ethnicity === '') return;
      statements.push({
        ttc: 'TTC 212 001',
        text:
          `${njpDate || '[NJP DATE]'} CM-NJP VICTIM SEQ [SEQ] NUM ${twoByte(index + 1)} ` +
          `SEX ${sex || 'U'} RACE ${race || 'U'} ETHNICITY ${ethnicity || 'U'} |`,
        authority: 'MCTFSPRIUM 70508',
        notes: [
          'SEQ must match the sequence on the member’s CM-NJP-STAT-212-RMK from the entry ' +
            'above. MCTFS assigns it, so SemperScribe cannot supply it (PRIUM 70508 note 1).',
          'Unknown sex, race, or ethnicity is reported as U, not left blank.',
        ],
      });
    });
  }

  // --- Punishment-effecting transactions --------------------------------
  const suspended = suspendedIndexes(formData);
  punishmentEntries(formData).forEach((entry, index) => {
    const code = resolvePunishment(entry.code);
    if (!code) return;

    const isSuspended = suspended.has(index);
    const period = suspensionPeriod(formData, index);
    const isForfeiture =
      code.parameters.includes('dollars') || code.parameters.includes('dollarsPerMonth');
    const isReduction = code.parameters.includes('gradeReducedTo');

    if (isReduction) {
      const target = (entry.gradeReducedTo ?? '').trim();
      if (isSuspended) {
        // PRIUM 70504.3. A suspended reduction changes no pay grade, so it is
        // a history statement and NOT a TTC 056.
        statements.push({
          ttc: 'TTC HIS 000',
          text:
            `HIST: NJP AWD ${njpDate || '[NJP DATE]'} REDUCED TO ${target || '[GRADE]'} ` +
            `SUSP FOR ${period || '[MONTHS] MO'} |`,
          authority: 'MCTFSPRIUM 70504.3',
          notes: [
            'A SUSPENDED reduction is reported as history only. Do not report TTC 056 for it, ' +
              'because no pay grade has changed.',
            'If the suspension is later vacated, report TTC HIS 000 HIST: VACATION OF SUSP ' +
              'REDUCED NJP AWD (date vacated) and then the TTC 056 (PRIUM 70504.4).',
          ],
        });
      } else {
        statements.push({
          ttc: 'TTC 056 000',
          text:
            `${njpDate || '[NJP DATE]'} REDUCED ${target || '[GRADE]'} DOR ` +
            `${njpDate || '[DOR]'} ED ${njpDate || '[NJP DATE]'} | HIST: [CO’S LETTER INFO] |`,
          authority: 'MCTFSPRIUM 70507.4',
          notes: [
            'The pay grade field is 6 bytes. SemperScribe supplies the rank abbreviation item 6 ' +
              'recorded; confirm your unit diary expects the abbreviation rather than the grade.',
            'DOR is the date of rank for the grade reduced to. It is defaulted to the NJP date ' +
              'here, which is the usual case, but check it.',
            'JEPES marks must be reported on reductions of Corporals and below (PRIUM 70504 note).',
          ],
        });
      }
      return;
    }

    if (isForfeiture) {
      const perMonth = Number((entry.dollarsPerMonth ?? entry.dollars ?? '').trim());

      // MONTHS IS NOT DEFAULTED TO 1 WHERE THE CODE HAS A MONTHS PARAMETER.
      // N07 is a single forfeiture of days' pay and genuinely reports one
      // month. N04 is a per-month forfeiture and its month count is a real
      // input; assuming 1 there would print a TOTAL equal to one month's
      // deduction on a two-month punishment, understating the forfeiture by
      // half in a transaction that moves money.
      const needsMonths = code.parameters.includes('months');
      const rawMonths = (entry.months ?? '').trim();
      const months = needsMonths ? Number(rawMonths) : 1;

      const validAmount = Number.isFinite(perMonth) && perMonth > 0;
      const validMonths = Number.isFinite(months) && months > 0;
      const valid = validAmount && validMonths;

      if (!validAmount) {
        missing.push(`the dollar amount for ${code.code}, needed for TTC 283 003`);
      }
      if (needsMonths && !validMonths) {
        missing.push(
          `the number of months for ${code.code}. TTC 283 003 reports a monthly figure and a ` +
            'TOTAL, and the total cannot be computed without it.',
        );
      }

      if (isSuspended) {
        // PRIUM 70502.f. A wholly suspended forfeiture is history only.
        statements.push({
          ttc: 'TTC HIS 000',
          text:
            `HIST: NJP AWD ${njpDate || '[NJP DATE]'} FORF $${valid ? mctfsDollars(perMonth) : '[AMT]'}` +
            `.00 FOR ${valid ? twoByte(months) : '[MO]'} MO SUSPENDED FOR ${period || '[MONTHS] MO'} |`,
          authority: 'MCTFSPRIUM 70502.f',
          notes: [
            'A suspended forfeiture is reported with a history statement only. Do not report ' +
              'TTC 283 003 for it.',
            'If it is PARTIALLY suspended, report the unsuspended portion with TTC 283 003 and ' +
              'the suspended portion with this history statement.',
            'If the suspension is later vacated, report TTC 283 004 VACATE FORF, with the ED as ' +
              'the date the forfeiture was vacated (PRIUM 70502.g note 1).',
          ],
        });
      } else {
        statements.push({
          ttc: 'TTC 283 003',
          text:
            `${njpDate || '[NJP DATE]'} FORF $${valid ? mctfsDollars(perMonth) : '[AMT]'}.00 FOR ` +
            `${valid ? twoByte(months) : '[MO]'} MO NJP TOTAL $` +
            `${valid ? mctfsDollars(perMonth * months) : '[TOTAL]'}.00 ED ${njpDate || '[NJP DATE]'} |`,
          authority: 'MCTFSPRIUM 70502.a',
          notes: [
            'Forfeiture takes effect when imposed, so the ED is the NJP date (JAGMAN 0113.a).',
            'To mitigate it later, report TTC 318 001 FORF RED TO. To remit it entirely, report ' +
              'TTC 315 001 FORF RED TO NONE NJP.',
          ],
        });
      }
      return;
    }

    // PRIUM 70503 note 2. Restriction, extra duties, correctional custody,
    // admonition, and reprimand touch no pay or personnel data item, so they
    // ride the history statement rather than an action transaction.
    statements.push({
      ttc: 'TTC HIS 000',
      text:
        `HIST: NJP AWD ${njpDate || '[NJP DATE]'} ${code.description}` +
        `${isSuspended ? ` SUSPENDED FOR ${period || '[MONTHS] MO'}` : ''} |`,
      authority: 'MCTFSPRIUM 70503 note 2',
      notes: [
        'Reported as history because this punishment affects no pay, pay grade, or other ' +
          'personnel data item.',
      ],
    });
  });

  // --- Follow-on actions -------------------------------------------------
  reminders.push(
    'Report a new Good Conduct Medal commencement date with TTC 140 001. Any NJP breaks the ' +
      'GCM period (PRIUM 70503 note 3, 50101.8.c).',
  );
  reminders.push(
    'Do NOT report TTC 053. The three-month promotion restriction posts automatically from ' +
      'TTC 268 (PRIUM 70503 note 1). If the Marine is already restricted, MCTFS keeps whichever ' +
      'termination date is later (PRIUM 70702.3).',
  );
  if (punishmentEntries(formData).some((entry) => {
    const code = resolvePunishment(entry.code);
    return !!code && /CORRECTIONAL CUSTODY/i.test(code.description);
  })) {
    reminders.push(
      'Correctional custody puts the Marine in pay status 03120, Confined Admin Disciplinary ' +
        'Action as Result of NJP. Time lost may need reporting (PRIUM 70400, 70401).',
    );
  }

  return { statements, blockers, missing, reminders };
}
