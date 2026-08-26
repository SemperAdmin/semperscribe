/**
 * Turning a NAVMC 10132 read out of a PDF back into document state.
 *
 * The inverse of `navmc10132Values` (navmc10132-acroform.ts), and it is a
 * PARTIAL inverse on purpose, because that function is not injective. Four
 * of its outputs are RENDERED from structure the form has nowhere to keep:
 *
 *   | field                 | written from        | comes back as |
 *   | 6 PUNISHMENT IMPOSED  | `punishments[]`     | one string    |
 *   | 7 SUSPENSION IF ANY   | `suspensions[]`     | one string    |
 *   | 21 REMARKS            | `remarks[]` + more  | one string    |
 *   | 2 BOOKER              | three elections     | one string    |
 *
 * A parser that guessed the structure back out of those strings would be
 * inventing a legal record, so nothing here parses them. They are reported
 * as `carriedFromFile`, shown to the clerk, and left in the file. See
 * `WHY NOT PARSING THEM COSTS NOTHING` below, which is the part that makes
 * this acceptable rather than merely honest.
 *
 * STEPHEN'S RULING, 2026-08-25, and it decides the two hard cases:
 * "The uploaded form is the truth but if wrong for any reason can be
 * flagged. We should not be updating the locked sections once that are
 * blocked with the signature."
 *
 * So: the file wins on every field it carries, disagreements are FLAGGED
 * rather than silently resolved or blocked, and the locked set computed by
 * navmc10132-pdf-read.ts is carried through to the writer untouched.
 *
 * WHY NOT PARSING THEM COSTS NOTHING, in the workflow this actually serves.
 * The upload happens at a PASS BOUNDARY. At the boundary this was measured
 * on, end of pass 2, items 6, 7 and 21 are EMPTY on the file, because they
 * are pass-3 and pass-7 work that has not happened. The clerk is about to
 * enter them for the first time. The strings only become unrecoverable on a
 * LATE re-upload, and even then the incremental writer leaves them in the
 * file untouched: nothing is lost from the DOCUMENT, only from the app's
 * structured view of it. What that costs is the app's ability to VALIDATE
 * them on a late pass, which is recorded rather than papered over.
 *
 * ITEMS 23-25 ARE A CROSS-CHECK, NOT A SOURCE. Page 2 carries a second copy
 * of the accused identity, filled by the form's own calculate scripts.
 * Reading them back as data would let a stale calculation overwrite items
 * 18-20. They are compared instead, and a mismatch is flagged: it means
 * either the scripts did not run or someone edited one copy.
 */

import type { FormData } from '@/types';
import type { Navmc10132PdfRead } from '@/lib/navmc10132-pdf-read';
import type { Navmc10132Offense, Navmc10132Victim } from '@/types/navmc';

/** One place the file and the open document disagree. */
export interface Navmc10132Conflict {
  /** The form field, in the clerk's terms. */
  label: string;
  /** What the uploaded file says. This is the value that wins. */
  fromFile: string;
  /** What the open document said before the load. */
  fromForm: string;
  /** True when the file's value is inside a section a signature has closed. */
  locked: boolean;
}

export interface Navmc10132PdfToForm {
  /** The state patch to merge, file-wins, over the open document. */
  patch: Partial<FormData> & Record<string, unknown>;
  /** Disagreements between file and form, for flagging. Never blocking. */
  conflicts: Navmc10132Conflict[];
  /**
   * Fields the file carries that this app cannot rebuild into structure.
   * Displayed, never parsed, and left in the file by the writer.
   */
  carriedFromFile: { label: string; value: string }[];
  /** Plain-language notes for the clerk, including the read's own. */
  notes: string[];
}

/** Field name to the `FormData` key it was written from, for the scalars
 *  that invert exactly. Anything not in this table is handled by name
 *  below, or deliberately not read back at all. */
