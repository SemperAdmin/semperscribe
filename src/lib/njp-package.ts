/**
 * The NJP package: documents generated from the NAVMC 10132's own data at
 * the point in the process where each one is served.
 *
 * Each entry answers two questions the UI needs and nothing else. What does
 * this document require before it exists, and what does it render from. The
 * buttons live in the section that owns the data, so a document becomes
 * available exactly where the clerk finishes the last field it needs.
 *
 * WHY READINESS IS A LIST RATHER THAN A BOOLEAN. A disabled button with no
 * reason is a dead end. Naming the missing field turns it into an
 * instruction, and the same list drives the export blocker's wording.
 */

import type { FormData } from '@/types';
import type { Navmc10132Offense } from '@/types/navmc';
import { NAVMC_10132_DEMAND } from '@/types/navmc';
import {
  captionName,
  renderNjpRights,
  selectRightsAppendix,
  type NjpRightsCase,
} from '@/lib/njp-a1-rights';
import { renderNjpScript, type NjpScriptCase } from '@/lib/njp-a1-script';
import { APPENDIX_A_1_F } from '@/lib/jagman-appendix-a1';
import { renderPunishment, Navmc10132PunishmentRenderError } from '@/lib/navmc10132-utils';
import type { Navmc10132PunishmentEntry } from '@/types/navmc';
import {
  NJP_AUTHORITY_LEVEL_LABEL,
  maximumPunishment,
  resolveAuthorityLevel,
  type NjpAuthorityLevel,
} from '@/lib/njp-maximum-punishment';
import type { Navmc10132Service } from '@/lib/navmc10132-ranks';
import { renderAppendixPdf, type AppendixPdfResult } from '@/lib/jagman-a1-pdf';
import { punishmentMenu, forfeitureCeilingBlock } from '@/lib/njp-hearing-worksheet';
import { forfeitureLadder, type ForfeitureLadder } from '@/lib/navmc10132-forfeiture-ladder';

export interface PackageReadiness {
  ready: boolean;
  /** Plain-language items still needed. Empty when ready. */
  missing: string[];
}

function str(formData: FormData, key: string): string {
  const value: unknown = formData[key];
  return typeof value === 'string' ? value.trim() : '';
}

function offenseRows(formData: FormData): Navmc10132Offense[] {
  const value: unknown = formData.offenses;
  return Array.isArray(value) ? (value as Navmc10132Offense[]) : [];
}

/**
 * Offenses carrying an article, the only ones a rights advisement states.
 *
 * A row with a summary and no article is mid-entry, not an offense, and
 * item 1's own instruction pairs the two.
 */
export function chargedOffenses(
  formData: FormData,
): Array<{ articleLabel: string; summary: string }> {
  return offenseRows(formData)
    .filter((row) => typeof row?.articleLabel === 'string' && row.articleLabel.trim() !== '')
    .map((row) => ({
      articleLabel: String(row.articleLabel).trim(),
      summary: typeof row.summary === 'string' ? row.summary.trim() : '',
    }));
}

/**
 * Whether the vessel exception applies to this accused.
 *
 * READ FROM ITS OWN FIELD, never inferred from the item 2 demand election.
 * The two are different things and they happen in different orders: the
 * exception is a fact about the Marine's status, known before anything is
 * served, while the demand is the accused's answer, recorded after. The
 * rights advisement has to pick A-1-c or A-1-d BEFORE the accused elects
 * anything, so inferring status from a not-yet-made election would either
 * hand a vessel-attached Marine the wrong form or block the document until
 * the clerk fills in an answer the Marine has not given.
 *
 * The demand election is still cross-checked against it by the validators,
 * because a VESSEL demand on a Marine ashore is a defect worth naming.
 */
export function vesselExceptionApplies(formData: FormData): boolean {
  if (typeof formData.vesselException === 'boolean') return formData.vesselException;
  // Legacy fallback for a case saved before the field existed. An election
  // already recorded as the vessel exception implies the status.
  return str(formData, 'demand') === NAVMC_10132_DEMAND.VESSEL;
}

/**
 * The rank abbreviation alone, taken off item 19's composed RANK/GRADE
 * string.
 *
 * Item 19 stores "LCpl, E3", rank and pay grade together, because that is
 * what the form prints in one box. A caption wants the rank only: "LCpl
 * RIVERA, DIEGO M" is how a case is captioned, "LCpl, E3 RIVERA, DIEGO M"
 * is not. Splitting on the comma is safe against every value
 * formatRankGrade produces, including a Navy rating abbreviation, which
 * carries no comma of its own.
 */
