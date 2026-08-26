/**
 * NAVMC 10132 unit diary handoff, a pure presentation formatter.
 *
 * SemperScribe has no MCTFS connectivity. This module never claims one, and
 * a human is expected to read the returned block and type the entry into
 * the unit diary themselves. It touches no DOM, no clipboard, and no file
 * I/O. Data in, a structured result out.
 *
 * The single rule that matters most: only an offense row whose finding is
 * exactly 'Guilty' produces an MCTFS punishment entry. A 'Not Guilty'
 * finding produces no entry, and a blank finding means the case is not yet
 * adjudicated (Navmc10132Offense.finding doc comment, src/types/navmc.ts,
 * item 5). Reporting either of those as a conviction is the worst outcome
 * available in this phase, so every non-Guilty row is deliberately routed
 * to a visible NOT REPORTED section rather than silently dropped.
 */

import type { FormData } from '@/types';
import type { Navmc10132PunishmentEntry } from '@/types/navmc';
import {
  resolveArticle,
  renderPunishment,
  Navmc10132PunishmentRenderError,
} from '@/lib/navmc10132-utils';

/** One offense row deliberately left out of the reportable block. */
export interface UnitDiaryExclusion {
  /** Row letter A through E. */
  row: string;
  /** The offense's articleLabel. */
  label: string;
  /** Why the row is not reportable. */
  reason: string;
}

/**
 * Item 16 already carries a unit diary UD number, meaning this NJP has
 * already been reported. docs/NAVMC_10132_SPEC.md section 11.6: "Item 16
 * requires unit diary entries per MCTFSPRIUM and records the UD number and
 * date." A number with no date is still a completed report, so `dtd` can be
 * empty here even though `ud` cannot.
 */
export interface UnitDiaryAlreadyReported {
  /** Item 16 UD number, verbatim. */
  ud: string;
  /** Item 16 date, verbatim. Empty string when the number is present but the date is not. */
  dtd: string;
}

export interface UnitDiaryBlock {
  /** The copyable text. Never empty, even when nothing is reportable. */
  text: string;
  /** FALSE when no offense carries a Guilty finding, so there is no entry to make. */
  reportable: boolean;
  /** Human-readable names of required data the form does not yet carry. */
  missing: string[];
  /** Offense rows deliberately left out of the block. */
  excluded: UnitDiaryExclusion[];
  /** Non-null when item 16 already carries a UD number, meaning this NJP has been reported. */
  alreadyReported: UnitDiaryAlreadyReported | null;
  /**
   * TRUE when item 12 records an intent to appeal and item 14 carries no
   * decision yet, so the figures below can still move.
   *
   * WHY THIS EXISTS AT ALL. The panel used to appear only once item 16 had
   * closed the form, at which point nothing could change and no such caveat
   * was possible. Stephen opened it at the item 12 signature on 2026-08-26,
   * which is BEFORE the appeal is decided. Article 15(e), UCMJ and MCM Part
   * V para 7.f let the reviewing authority set aside, mitigate, remit or
   * suspend the punishment on appeal, so a diary entry typed from this block
   * while an appeal is pending can be posting a punishment that no longer
   * exists in that form.
   *
   * NOT A BLOCK. A pending appeal does not suspend the punishment by itself
   * (MCM Part V para 7.d(2): punishment is effective when imposed and an
   * appeal does not stay it unless the authority orders it), so there are
   * real cases where the entry is made while the appeal is out. This reports
   * the risk and leaves the judgement with the clerk.
   */
  appealPending: boolean;
}

/** The row letters the form actually prints for item 1 and item 5, same order navmc10132-acroform.ts uses. */
const ROW_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Fixed left column width for the top-level label lines. */
const LABEL_WIDTH = 12;
/** Column width for an offense row's MCTFS code, before the article label. */
const OFFENSE_CODE_WIDTH = 8;
/** Column width for a punishment code or the CONCURRENT marker. */
const PUNISHMENT_LABEL_WIDTH = 11;

const NOT_CAPTURED = '[not captured in SemperScribe]';