const SCALAR_FIELDS: { field: string; key: string; label: string }[] = [
  { field: '17 UNIT', key: 'unit', label: 'Unit (item 17)' },
  { field: '18 ACCUSED FULL NAME', key: 'accusedName', label: 'Accused (item 18)' },
  { field: '20 ACCUSED EDIPI', key: 'accusedEdipi', label: 'EDIPI (item 20)' },
  { field: '2 COUNSELOPP', key: 'counselOpportunity', label: 'Counsel opportunity (item 2)' },
  { field: '2 ACC ELECTION AND RIGHTS DATE_af_date', key: 'electionDate', label: 'Election date (item 2)' },
  { field: '3 RIGHTS ATTEST DATE_af_date', key: 'rightsAttestDate', label: 'Rights certification date (item 3)' },
  { field: '4 CURRENT UAS OVER 24 HRS AND MARKS OF DESERTION', key: 'unauthorizedAbsences', label: 'Unauthorized absence (item 4)' },
  { field: '6 PUNISHMENT IMPOSITION DATE', key: 'punishmentDate', label: 'Punishment date (item 6)' },
  { field: '8 NJP AUTHORITY NAME TITLE SERVICE', key: 'njpAuthorityName', label: 'NJP authority (item 8)' },
  { field: '8A NJP AUTHORITY GRADE', key: 'njpAuthorityGrade', label: 'NJP authority grade (item 8A)' },
  { field: '8B NJP AUTHORITY EDIPI', key: 'njpAuthorityEdipi', label: 'NJP authority EDIPI (item 8B)' },
  { field: '10 DATE OF DISPOSITION NOTICE', key: 'dispositionNoticeDate', label: 'Disposition notice date (item 10)' },
  { field: '11 APPEAL ADVISEMENT DATE_af_date', key: 'appealAdvisementDate', label: 'Appeal advisement date (item 11)' },
  { field: '12 INTEND APPEAL', key: 'intendAppeal', label: 'Appeal intention (item 12)' },
  { field: '12 APPEAL INTENT DATE_af_date', key: 'appealIntentDate', label: 'Appeal intent date (item 12)' },
  { field: '13 DATE OF APPEAL IF ANY_af_date', key: 'appealDate', label: 'Date of appeal (item 13)' },
  { field: '14 APPEAL DECISION', key: 'appealDecision', label: 'Appeal decision (item 14)' },
  { field: '14 APPEAL DECISION DATE_af_date', key: 'appealDecisionDate', label: 'Appeal decision date (item 14)' },
  { field: '15 DATE OF NOTICE OF APPEAL DECISION_af_date', key: 'appealDecisionNoticeDate', label: 'Notice of decision date (item 15)' },
  { field: '16 FINAL ADMIN UD', key: 'finalAdminUd', label: 'Unit diary number (item 16)' },
  { field: '16 FINAL ADMIN DTD', key: 'finalAdminDtd', label: 'Unit diary date (item 16)' },
  { field: '2 DEMAND', key: 'demand', label: 'Election (item 2)' },
];

/** Checkbox fields, which read back as 'true' or ''. */
const BOOLEAN_FIELDS: { field: string; key: string; label: string }[] = [
  { field: '2 ACC REFUSE TO SIGN', key: 'accusedRefusedToSign', label: 'Accused refused to sign (item 2)' },
  { field: '13 NOT APPEALED', key: 'notAppealed', label: 'Not appealed (item 13)' },
];

/**
 * Written by `navmc10132Values` from structure, and NOT parsed back. Order
 * is the order a clerk reads the form.
 */
const DERIVED_FIELDS: { field: string; label: string; lost: string }[] = [
  { field: '6 PUNISHMENT IMPOSED', label: 'Punishment imposed (item 6)', lost: 'the individual punishment codes, days and amounts' },
  { field: '7 SUSPENSION IF ANY', label: 'Suspension (item 7)', lost: 'which punishment is suspended and for how long' },
  { field: '21 REMARKS', label: 'Remarks (item 21)', lost: 'the individual remark entries and their formats' },
  { field: '2 BOOKER', label: 'Booker statement (item 2)', lost: 'nothing, it is recomputed from the three elections' },
];

const ROW_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

