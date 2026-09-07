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
import {
  renderTemplate,
  Navmc10132PunishmentRenderError,
} from '@/lib/navmc10132-punishment-render';

/** One transaction, ready to be read and typed. */
export interface MctfsStatement {
  /** Transaction and sequence, e.g. 'TTC 268 000'. */
  ttc: string;
  /**
   * The WHOLE statement line, transaction number included.
   *
   * IT USED TO START AT THE DATE, with the transaction number carried only
   * in `ttc` beside it. Stephen asked on 2026-08-26 why the app showed
   * "20260825 NJP AWD VESSEL OPT A LAWYER OPT A ED 20260825 |" rather than
   * the actual transaction, and he was right to: the PRIUM writes its
   * templates as one line beginning with the TTC and its sequence, for
   * instance "TTC 056 000 [A] REDUCED [B] DOR [C] ED [D] | HIST: [E] |",
   * and a body that drops the head of that line is not a line anybody can
   * key. `ttc` stays as the short label a panel or a worksheet indexes by;
   * this is the string.
   */
  text: string;
  /** The PRIUM paragraph this comes from. */
  authority: string;
  /** Anything the clerk must know before entering it. */
  notes: string[];
  /**
   * TRUE only where `text` is built against a PRIUM template this codebase
   * has the words of, field for field.
   *
   * FALSE MEANS THE LAYOUT IS THIS APP'S, and a clerk entering a legal
   * record is owed that distinction. The DATA in a composed statement is
   * still derived from cited PRIUM rules, the vessel option letters and the
   * punishment code bytes among them; what is unverified is the ORDER, the
   * prompt names and the punctuation. `cautionUnlessQuoted` below puts that
   * on the statement itself so it cannot be lost between here and the page.
   */
  templateQuoted: boolean;
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
/**
 * What a history statement says a Marine was awarded.
 *
 * Renders the punishment's own item 6 template against the entry, uppercased
 * for a transaction line and stripped of the sentence period item 6 needs
 * and a diary statement does not. Returns null when item 6 has not collected
 * the parameters the template needs, which is ordinary mid-entry state
 * rather than a bug: the caller says so on the statement instead of printing
 * a number nobody entered.
 */
export function historyPunishmentText(
  punishment: Parameters<typeof renderTemplate>[0],
  entry: Navmc10132PunishmentEntry,
): string | null {
  let rendered: string;
  try {
    rendered = renderTemplate(punishment, entry);
  } catch (err) {
    if (err instanceof Navmc10132PunishmentRenderError) return null;
    throw err;
  }
  return rendered.replace(/\.\s*$/, '').toUpperCase();
}

/**
 * The note every statement whose layout this app composed has to carry.
 *
 * GENERATED, NOT TYPED AT EACH SITE, so a new statement cannot be added
 * without it. `tests/navmc10132-mctfs.test.ts` asserts every statement that
 * declares `templateQuoted: false` carries this sentence.
 */
export const COMPOSED_FORMAT_CAUTION =
  'The LAYOUT of this line is SemperScribe\'s, not a PRIUM template this app holds the words ' +
  'of. Its values come from cited PRIUM rules; the prompt order and punctuation do not. Check ' +
  'it against the paragraph above before entering it.';

/** Adds the caution to a composed statement, and nothing to a quoted one. */
function cautionUnlessQuoted(statement: MctfsStatement): MctfsStatement {
  if (statement.templateQuoted) return statement;
  return { ...statement, notes: [...statement.notes, COMPOSED_FORMAT_CAUTION] };
}

/**
 * A pay grade abbreviation in the shape TTC 056 wants.
 *
 * PRIUM 70507.4 field [B]: "6-byte abbreviation for pay grade to which
 * reduced". Uppercased because a transaction line is uppercase throughout,
 * and NEVER truncated: a pay grade cut to six characters on a transaction
 * that moves a Marine's pay is worse than one the clerk is told to check.
 * Every Marine Corps rank abbreviation this app offers fits, SgtMaj and
 * MGySgt being the longest at six, so an over-length value means the picker
 * changed or the value came from somewhere else.
 */
export const TTC_056_GRADE_BYTES = 6;

export function reducedGradeField(gradeReducedTo: string): {
  value: string;
  overLength: boolean;
} {
  const value = gradeReducedTo.trim().toUpperCase();
  return { value, overLength: value.length > TTC_056_GRADE_BYTES };
}

/**
 * The history statement the TTC 268 line carries.
 *
 * MCTFSPRIUM 70503 does not give this one a bracketed placeholder the way
 * 70507.4 gives TTC 056 its `[E]`. It writes the requirement into the
 * template itself: "HIST: History statement should include statistical
 * information (That is, Violation Article 92) and all punishment awarded."
 * So the SHAPE is quoted and the CONTENT is prescribed rather than
 * positional, and both halves of what it prescribes are on the form.
 *
 * THE STATISTICAL INFORMATION is the article violated, which the paragraph's
 * own parenthetical settles by example. Every guilty finding's article, in
 * row order, deduplicated the same way the TTC 212 slots are, because two
 * offense labels can be one punitive article.
 *
 * ALL PUNISHMENT AWARDED is item 6, rendered through its own template so the
 * history statement and the form say the same words, exactly as the
 * standalone history statements below do.
 *
 * WHY THIS IS NOT A POINTER TO THE TRANSCRIPTION AID. The aid is a multi
 * line block with labels and columns; a transaction line is one string. The
 * aid remains what a clerk reads for the fuller picture, and this is what
 * goes in the entry.
 */
export function njpHistoryStatement(formData: FormData): string {
  const parts: string[] = [];

  const articles = guiltyArticles(formData).articles;
  if (articles.length > 0) {
    parts.push(articles.map((article) => `VIOLATION ARTICLE ${article.code}`).join(', '));
  }

  const awarded: string[] = [];
  for (const entry of punishmentEntries(formData)) {
    const punishment = resolvePunishment(entry.code);
    if (!punishment) continue;

    // A REDUCTION IS SAID THE WAY THE PRIUM SAYS IT, not the way item 6 does.
    //
    // Item 6's template is written for a 123-character field and renders
    // "To be red to LCpl", which uppercases to "TO BE RED TO LCPL". In a
    // remark MCTFS retains permanently, "RED" reads as a colour. MCTFSPRIUM
    // 70507.4 gives this app the words for a reduction, "REDUCED" followed
    // by the 6-byte grade abbreviation, and the TTC 056 on the same sheet
    // already prints exactly that. So the two agree, and they agree on the
    // vocabulary of the record rather than on an abbreviation invented for a
    // narrow box.
    //
    // ONLY THE REDUCTION. Every other punishment keeps item 6's wording,
    // because for those the PRIUM gives this app no vocabulary of its own
    // and item 6 is the only source there is. The rule is: prefer the
    // paragraph's words where the paragraph has been supplied.
    if (punishment.parameters.includes('gradeReducedTo')) {
      const grade = reducedGradeField(entry.gradeReducedTo ?? '');
      awarded.push(`REDUCED ${grade.value || '[GRADE]'}`);
      continue;
    }

    const text = historyPunishmentText(punishment, entry);
    // A punishment item 6 has not finished collecting is named without its
    // amount rather than dropped. Dropping it would understate the record in
    // the remark MCTFS retains permanently.
    awarded.push(text ?? `${punishment.description} [AMOUNT]`);
  }
  if (awarded.length > 0) parts.push(awarded.join(', '));

  return parts.join('. ');
}

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
  // BUILT AGAINST THE TEMPLATE, supplied by Stephen on 2026-08-26:
  //
  //   TTC 268 000 [A] NJP AWD VESSEL OPT [B] LAWYER OPT [C] ED [D] | HIST: ...
  //
  //   [A] 8-byte Date of Action (YYYYMMDD)
  //   [B] VESSEL OPT
  //   [C] LAWYER OPT
  //   [D] 8-byte Effective Date (YYYYMMDD) of the nonjudicial punishment
  //
  // THE LINE USED TO STOP AT THE PIPE. The HIST segment is part of the
  // template, not advice about it, and the app carried it only as a note
  // telling the clerk to go and find the text somewhere else. A clerk keying
  // what the sheet showed entered a TTC 268 with no history statement, and
  // 70503 says this posts to the Marine's record and is retained permanently
  // in the MCTFS 119 remark. See njpHistoryStatement for what fills it.
  //
  // NO TRAILING PIPE, and the difference from TTC 056 is in the source
  // rather than in a decision here. 70507.4 writes "| HIST: [E] |" with a
  // bracketed field and a closing delimiter; 70503 writes "| HIST:" and then
  // runs the requirement in as prose with no closing delimiter and no
  // placeholder. Adding one would be inventing a delimiter the paragraph
  // does not show.
  const historyStatement = njpHistoryStatement(formData);
  statements.push({
    ttc: 'TTC 268 000',
    templateQuoted: true,
    text:
      `TTC 268 000 ${njpDate || '[NJP DATE]'} NJP AWD VESSEL OPT ${vesselOpt || '[?]'} ` +
      `LAWYER OPT ${lawyerOpt || '[?]'} ED ${njpDate || '[NJP DATE]'} | ` +
      `HIST: ${historyStatement || '[VIOLATION ARTICLE AND ALL PUNISHMENT AWARDED]'}`,
    authority: 'MCTFSPRIUM 70503',
    notes: [
      'The HIST segment carries the statistical information and all punishment awarded ' +
        '(PRIUM 70503), which is the article violated and item 6. It is built from this form, ' +
        'so check it against items 1, 5 and 6 before entering.',
      'This posts to the Marine\'s record and is retained permanently in the MCTFS 119 remark ' +
        '(PRIUM 70503).',
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

  statements.push(cautionUnlessQuoted({
    ttc: 'TTC 212 000',
    templateQuoted: false,
    text:
      `TTC 212 000 ${njpDate || '[NJP DATE]'} CM-NJP CD N CA-CO EDIPI ${authorityEdipi || '[EDIPI]'} ` +
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
  }));

  // --- TTC 212 001, one per victim --------------------------------------
  const victims: unknown = formData.victims;
  if (Array.isArray(victims)) {
    victims.forEach((raw, index) => {
      const record = (raw ?? {}) as Record<string, unknown>;
      const sex = typeof record.sex === 'string' ? record.sex.trim() : '';
      const race = typeof record.race === 'string' ? record.race.trim() : '';
      const ethnicity = typeof record.ethnicity === 'string' ? record.ethnicity.trim() : '';
      if (sex === '' && race === '' && ethnicity === '') return;
      statements.push(cautionUnlessQuoted({
        ttc: 'TTC 212 001',
        templateQuoted: false,
        text:
          `TTC 212 001 ${njpDate || '[NJP DATE]'} CM-NJP VICTIM SEQ [SEQ] NUM ${twoByte(index + 1)} ` +
          `SEX ${sex || 'U'} RACE ${race || 'U'} ETHNICITY ${ethnicity || 'U'} |`,
        authority: 'MCTFSPRIUM 70508',
        notes: [
          'SEQ must match the sequence on the member’s CM-NJP-STAT-212-RMK from the entry ' +
            'above. MCTFS assigns it, so SemperScribe cannot supply it (PRIUM 70508 note 1).',
          'Unknown sex, race, or ethnicity is reported as U, not left blank.',
        ],
      }));
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
        statements.push(cautionUnlessQuoted({
          ttc: 'TTC HIS 000',
          // The ROUTING is quoted, the wording is not. 70507.4: "When the
          // reduction is suspended, report the occurrence as a historical
          // statement per Paragraph 70504". What that statement reads is
          // not a template this app holds.
          templateQuoted: false,
          text:
            `TTC HIS 000 HIST: NJP AWD ${njpDate || '[NJP DATE]'} REDUCED TO ` +
            `${target || '[GRADE]'} SUSP FOR ${period || '[MONTHS] MO'} |`,
          authority: 'MCTFSPRIUM 70504.3',
          notes: [
            'A SUSPENDED reduction is reported as history only. Do not report TTC 056 for it, ' +
              'because no pay grade has changed.',
            'If the suspension is later vacated, report TTC HIS 000 HIST: VACATION OF SUSP ' +
              'REDUCED NJP AWD (date vacated) and then the TTC 056 (PRIUM 70504.4).',
          ],
        }));
      } else {
        // THE ONE STATEMENT BUILT AGAINST A TEMPLATE THIS CODEBASE HOLDS THE
        // WORDS OF. Stephen supplied MCTFSPRIUM 70507 on 2026-08-26. Its
        // paragraph 4 covers a reduction awarded at nonjudicial punishment,
        // and gives the line field for field:
        //
        //   TTC 056 000 [A] REDUCED [B] DOR [C] ED [D] | HIST: [E] |
        //
        //   [A] DOA, 8 bytes YYYYMMDD, never 00000000
        //   [B] 6-byte abbreviation for pay grade to which reduced
        //   [C] 8-byte effective date, the DOR for that pay grade
        //   [D] 8-byte effective date of the reduction
        //   [E] HIST: input authority, the CO's letter info
        //
        // Sequence 000 is the punitive one. 001 is an administrative
        // reduction and 002 corrects an erroneous promotion (70507.2 and
        // 70507.3); neither is an NJP and neither is emitted here. A
        // reduction by sentence of a court-martial is TTC 257 or TTC 262
        // (70507.4), which this app never reaches.
        //
        // [D] IS NOT THE SAME FIELD AS [C], even though both default to the
        // NJP date here. [C] is the date of rank in the new grade and [D] is
        // the date the reduction takes effect. The PRIUM lists them
        // separately because they can differ, so both carry a note rather
        // than one standing for the other.
        const grade = reducedGradeField(target);
        if (grade.overLength) {
          missing.push(
            `a pay grade abbreviation for the reduction that fits ${TTC_056_GRADE_BYTES} bytes. ` +
              `"${grade.value}" is ${grade.value.length}. TTC 056 field [B] is six bytes and ` +
              'this app will not truncate a pay grade on a transaction that moves pay.',
          );
        }
        statements.push({
          ttc: 'TTC 056 000',
          templateQuoted: true,
          text:
            `TTC 056 000 ${njpDate || '[NJP DATE]'} REDUCED ${grade.value || '[GRADE]'} DOR ` +
            `${njpDate || '[DOR]'} ED ${njpDate || '[NJP DATE]'} | HIST: [CO’S LETTER INFO] |`,
          authority: 'MCTFSPRIUM 70507.4',
          notes: [
            'Field [B] is a 6-byte abbreviation for the pay grade reduced to (PRIUM 70507.4), ' +
              'which is the rank abbreviation item 6 recorded, uppercased. It is the ' +
              'abbreviation the transaction wants, not the pay grade.',
            'DOR, field [C], is the date of rank in the new grade. ED, field [D], is the date ' +
              'the reduction takes effect. Both default to the NJP date here, which is the ' +
              'usual case, and the PRIUM lists them separately because they need not agree.',
            'HIST, field [E], is the input authority: the commanding officer\'s letter info. ' +
              'SemperScribe does not carry it, so it is left as a placeholder.',
            'JEPES marks must be reported on reductions of Corporals and below (PRIUM 70507.1).',
            ...(grade.overLength
              ? [
                  `The pay grade "${grade.value}" is ${grade.value.length} bytes and field [B] ` +
                    'holds six. Nothing has been truncated. Fix item 6 before entering this.',
                ]
              : []),
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
        statements.push(cautionUnlessQuoted({
          ttc: 'TTC HIS 000',
          templateQuoted: false,
          text:
            `TTC HIS 000 HIST: NJP AWD ${njpDate || '[NJP DATE]'} FORF ` +
            `$${valid ? mctfsDollars(perMonth) : '[AMT]'}` +
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
        }));
      } else {
        statements.push(cautionUnlessQuoted({
          ttc: 'TTC 283 003',
          templateQuoted: false,
          text:
            `TTC 283 003 ${njpDate || '[NJP DATE]'} FORF ` +
            `$${valid ? mctfsDollars(perMonth) : '[AMT]'}.00 FOR ` +
            `${valid ? twoByte(months) : '[MO]'} MO NJP TOTAL $` +
            `${valid ? mctfsDollars(perMonth * months) : '[TOTAL]'}.00 ED ${njpDate || '[NJP DATE]'} |`,
          authority: 'MCTFSPRIUM 70502.a',
          notes: [
            'Forfeiture takes effect when imposed, so the ED is the NJP date (JAGMAN 0113.a).',
            'To mitigate it later, report TTC 318 001 FORF RED TO. To remit it entirely, report ' +
              'TTC 315 001 FORF RED TO NONE NJP.',
          ],
        }));
      }
      return;
    }

    // PRIUM 70503 note 2. Restriction, extra duties, correctional custody,
    // admonition, and reprimand touch no pay or personnel data item, so they
    // ride the history statement rather than an action transaction.
    //
    // THE IMPOSED PUNISHMENT, NOT THE CODE'S DESCRIPTION. Until 2026-08-26
    // this line printed `code.description`, which for N09 reads "EXTRA
    // DUTIES, INCLUDING FATIGUE OR OTHER DUTIES, FOR NOT MORE THAN 14
    // CONSECUTIVE DAYS". That is the STATUTORY CEILING out of 10 U.S.C.
    // 815(b)(2)(E), not what the commander awarded, so a clerk typing it
    // recorded a punishment nobody imposed, permanently, in the one place
    // this punishment is reported at all. The reduction and forfeiture
    // branches above always used the entry's own values; this one did not.
    //
    // It renders through the SAME template item 6 prints from, so the
    // history statement and the form say the same words. A clerk holding
    // the sheet beside the NAVMC 10132 is comparing like with like.
    const imposed = historyPunishmentText(code, entry);
    if (imposed === null) {
      missing.push(
        `the parameters for ${code.code}, needed for its history statement. The statement ` +
          "below names the punishment but not the amount awarded.",
      );
    }
    statements.push(cautionUnlessQuoted({
      ttc: 'TTC HIS 000',
      // 70503 note 2 is quoted in this module's header and decides that this
      // punishment rides a history statement. What the statement READS is
      // this app's wording.
      templateQuoted: false,
      text:
        `TTC HIS 000 HIST: NJP AWD ${njpDate || '[NJP DATE]'} ` +
        `${imposed ?? `${code.description} [AMOUNT]`}` +
        `${isSuspended ? ` SUSPENDED FOR ${period || '[MONTHS] MO'}` : ''} |`,
      authority: 'MCTFSPRIUM 70503 note 2',
      notes: [
        'Reported as history because this punishment affects no pay, pay grade, or other ' +
          'personnel data item.',
        ...(imposed === null
          ? [
              'Item 6 does not carry the amount awarded for this punishment yet, so the ' +
                'statement above names the punishment only. Do not enter it as it stands.',
            ]
          : [
              'The wording is item 6\'s own, so this statement and the form agree. It states ' +
                'what was AWARDED, which is not the statutory ceiling in the code description.',
            ]),
      ],
    }));
  });

  // --- Follow-on actions -------------------------------------------------
  reminders.push(
    // 70503 note 3 as Stephen supplied it on 2026-08-26 points at Section
    // 50100, not at the 50101.8.c this line used to cite. The narrower cite
    // came from an earlier reading and is not in the paragraph's own words,
    // so the paragraph's own words are what it says.
    'Report a new Good Conduct Medal commencement date with TTC 140 001. Any NJP breaks the ' +
      'GCM period (PRIUM 70503 note 3, which points at Section 50100).',
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
