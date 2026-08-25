/**
 * Notice of Intent to Vacate Suspended Punishment, MCO 5800.16 Figure 14-1.
 *
 * WHY THIS IS A STANDARD LETTER AND NOT A JAGMAN APPENDIX. Figure 14-1 is a
 * naval letter: From, To, Subj, Ref, numbered paragraphs, signature block,
 * Copy to. The fixed-width A-1 renderer in this codebase exists for JAGMAN
 * appendices, which print as monospace forms, and pointing it at this figure
 * would produce a Courier document where a letter belongs. So this module
 * produces a payload for the CORRESPONDENCE engine instead.
 *
 * THE HANDOFF PROBLEM, and the reason this module saves before it seeds.
 * `handleLoadTemplateUrl` in useImportExport.ts fetches a template and calls
 * `handleImport`, which REPLACES the whole document. A clerk sitting on a
 * NAVMC 10132 who loads this template would lose the NJP outright. So the
 * flow is: persist the 10132 to the document library first, then seed the
 * letter from it. `vacationHandoff` returns both halves and the caller does
 * them in that order. Do not reorder them.
 *
 * WHAT THIS FILLS AND WHAT IT CANNOT. Everything Figure 14-1 asks for that
 * the NAVMC 10132 already knows is filled: the unit, the accused, the NJP
 * date, the suspension period, and which punishment was suspended. Three
 * things the form does not carry are left as the figure's own blanks:
 *
 *   - the offense committed during the suspension ("to wit ______"), which
 *     by definition post-dates the NJP and is the whole basis for the action
 *   - the FULL / PART election in paragraph 2, which is the commander's
 *     decision and not a derivable fact
 *   - the point of contact in paragraph 3
 *
 * MOS IS MISSING FROM THE APP. Figure 14-1's To line is captioned "(Rank
 * First Last EDIPI/MOS USMC)" and no field anywhere in this codebase records
 * an MOS. It is left as a blank in the rendered line rather than silently
 * dropped, so the clerk can see what is missing rather than shipping a To
 * line that looks complete.
 *
 * THE NAME IS REORDERED, and that is a real transformation rather than a
 * copy. Item 18 collects "Last, First Middle" because that is what the form
 * prints. Figure 14-1 wants "Rank First Last". Reversing a comma-separated
 * name is safe; inventing punctuation is not, so the middle initial is
 * carried through exactly as entered.
 */

import type { FormData, SavedLetter } from '@/types';
import type { Navmc10132PunishmentEntry } from '@/types/navmc';
import { renderPunishment, resolvePunishment } from '@/lib/navmc10132-utils';
import { formatNavalDate } from '@/lib/navmc10132-date';
import { suspensionPeriods, vacationDeadlines, type SuspensionPeriod } from '@/lib/njp-suspension-period';

/** SSIC and originator code as Figure 14-1 prints them. */
export const VACATION_SSIC = '5800';
export const VACATION_ORIGINATOR_CODE = 'S1';
export const VACATION_SUBJ = 'INTENT TO VACATE PREVIOUSLY SUSPENDED PUNISHMENT';
/** Reference (a) exactly as the figure cites it, without a volume. */
export const VACATION_REFERENCE = 'MCO 5800.16';
export const VACATION_COPY_TO: readonly string[] = ['Files', 'IPAC'];

function str(formData: FormData, key: string): string {
  const value: unknown = formData[key];
  return typeof value === 'string' ? value.trim() : '';
}

function punishmentEntries(formData: FormData): Navmc10132PunishmentEntry[] {
  return Array.isArray(formData.punishments)
    ? (formData.punishments as Navmc10132PunishmentEntry[])
    : [];
}

/**
 * "RIVERA, DIEGO M" becomes "DIEGO M RIVERA".
 *
 * Splits on the FIRST comma only, so a suffix in the surname ("RIVERA JR,
 * DIEGO M") keeps its position rather than being scattered. A name with no
 * comma is returned unchanged: it is already in some order this function
 * cannot second-guess.
 */