export function accusedRankAbbreviation(formData: FormData): string {
  return str(formData, 'accusedRankGrade').split(',')[0].trim();
}

/**
 * A-1-c or A-1-d. Requires the accused's rank and name, the unit, and a
 * charged offense.
 *
 * RANK IS REQUIRED, not optional. A rights advisement captioned with a bare
 * surname does not identify the Marine it is served on, and item 19 is
 * filled in the same section as the name, so requiring it costs the clerk
 * nothing and the readiness list names it either way.
 */
export function rightsElectionReadiness(formData: FormData): PackageReadiness {
  const missing: string[] = [];
  if (accusedRankAbbreviation(formData) === '') missing.push("the accused's rank (item 19)");
  if (str(formData, 'accusedName') === '') missing.push("the accused's name (item 18)");
  if (str(formData, 'unit') === '') missing.push('the unit (item 17)');
  if (chargedOffenses(formData).length === 0) {
    missing.push('at least one offense with an article selected (item 1)');
  }
  return { ready: missing.length === 0, missing };
}

/**
 * Whether A-1-d paragraph 3's maximum-punishment rule can be printed, and
 * what it will say.
 *
 * ADVISORY, NEVER A BLOCKER. Item 8A lives in a LATER section than the
 * rights advisement, so an unset authority grade is the normal state at the
 * moment this document is served. The advisement still has to be
 * generatable then, with the rule blank exactly as the printed appendix
 * leaves it. This function exists so the button can say WHY the rule will
 * be blank instead of the clerk finding out in Acrobat.
 */
export interface MaximumPunishmentStatus {
  level: NjpAuthorityLevel | null;
  /** Plain-language summary for the UI. */
  detail: string;
  /** Ceilings deliberately omitted, e.g. reduction of an E-6 or above. */
  notes: string[];
}

export function maximumPunishmentStatus(formData: FormData): MaximumPunishmentStatus {
  if (vesselExceptionApplies(formData)) {
    return {
      level: null,
      detail:
        'A-1-c states no maximum punishment. The vessel exception removes the right to refuse ' +
        'NJP, so the form carries no ceiling paragraph at all.',
      notes: [],
    };
  }

  const authorityPayGrade = str(formData, 'njpAuthorityPayGrade');
  const level = resolveAuthorityLevel(authorityPayGrade);
  if (level === null) {
    return {
      level: null,
      detail:
        authorityPayGrade === ''
          ? 'Set the NJP authority pay grade (item 8A) to print the maximum punishment. Until ' +
            'then paragraph 3 prints blank for hand completion.'
          : `"${authorityPayGrade}" is not a readable officer pay grade, so paragraph 3 prints ` +
            'blank. Enter it as O1 through O10, no dash.',
      notes: [],
    };
  }

  const max = maximumPunishment({
    authorityPayGrade,
    accusedPayGrade: str(formData, 'accusedPayGrade'),
    accusedService: formData.accusedService as Navmc10132Service | undefined,
  });

  return {
    level,
    detail:
      `${NJP_AUTHORITY_LEVEL_LABEL[level]} NJP, from item 8A pay grade ${authorityPayGrade}. ` +
      'Paragraph 3 prints the ceiling for that level (MCM Part V para 5.b(2)).',
    notes: max?.notes ?? [],
  };
}

export class NjpPackageError extends Error {}

/** Throws when the readiness check would have failed, naming what is short. */
export function buildRightsCase(formData: FormData): NjpRightsCase {
  const readiness = rightsElectionReadiness(formData);
  if (!readiness.ready) {
    throw new NjpPackageError(
      `Cannot build the rights advisement yet. Still needed: ${readiness.missing.join(', ')}.`,
    );
  }
  return {
    accusedRank: accusedRankAbbreviation(formData),
    accusedName: str(formData, 'accusedName'),
    unit: str(formData, 'unit'),
    offenses: chargedOffenses(formData),
    vesselException: vesselExceptionApplies(formData),
    authorityPayGrade: str(formData, 'njpAuthorityPayGrade'),
    accusedPayGrade: str(formData, 'accusedPayGrade'),
    accusedService: formData.accusedService as Navmc10132Service | undefined,
  };
}

export interface PackageDocument extends AppendixPdfResult {
  designator: string;
  /** Suggested download name. */
  filename: string;
}