// ---------------------------------------------------------------------------
// Narrowing accessors, copied from navmc10132-acroform.ts's pattern.
//
// FormData is `{ documentType: string; [key: string]: any }`, an `any`
// index signature that types neither a typo'd key nor a wrong-type read.
// Every read below assigns the indexed value into an `unknown`-typed
// binding first, then narrows with a runtime check, exactly as
// navmc10132-acroform.ts does. An inline cast off the raw `any` property
// is never used here.
// ---------------------------------------------------------------------------

function readUnknown(formData: FormData, key: string): unknown {
  const value: unknown = formData[key];
  return value;
}

function readString(formData: FormData, key: string): string | undefined {
  const value = readUnknown(formData, key);
  return typeof value === 'string' ? value : undefined;
}

function readBoolean(formData: FormData, key: string): boolean | undefined {
  const value = readUnknown(formData, key);
  return typeof value === 'boolean' ? value : undefined;
}

function readRows(formData: FormData, key: string): unknown[] {
  const value = readUnknown(formData, key);
  return Array.isArray(value) ? value : [];
}

/** Reads one string property off an array element without asserting the element is a shaped row type. */
function stringField(row: unknown, key: string): string | undefined {
  if (typeof row !== 'object' || row === null) return undefined;
  const value: unknown = (row as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

/** Reads `formData.punishments`, going through `unknown` first, same as navmc10132-acroform.ts's readPunishments. */
function readPunishmentEntries(formData: FormData): Navmc10132PunishmentEntry[] {
  const value = readUnknown(formData, 'punishments');
  return Array.isArray(value) ? (value as Navmc10132PunishmentEntry[]) : [];
}

/** Left-pads a label to the fixed column width so the block stays greppable and diffable. */
function label(text: string, width: number): string {
  return text.padEnd(width);
}

/**
 * A required top-level line. Blank input never renders as blank, it renders
 * as a bracketed marker and adds a plain-English name to `missing`, per the
 * module's "a half-complete block must be visibly half-complete" rule.
 */
function requiredLine(
  heading: string,
  value: string,
  missingName: string,
  missing: string[]
): string {
  if (value === '') {
    missing.push(missingName);
    return `${label(heading, LABEL_WIDTH)}[MISSING]`;
  }
  return `${label(heading, LABEL_WIDTH)}${value}`;
}

interface ResolvedOffenseRow {
  row: string;
  code: string;
  articleLabel: string;
}

/**
 * Builds the NAVMC 10132 unit diary transcription aid from one document's
 * FormData.
 */
export function unitDiaryBlock(formData: FormData): UnitDiaryBlock {
  const missing: string[] = [];
  const excluded: UnitDiaryExclusion[] = [];

  const accusedName = readString(formData, 'accusedName') ?? '';
  const accusedRankGrade = readString(formData, 'accusedRankGrade') ?? '';
  const accusedEdipi = readString(formData, 'accusedEdipi') ?? '';
  const unit = readString(formData, 'unit') ?? '';
  const punishmentDate = readString(formData, 'punishmentDate') ?? '';
  const suspension = readString(formData, 'suspension') ?? '';
  const intendAppeal = readString(formData, 'intendAppeal') ?? '';
  const finalAdminUd = readString(formData, 'finalAdminUd') ?? '';
  const finalAdminDtd = readString(formData, 'finalAdminDtd') ?? '';

  // Item 16 IS the unit diary entry. docs/NAVMC_10132_SPEC.md section 11.6:
  // "Item 16 requires unit diary entries per MCTFSPRIUM and records the UD
  // number and date." So this module serves a round trip, the block goes
  // out to the clerk, the clerk makes the entry, and the resulting UD
  // number comes back into item 16. A UD number with no date is still a
  // completed report (the date field can lag or be omitted by the clerk),
  // so presence of the number alone is what flips this, not the pair.
  const alreadyReported: UnitDiaryAlreadyReported | null =
    finalAdminUd === '' ? null : { ud: finalAdminUd, dtd: finalAdminDtd };

  // An appeal is PENDING when the accused said they intend one and item 14
  // has not ruled. The item 12 wording is the form's own, matched here on
  // the affirmative option only: "the accused refuses to sign" is a refusal
  // to sign the election, not a statement of intent, and reading it as an
  // appeal would caveat every refusal case for no reason. See
  // `UnitDiaryBlock.appealPending`.
  const appealDecision = readString(formData, 'appealDecision') ?? '';
  const appealPending = intendAppeal.trim() === 'I do intend to appeal.' && appealDecision.trim() === '';

  // --- Offenses: resolve every row, sort each into reportable or excluded ---
  const offenseRows = readRows(formData, 'offenses');
  const resolvedOffenses: ResolvedOffenseRow[] = [];
  let hasGuiltyFinding = false;

  ROW_LETTERS.forEach((row, index) => {
    const raw = offenseRows[index];
    const articleLabel = stringField(raw, 'articleLabel') ?? '';
    if (articleLabel === '') return; // Unused row, neither reportable nor excluded.

    const finding = stringField(raw, 'finding') ?? '';

    if (finding !== 'Guilty') {
      excluded.push({
        row,
        label: articleLabel,
        reason:
          finding === 'Not Guilty'
            ? 'finding is Not Guilty'
            : 'finding is blank, case not yet adjudicated',
      });
      return;
    }

    hasGuiltyFinding = true;

    // Navmc10132Offense.mctfsCode is described in its own doc comment
    // (src/types/navmc.ts) as "Resolved from articleLabel... Not printed on
    // the form, carried for the unit diary handoff" and is optional. It is
    // a stored denormalization that can go stale against the article table
    // or be absent entirely, so it is never read here. The code is instead
    // resolved fresh through resolveArticle on every call, the same
    // crosswalk the rest of the NAVMC 10132 engine treats as the source of
    // truth (see navmc10132-articles.ts).
    const article = resolveArticle(articleLabel);
    if (!article) {
      // The dropdown is a closed list (resolveArticle's own doc comment),
      // so an unmatched label is a data error, not a simple omission.
      excluded.push({
        row,
        label: articleLabel,
        reason: `MCTFS code not found for article label "${articleLabel}"`,
      });
      missing.push(`MCTFS code for row ${row} ("${articleLabel}")`);
      return;
    }

    resolvedOffenses.push({ row, code: article.mctfsCode, articleLabel });
  });

  // --- Punishments: one line per entry, never a bare string ---------------
  // renderPunishment returns { text, length }, not a string. To render one
  // code's clause the module doc for navmc10132-punishment-render.ts is
  // explicit that application code must call renderPunishment, never the
  // test-only renderTemplate, so a single-entry array is passed through it
  // here for every punishment line.
  const punishmentEntries = readPunishmentEntries(formData);
  const punishmentLines: string[] = [];

  for (const entry of punishmentEntries) {
    const code = typeof entry?.code === 'string' ? entry.code : '';
    try {
      const rendered = renderPunishment([entry]);
      punishmentLines.push(`  ${label(code, PUNISHMENT_LABEL_WIDTH)}${rendered.text}`);
    } catch (err) {
      // renderPunishment throws Navmc10132PunishmentRenderError when an
      // entry omits a parameter its code's template needs (its own @throws
      // doc). That is caught per entry so one incomplete code does not lose
      // the rest of the block. Anything else is a real defect and escapes.
      if (err instanceof Navmc10132PunishmentRenderError) {
        punishmentLines.push(
          `  ${label(code, PUNISHMENT_LABEL_WIDTH)}[incomplete: ${err.message}]`
        );
        missing.push(`punishment ${code || '(unknown code)'}: ${err.message}`);
      } else {
        throw err;
      }
    }
  }

  // RenderPunishmentOptions.concurrent's own doc comment: "Has no effect
  // with fewer than two entries, since concurrency is meaningless for a
  // single punishment." The CONCURRENT line follows that same threshold.
  const concurrent = readBoolean(formData, 'punishmentsConcurrent') ?? false;
  if (punishmentEntries.length >= 2) {
    punishmentLines.push(
      `  ${label('CONCURRENT', PUNISHMENT_LABEL_WIDTH)}${concurrent ? 'yes' : 'no'}`
    );
  }

  const lines: string[] = [];
  lines.push('UNIT PUNISHMENT REPORT - TRANSCRIPTION AID');
  lines.push('SemperScribe has no MCTFS connection. Enter this in the unit diary yourself.');

  // Surfaced immediately under the headers, before anything else, in both
  // the reportable and non-reportable branches below. A form with no
  // Guilty finding but a UD number already in item 16 is a contradiction
  // worth surfacing, not a case where the warning can be skipped.
  if (alreadyReported) {
    const dateClause = alreadyReported.dtd === '' ? '' : ` dated ${alreadyReported.dtd}`;
    lines.push('');
    lines.push(
      `ALREADY REPORTED - unit diary UD ${alreadyReported.ud}${dateClause}. Do not enter this NJP a second time.`
    );
  }

  if (!hasGuiltyFinding) {
    // No empty template. A blank shell would look like a bug, not a
    // deliberate absence of an entry.
    lines.push('');
    lines.push('No offense on this NAVMC 10132 carries a Guilty finding.');
    lines.push('There is no unit diary entry to make.');
    if (excluded.length > 0) {
      lines.push('');
      lines.push('NOT REPORTED');
      for (const ex of excluded) {
        lines.push(`  ${ex.row}   ${ex.label} - ${ex.reason}`);
      }
    }
    return { text: lines.join('\n'), reportable: false, missing, excluded, alreadyReported, appealPending };
  }

  lines.push('');
  lines.push(requiredLine('MARINE', accusedName, 'accused name (item 18)', missing));
  lines.push(requiredLine('GRADE', accusedRankGrade, 'accused rank/grade (item 19)', missing));
  lines.push(requiredLine('EDIPI', accusedEdipi, 'accused EDIPI (item 20)', missing));
  lines.push(requiredLine('UNIT', unit, 'unit (item 17)', missing));
  // RUC has no field on Navmc10132Data at all (src/types/navmc.ts). No
  // amount of filling out this form produces it, so unlike every other
  // blank line above, it is not added to `missing`, that list is for data
  // the form COULD still carry.
  lines.push(`${label('RUC', LABEL_WIDTH)}${NOT_CAPTURED}`);
  lines.push('');
  lines.push(
    requiredLine('NJP DATE', punishmentDate, 'punishment imposition date (item 6 date)', missing)
  );
  lines.push('');
  lines.push('OFFENSES (guilty findings only)');
  if (resolvedOffenses.length === 0) {
    lines.push('  [MISSING] no offense row resolved to an MCTFS code');
  } else {
    for (const o of resolvedOffenses) {
      lines.push(`  ${o.row}   ${label(o.code, OFFENSE_CODE_WIDTH)}${o.articleLabel}`);
    }
  }
  lines.push('');
  lines.push('PUNISHMENT');
  if (punishmentLines.length === 0) {
    lines.push('  [MISSING]');
    missing.push('punishment (item 6)');
  } else {
    lines.push(...punishmentLines);
  }
  lines.push('');
  lines.push(`${label('SUSPENSION', LABEL_WIDTH)}${suspension === '' ? 'NONE' : suspension}`);
  // Unlike MARINE, GRADE, EDIPI, UNIT, and NJP DATE above, an empty appeal
  // election is not tracked in `missing`. Those five identify who and what
  // was punished and should already exist by the time this block is built.
  // The appeal window (items 12-15) opens only AFTER imposition, so a
  // clerk transcribing on the day of NJP has legitimately made no election
  // yet, that is the common case, not a data gap. Flagging it as
  // [MISSING] would put a false warning on the most common case.
  lines.push(
    `${label('APPEAL', LABEL_WIDTH)}${intendAppeal === '' ? 'not yet elected' : intendAppeal}`
  );
  // The UD number does not exist until AFTER the clerk acts on this very
  // block (see the alreadyReported comment above), so an empty item 16 is
  // the same class of gap as RUC, something no amount of filling out THIS
  // form produces, not the same class as EDIPI, something the form could
  // carry right now. It is never added to `missing` for that reason.
  lines.push(
    `${label('UD ENTRY', LABEL_WIDTH)}${alreadyReported ? alreadyReported.ud : '[not yet recorded]'}`
  );

  if (excluded.length > 0) {
    lines.push('');
    lines.push('NOT REPORTED');
    for (const ex of excluded) {
      lines.push(`  ${ex.row}   ${ex.label} - ${ex.reason}`);
    }
  }

  return { text: lines.join('\n'), reportable: true, missing, excluded, alreadyReported, appealPending };
}