export function nameFirstLast(accusedName: string): string {
  const value = accusedName.trim();
  const comma = value.indexOf(',');
  if (comma === -1) return value;
  const last = value.slice(0, comma).trim();
  const rest = value.slice(comma + 1).trim();
  return rest === '' ? last : `${rest} ${last}`;
}

/** The rank half of item 19's composed "LCpl, E3". */
export function rankOnly(accusedRankGrade: string): string {
  return accusedRankGrade.split(',')[0].trim();
}

/**
 * The To line, in Figure 14-1's own caption order.
 *
 * MOS has no field in this app, so it renders as an underscore blank rather
 * than being omitted. A To line that reads complete while missing a required
 * element is worse than one that visibly asks for it.
 */
export function vacationToLine(formData: FormData): string {
  const rank = rankOnly(str(formData, 'accusedRankGrade'));
  const name = nameFirstLast(str(formData, 'accusedName'));
  const edipi = str(formData, 'accusedEdipi');
  const parts = [rank, name].filter((p) => p !== '');
  const id = `${edipi === '' ? '__________' : edipi}/________`;
  return `${parts.join(' ')} ${id} USMC`.trim();
}

export interface VacationReadiness {
  ready: boolean;
  missing: string[];
}

/**
 * What Figure 14-1 needs before it can be seeded.
 *
 * A SUSPENSION IS THE PRECONDITION. There is nothing to vacate without one,
 * so this is not merely a missing field but the wrong document.
 */
export function vacationReadiness(formData: FormData): VacationReadiness {
  const missing: string[] = [];
  if (suspensionPeriods(formData).length === 0) {
    missing.push('a suspended punishment in item 7, since there is nothing to vacate without one');
  }
  if (str(formData, 'unit') === '') missing.push('the unit (item 17)');
  if (str(formData, 'accusedName') === '') missing.push("the accused's name (item 18)");
  if (rankOnly(str(formData, 'accusedRankGrade')) === '') missing.push("the accused's rank (item 19)");
  if (str(formData, 'punishmentDate') === '') missing.push('the item 6 punishment date');
  return { ready: missing.length === 0, missing };
}

/** The punishment text a suspension points at, for paragraph 1's blank. */
function suspendedPunishmentText(formData: FormData, period: SuspensionPeriod): string {
  const entry = punishmentEntries(formData)[period.punishmentIndex];
  if (!entry) return '';
  const code = resolvePunishment(entry.code);
  if (!code) return '';
  try {
    return renderPunishment([entry]).text;
  } catch {
    // renderPunishment throws when a code's template parameter is unset,
    // which is ordinary mid-entry state. The description is a truthful
    // fallback that names the punishment without inventing its terms.
    return code.description;
  }
}

export interface VacationParagraphs {
  /** Paragraph 1, with every fact the 10132 knows already interpolated. */
  basis: string;
  /** Paragraph 2, the FULL / PART election left to the commander. */
  election: string;
  /** Paragraph 3, the point of contact. */
  pointOfContact: string;
}

/**
 * The three numbered paragraphs, with the figure's remaining blanks left as
 * underscores exactly where it prints them.
 */
export function vacationParagraphs(
  formData: FormData,
  period: SuspensionPeriod,
): VacationParagraphs {
  const njpDate = formatNavalDate(str(formData, 'punishmentDate')) || '__________';
  const stated = period.stated === '' ? '____ months' : period.stated;
  const punishment = suspendedPunishmentText(formData, period);

  return {
    basis:
      `On ${njpDate} you received non-judicial punishment (NJP) and a portion/all of the ` +
      `punishment was suspended for ${stated}. During the period of the suspension, you ` +
      'committed another offense under the Uniform Code of Military Justice, to wit ' +
      '_______________________________. The suspension of the following punishment will be ' +
      `vacated: ${punishment === '' ? '______________________________________________' : punishment}`,
    election: 'It is my intent to vacate your previously suspended punishment in: FULL/PART',
    pointOfContact:
      'The point of contact at this command concerning this matter is ____________________ at ' +
      'comm: ____________________.',
  };
}