/** Renders A-1-c or A-1-d to PDF from the current form state. */
export async function renderRightsElection(formData: FormData): Promise<PackageDocument> {
  const input = buildRightsCase(formData);
  const appendix = selectRightsAppendix(input.vesselException);
  const { lines, report } = renderNjpRights(input);

  if (report.unmatched.length > 0) {
    throw new NjpPackageError(
      `The ${appendix.designator} template did not fill cleanly: ` +
        `${report.unmatched.map(([id]) => id).join(', ')}. The appendix text was ` +
        'likely regenerated and an anchor went stale.',
    );
  }

  const caption = `${captionName(input.accusedRank, input.accusedName)}   ${input.unit}`;
  const rendered = await renderAppendixPdf(appendix, lines, { caption });

  return {
    ...rendered,
    designator: appendix.designator,
    filename: `${appendix.designator}-rights-election-${slug(
      captionName(input.accusedRank, input.accusedName),
    )}.pdf`,
  };
}

/** Lowercase, hyphenated, safe for a filename on every platform. */
function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'accused';
}

// ---------------------------------------------------------------------------
// A-1-f, the commanding officer's NJP proceeding script
// ---------------------------------------------------------------------------

/**
 * THE SCRIPT WAS BUILT AND WIRED TO NOTHING, which Stephen noticed on
 * 2026-08-26: "We never added in the script." `njp-a1-script.ts` had been
 * complete and tested since an earlier session and was imported by no
 * component, only by tests. Exactly the state `njp-a1-rights.ts` was in
 * before its button landed. This is the wiring.
 *
 * WHAT IT NEEDS AND WHAT IT DELIBERATELY LEAVES BLANK. A-1-f is read ALOUD
 * at the hearing, so it is filled with what is known going in (the
 * violations) and what is announced coming out (the findings and the
 * punishment). Every ACC: and WIT: response line is left untouched, because
 * those are the accused's and the witnesses' actual words, written by hand
 * in real time. The appeal authority and advisor rules are left blank for
 * the same reason: neither is a field on the NAVMC 10132, so the app has
 * nothing truthful to put there and the printed appendix already carries a
 * rule for hand completion.
 */

/**
 * A-1-f needs less than the rights advisement does, and the difference is
 * the point. The advisement identifies the Marine it is served ON, so it
 * requires rank, name and unit. The script is read TO a Marine already
 * standing there, so it needs only the offenses that will be read out.
 *
 * FINDINGS AND PUNISHMENT ARE NOT REQUIRED. The commanding officer reads
 * the script in order to REACH them: requiring them first would mean the
 * script could only be generated after the hearing it exists to conduct.
 * Both print blank when unset, exactly as the paper appendix does.
 */
export function njpScriptReadiness(formData: FormData): PackageReadiness {
  const missing: string[] = [];
  if (chargedOffenses(formData).length === 0) {
    missing.push('at least one offense with an article selected (item 1)');
  }
  return { ready: missing.length === 0, missing };
}

/**
 * Item 5's findings, worded as the script reads them aloud.
 *
 * ONE PASS OVER THE RAW ROWS, NOT TWO. The first version of this function
 * walked chargedOffenses() and indexed formData.offenses by the position in
 * the FILTERED list. chargedOffenses drops any row with no article, so a
 * blank or mid-entry row above a charged one shifted every finding down by
 * one and the commander would have announced the wrong Marine's offense as
 * guilty. Caught by this module's own test before it shipped. A finding
 * belongs to its row, so the row is the only thing either value is read
 * from.
 */
export function announcedFindings(formData: FormData): string[] {
  const rows = Array.isArray(formData.offenses) ? (formData.offenses as Navmc10132Offense[]) : [];
  return rows
    .filter((row) => typeof row?.articleLabel === 'string' && row.articleLabel.trim() !== '')
    // Only a GUILTY finding is read out here. The anchor line reads "I find
    // that you have committed the following offenses", and listing an offense
    // the accused was found NOT guilty of under that sentence would have the
    // commander announce the opposite of the finding.
    .filter((row) => (typeof row.finding === 'string' ? row.finding.trim() : '') === 'Guilty')
    .map((row) => `${String(row.articleLabel).trim()}. ${typeof row.summary === 'string' ? row.summary.trim() : ''}`);
}

/** Item 6 as it will print, or empty when it cannot be rendered yet. */
export function announcedPunishment(formData: FormData): string {
  const entries = Array.isArray(formData.punishments)
    ? (formData.punishments as Navmc10132PunishmentEntry[])
    : [];
  if (entries.length === 0) return '';
  try {
    return renderPunishment(entries).text;
  } catch (err) {
    // Mid-entry state, not a bug: an incomplete punishment row throws, and
    // the script still has to generate with the rule blank.
    if (err instanceof Navmc10132PunishmentRenderError) return '';
    throw err;
  }
}