function currentString(formData: FormData, key: string): string {
  const value: unknown = formData[key];
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'boolean') return value ? 'true' : '';
  return '';
}

/**
 * Map a read file onto the open document.
 *
 * `formData` is only READ, to find disagreements. Nothing is mutated here;
 * the caller merges `patch`.
 */
export function navmc10132PdfToForm(
  read: Navmc10132PdfRead,
  formData: FormData,
): Navmc10132PdfToForm {
  const patch: Record<string, unknown> = {};
  const conflicts: Navmc10132Conflict[] = [];
  const carriedFromFile: { label: string; value: string }[] = [];
  const notes = [...read.notes];

  /**
   * A CONFLICT IS NOT ANY DIFFERENCE, and getting that wrong makes the
   * feature useless. Loading a signed file into a fresh document differs on
   * every field the file carries: on the measured file that is twelve
   * "conflicts" on a load where nothing is in dispute and nothing was
   * overwritten. A clerk shown twelve flags on a clean load learns to
   * dismiss the flag.
   *
   * Two things are worth flagging, and they are the two where something
   * could be wrong:
   *
   *   - BOTH sides say something and they disagree. The file wins, per
   *     Stephen's ruling, and he asked to be able to see it when the file
   *     is wrong.
   *   - The FILE is empty and the form is not. Here the file did NOT win,
   *     by the resolve() rule below, so the clerk is looking at app data
   *     the paper does not have. That is the one case where the load left
   *     the two out of step on purpose.
   *
   * The file filling a field the app had left empty is neither. It is the
   * load working.
   */
  const flag = (label: string, field: string, fromFile: string, fromForm: string) => {
    if (fromFile === fromForm) return;
    if (fromFile !== '' && fromForm === '') return;
    conflicts.push({ label, fromFile, fromForm, locked: read.lockedFields.has(field) });
  };

  /**
   * THE ONE PLACE THIS READS STEPHEN'S RULING NARROWLY, and it is flagged
   * here rather than buried, because it is a judgment call he can overturn
   * in one line.
   *
   * The ruling is that the uploaded form is the truth. Taken absolutely,
   * that means an EMPTY field on the file overwrites a filled field in the
   * app. Consider the workflow that produces: a clerk is at pass 3, has
   * typed the punishment into the app, and then uploads the signed pass-2
   * file to carry the signatures forward. Item 6 is empty on that file,
   * because item 6 is pass-3 work that has not happened on paper yet.
   * Absolute file-wins deletes what he just typed.
   *
   * So the rule applied is: THE FILE WINS WHERE THE FILE SAYS SOMETHING.
   * An empty field is the file not having reached that field yet, not the
   * file asserting emptiness, and the app's value is kept and FLAGGED. No
   * value is ever silently discarded in either direction: every difference
   * lands in `conflicts` whichever way it resolved.
   *
   * To make it absolute instead, return `fromFile` unconditionally here.
   */
  const resolve = (fromFile: string, fromForm: string): string =>
    fromFile !== '' ? fromFile : fromForm;

  for (const { field, key, label } of SCALAR_FIELDS) {
    const fromFile = (read.values[field] ?? '').trim();
    const fromForm = currentString(formData, key);
    flag(label, field, fromFile, fromForm);
    patch[key] = resolve(fromFile, fromForm);
  }

  // Checkboxes have no "empty" state distinct from false, so there is no
  // resolve() here: an unchecked box on the file is a real answer, not an
  // absence, and it wins.
  for (const { field, key, label } of BOOLEAN_FIELDS) {
    const raw = (read.values[field] ?? '').trim();
    const fromFile = raw === 'true' || raw === 'Yes' || raw === 'On';
    flag(label, field, fromFile ? 'true' : '', currentString(formData, key));
    patch[key] = fromFile;
  }

  // --- Item 19, rank and grade, which is composed on the way out --------
  // `navmc10132Values` writes one string built from the rank and the pay
  // grade. There is no safe split back: "Cpl, E4" happens to be comma
  // separated and "GySgt, E7" does too, but nothing guarantees it and a
  // wrong split writes a wrong grade onto a legal record. The composed
  // value is kept for display and the components are left alone.
  const rankGrade = (read.values['19 ACCUSED RANK/GRADE'] ?? '').trim();
  if (rankGrade) {
    carriedFromFile.push({ label: 'Rank and grade (item 19)', value: rankGrade });
    const formRankGrade = currentString(formData, 'accusedRankGrade');
    flag('Rank and grade (item 19)', '19 ACCUSED RANK/GRADE', rankGrade, formRankGrade);
  }

  // --- Item 1 and item 5: the offense rows, which DO invert -------------
  const offenses: Navmc10132Offense[] = [];
  ROW_LETTERS.forEach((letter) => {
    const articleLabel = (read.values[`1${letter} ARTICLE`] ?? '').trim();
    const summary = (read.values[`1${letter} SUMMARY`] ?? '').trim();
    const finding = (read.values[`1${letter} FINDING`] ?? '').trim();
    if (!articleLabel && !summary && !finding) return;
    offenses.push({
      articleLabel,
      summary,
      // The export maps 'Guilty' to its own display value; the stored
      // vocabulary is the long string, which is what comes back.
      finding: (finding as Navmc10132Offense['finding']) || '',
      // NOT ON THE FORM. The MCTFS code is app state derived from the
      // article, so it is re-derived by whatever reads it rather than
      // guessed here.
      mctfsCode: '',
    } as Navmc10132Offense);
  });
  if (offenses.length > 0) patch.offenses = offenses;

  // --- Item 22 row A: the only victim row the form carries -------------
  const victimA: Navmc10132Victim = {
    status: (read.values['22A VICTIM STATUS'] ?? '').trim(),
    sex: (read.values['22A VICTIM SEX'] ?? '').trim(),
    race: (read.values['22A VICTIM RACE'] ?? '').trim(),
    ethnicity: (read.values['22A VICTIM ETHNICITY'] ?? '').trim(),
  } as Navmc10132Victim;
  if (victimA.status || victimA.sex || victimA.race || victimA.ethnicity) {
    patch.victims = [victimA];
    notes.push(
      'Only victim row A is on the form. Victims 2 through 5 are recorded in item 21 as ' +
        'prose and cannot be read back as separate rows, so re-enter them if you need them ' +
        'as structure.',
    );
  }

  // --- The derived strings, reported and not parsed ---------------------
  for (const { field, label, lost } of DERIVED_FIELDS) {
    const value = (read.values[field] ?? '').trim();
    if (!value) continue;
    carriedFromFile.push({ label, value });
    if (field !== '2 BOOKER') {
      notes.push(
        `${label} is carried in the file as one line of text. This app cannot rebuild ${lost} ` +
          'from it, so it stays in the file exactly as it is and is not re-validated.',
      );
    }
  }

  // --- Items 23-25: cross-check only -----------------------------------
  const page2 = [
    ['23 ACCUSED FULL NAME', '18 ACCUSED FULL NAME', 'name'],
    ['24 ACCUSED RANK/GRADE', '19 ACCUSED RANK/GRADE', 'rank and grade'],
    ['25 ACCUSED EDIPI', '20 ACCUSED EDIPI', 'EDIPI'],
  ];
  for (const [copy, source, what] of page2) {
    const a = (read.values[copy] ?? '').trim();
    const b = (read.values[source] ?? '').trim();
    if (a && b && a !== b) {
      notes.push(
        `Page 2 shows a different accused ${what} ("${a}") than page 1 ("${b}"). The form fills ` +
          'page 2 by script, so this means either the script did not run or one copy was ' +
          'edited. Check the file before signing anything further.',
      );
    }
  }

  // --- The stage, which the file decides --------------------------------
  patch.stage = read.stage;
  patch.documentType = 'navmc10132';

  if (read.signedSignatures.length > 0) {
    notes.push(
      `${read.signedSignatures.length} signature(s) applied, closing ${read.lockedFields.size} ` +
        'fields. Those are not editable here and will not be written on export.',
    );
  }

  return { patch, conflicts, carriedFromFile, notes };
}
