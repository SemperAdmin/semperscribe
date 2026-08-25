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
import {
  NJP_AUTHORITY_LEVEL_LABEL,
  maximumPunishment,
  resolveAuthorityLevel,
  type NjpAuthorityLevel,
} from '@/lib/njp-maximum-punishment';
import type { Navmc10132Service } from '@/lib/navmc10132-ranks';
import { renderAppendixPdf, type AppendixPdfResult } from '@/lib/jagman-a1-pdf';

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