/**
 * The forfeiture ladder for this accused, priced on the item 6 date.
 *
 * READ FROM ITEM 19 AND ITEM 6, not from the punishment entries. At the
 * moment the hearing script prints, item 6 is empty and no reduction has
 * been chosen, so every rung is a "what if" and none is operative yet. Once
 * a reduction IS recorded, `gradeReducedTo` names the operative rung and the
 * same function serves the app's own display.
 */
export function scriptForfeitureLadder(formData: FormData): ForfeitureLadder {
  const reduction = (Array.isArray(formData.punishments)
    ? (formData.punishments as Navmc10132PunishmentEntry[])
    : []
  ).find((entry) => typeof entry?.gradeReducedTo === 'string' && entry.gradeReducedTo.trim() !== '');

  return forfeitureLadder({
    payGrade: str(formData, 'accusedPayGrade'),
    yearsOfService: str(formData, 'accusedYearsOfService'),
    seaHardshipDutyPay: str(formData, 'accusedSeaHardshipDutyPay'),
    punishmentDate: str(formData, 'punishmentDate'),
    gradeReducedTo: reduction?.gradeReducedTo ?? '',
  });
}

/**
 * What the worksheet cannot print yet, and what to set to fix it.
 *
 * SEPARATE FROM READINESS ON PURPOSE. None of these stops the script being
 * generated: A-1-f without a menu is still the appendix, with a blank rule
 * for hand completion, and Stephen's commanding officer still needs the
 * paper. These are things the clerk can improve before printing, so they
 * belong in the panel as advice rather than in `njpScriptReadiness` as a
 * gate.
 */
export function scriptWorksheetGaps(formData: FormData): string[] {
  const gaps: string[] = [];
  if (
    punishmentMenu(str(formData, 'njpAuthorityPayGrade'), {
      payGrade: str(formData, 'accusedPayGrade'),
    }).length === 0
  ) {
    gaps.push(
      "set item 8A's pay grade to print the menu of punishments this commander may impose",
    );
  }
  const ladder = scriptForfeitureLadder(formData);
  if (ladder.rungs.length === 0) {
    gaps.push(
      ladder.unavailable?.reason === 'table-not-current'
        ? 'set the item 6 punishment date to the hearing date to print the forfeiture ceilings'
        : "set item 19's pay grade and years of service to print the forfeiture ceilings",
    );
  }
  return gaps;
}

export function buildScriptCase(formData: FormData): NjpScriptCase {
  const readiness = njpScriptReadiness(formData);
  if (!readiness.ready) {
    throw new NjpPackageError(
      `Cannot build the hearing script yet. Still needed: ${readiness.missing.join(', ')}.`,
    );
  }
  const imposed = announcedPunishment(formData);

  return {
    offenses: chargedOffenses(formData),
    findings: announcedFindings(formData),
    punishmentImposed: imposed,
    // COMPUTED ONLY WHERE NOTHING IS IMPOSED. A record copy of a completed
    // proceeding states what was imposed, and a menu of unchosen options
    // printed beneath that sentence would contradict it.
    punishmentOptions:
      imposed === ''
        ? punishmentMenu(str(formData, 'njpAuthorityPayGrade'), {
            payGrade: str(formData, 'accusedPayGrade'),
          })
        : [],
    ceilingBlock:
      imposed === '' ? forfeitureCeilingBlock(scriptForfeitureLadder(formData)) : [],
    // NOT ON THE NAVMC 10132, either of them. Left blank so the printed rule
    // is completed by hand, rather than inventing a superior authority.
    appealAuthority: '',
    appealAdvisor: '',
  };
}

/** Renders A-1-f to PDF from the current form state. */
export async function renderNjpProceedingScript(formData: FormData): Promise<PackageDocument> {
  const input = buildScriptCase(formData);
  const { lines, report } = renderNjpScript(input);

  if (report.unmatched.length > 0) {
    throw new NjpPackageError(
      `The ${APPENDIX_A_1_F.designator} template did not fill cleanly: ` +
        `${report.unmatched.map(([id]) => id).join(', ')}. The appendix text was ` +
        'likely regenerated and an anchor went stale.',
    );
  }

  const caption = `${captionName(accusedRankAbbreviation(formData), str(formData, 'accusedName'))}   ${str(formData, 'unit')}`;
  const rendered = await renderAppendixPdf(APPENDIX_A_1_F, lines, { caption });

  return {
    ...rendered,
    designator: APPENDIX_A_1_F.designator,
    filename: `${APPENDIX_A_1_F.designator}-njp-proceeding-script-${slug(
      captionName(accusedRankAbbreviation(formData), str(formData, 'accusedName')),
    )}.pdf`,
  };
}