export interface VacationHandoff {
  /** Save this FIRST. The seed replaces the open document. */
  save: SavedLetter;
  /** Then apply this as the new document. */
  seed: Record<string, unknown>;
  /** The suspension this notice acts on. */
  period: SuspensionPeriod;
  /** Shown to the clerk before anything happens. */
  deadline: string;
}

/**
 * Both halves of the handoff, in the order they must be performed.
 *
 * `save` is the NAVMC 10132 as it stands, so the case survives the swap.
 * `seed` is the letter payload. The caller persists the first and imports
 * the second; doing it the other way round loses the NJP.
 */
export function vacationHandoff(
  formData: FormData,
  suspensionIndex: number,
  options: { now: string; documentId: string },
): VacationHandoff {
  const periods = suspensionPeriods(formData);
  const period = periods[suspensionIndex];
  if (!period) {
    throw new Error(
      `No suspension at index ${suspensionIndex}. Item 7 carries ${periods.length}.`,
    );
  }

  const paragraphs = vacationParagraphs(formData, period);
  const unit = str(formData, 'unit');

  const save: SavedLetter = {
    ...(formData as FormData),
    id: options.documentId,
    savedAt: options.now,
    updatedAt: options.now,
    name:
      `NAVMC 10132 - ${rankOnly(str(formData, 'accusedRankGrade'))} ` +
      `${str(formData, 'accusedName')}`.trim(),
    vias: [],
    references: [],
    enclosures: [],
    copyTos: [],
    paragraphs: [],
  } as SavedLetter;

  const seed: Record<string, unknown> = {
    documentType: 'basic',
    ssic: VACATION_SSIC,
    originatorCode: VACATION_ORIGINATOR_CODE,
    from: `Commanding Officer, ${unit}`,
    to: vacationToLine(formData),
    subj: VACATION_SUBJ,
    // The NJP's own letterhead fields are NOT carried over. A template with
    // empty letterhead lines lets handleLoadTemplateUrl keep whatever unit
    // the user already selected, which is the established behaviour there.
  };

  // THE HANDOFF MESSAGE MUST NOT RESTATE THE DEADLINE SENTENCE. It used to
  // (see D-51 in docs/NAVMC_10132_SPEC.md): two places authoring the same
  // legal sentence can drift, and one drifted, understating the date's
  // conditionality relative to the other. Consuming `vacationDeadlines`
  // instead of re-deriving the wording here makes the two agree by
  // construction, not by two hand-synced literals.
  //
  // MATCH ON suspensionIndex, NEVER punishmentIndex. V-31 (D-59) blocks two
  // item 7 suspensions naming the same punishment, but that is an EXPORT
  // GATE and not a data-model guarantee: this function runs on in-flight
  // state, long before any gate. Matching on punishmentIndex returned the
  // FIRST suspension against that punishment whatever the caller asked for,
  // so the letter could carry another suspension's deadline. suspensionIndex
  // is this suspension's own position in item 7 and is unambiguous.
  const deadline = vacationDeadlines(formData).find(
    (d) => d.suspensionIndex === suspensionIndex,
  );

  return {
    save,
    seed,
    period,
    deadline:
      deadline === undefined
        ? 'The suspension period is not readable, so the vacation deadline cannot be computed.'
        : `Vacate on or before ${deadline.endsOnIfUninterrupted}. ${deadline.caveat}`,
  };
}

/** Paragraph bodies in print order, for the caller to attach to the letter. */
export function vacationParagraphList(paragraphs: VacationParagraphs): string[] {
  return [paragraphs.basis, paragraphs.election, paragraphs.pointOfContact];
}

export { VACATION_COPY_TO as vacationCopyTo };
