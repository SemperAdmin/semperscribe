/**
 * Which document-state keys a loaded file's signatures have closed.
 *
 * STEPHEN'S RULING, 2026-08-25: "We should not be updating the locked
 * sections once that are blocked with the signature." The writer honours
 * that by refusing to write them. This module is the other half: the UI
 * has to STOP OFFERING them, because an editable box over a field a
 * signature has closed is a promise the export cannot keep. A clerk types
 * a correction, sees it in the app, exports, and the correction is not in
 * the file. That is worse than not offering the box.
 *
 * THE MAP IS THE INVERSE OF `navmc10132Values`, and only the part of it
 * that inverts. Items 6, 7 and 21 are rendered from structure, so a lock on
 * `6 PUNISHMENT IMPOSED` cannot be expressed as a lock on one input; it
 * closes the whole punishment section, and `SECTION_LOCKS` below says so
 * separately.
 *
 * NOTHING HERE IS COMPUTED FROM `stage`. The stage says which pass the
 * document is at; the LOCKS say which fields a signature actually closed,
 * and those are not the same question. A document at pass 3 that was never
 * signed has no locks at all, which is the ordinary case for a file the app
 * exported and nobody has taken to Acrobat yet. Locks come only from a
 * loaded file, so an unloaded document is never locked.
 */

import type { FormData } from '@/types';

/**
 * Form field name to the document-state key it was written from, for every
 * field that inverts one-to-one. Kept in step with SCALAR_FIELDS and
 * BOOLEAN_FIELDS in navmc10132-pdf-to-form.ts, and a test asserts they do
 * not drift.
 */
export const NAVMC_10132_FIELD_TO_KEY: Readonly<Record<string, string>> = {
  '17 UNIT': 'unit',
  '18 ACCUSED FULL NAME': 'accusedName',
  '20 ACCUSED EDIPI': 'accusedEdipi',
  '19 ACCUSED RANK/GRADE': 'accusedRankGrade',
  '2 DEMAND': 'demand',
  '2 COUNSELOPP': 'counselOpportunity',
  '2 ACC REFUSE TO SIGN': 'accusedRefusedToSign',
  '2 ACC ELECTION AND RIGHTS DATE_af_date': 'electionDate',
  '3 RIGHTS ATTEST DATE_af_date': 'rightsAttestDate',
  '4 CURRENT UAS OVER 24 HRS AND MARKS OF DESERTION': 'unauthorizedAbsences',
  '6 PUNISHMENT IMPOSITION DATE': 'punishmentDate',
  '8 NJP AUTHORITY NAME TITLE SERVICE': 'njpAuthorityName',
  '8A NJP AUTHORITY GRADE': 'njpAuthorityGrade',
  '8B NJP AUTHORITY EDIPI': 'njpAuthorityEdipi',
  '10 DATE OF DISPOSITION NOTICE': 'dispositionNoticeDate',
  '11 APPEAL ADVISEMENT DATE_af_date': 'appealAdvisementDate',
  '12 INTEND APPEAL': 'intendAppeal',
  '12 APPEAL INTENT DATE_af_date': 'appealIntentDate',
  '13 NOT APPEALED': 'notAppealed',
  '13 DATE OF APPEAL IF ANY_af_date': 'appealDate',
  '14 APPEAL DECISION': 'appealDecision',
  '14 APPEAL DECISION DATE_af_date': 'appealDecisionDate',
  '15 DATE OF NOTICE OF APPEAL DECISION_af_date': 'appealDecisionNoticeDate',
  '16 FINAL ADMIN UD': 'finalAdminUd',
  '16 FINAL ADMIN DTD': 'finalAdminDtd',
};

/**
 * Locks that close a whole editor rather than one input, because the field
 * behind them is rendered from structure the form cannot hold.
 *
 * Keyed by a name the UI uses, not by a form field, so a section can ask one
 * question. `offenseRow` is the item 1 half of an offense row: the article
 * and the summary. The item 5 FINDING on the same row is a separate field
 * with its own lock, and on a real pass-2 file the article is closed while
 * the finding is still open, which is the whole reason these are separate.
 */
export const NAVMC_10132_SECTION_LOCKS: Readonly<Record<string, readonly string[]>> = {
  punishments: ['6 PUNISHMENT IMPOSED'],
  suspensions: ['7 SUSPENSION IF ANY'],
  remarks: ['21 REMARKS'],
  victims: ['22A VICTIM STATUS', '22A VICTIM SEX', '22A VICTIM RACE', '22A VICTIM ETHNICITY'],
  // ITEMS 17-20, the accused block. Every one of these DOES invert to a
  // single input, so each already locks itself through NAVMC_10132_FIELD_TO_KEY
  // and the section entry adds nothing to the inputs. It exists so the UI can
  // ask ONE question of the whole block, which is what Stephen asked for on
  // 2026-08-26: "when item 2 is signed we do not need the Unit and Accused
  // (Items 17-20) or Item 22, Victims sections".
  //
  // ALL FOUR, not any. `isNavmc10132SectionLocked` requires every field, and
  // that is load-bearing here rather than incidental: the app-lock rule only
  // closes a field the file carries a VALUE for, so a file signed with item
  // 20 left blank leaves the EDIPI open, and collapsing the block would hide
  // the one box still needing a clerk.
  accused: ['17 UNIT', '18 ACCUSED FULL NAME', '19 ACCUSED RANK/GRADE', '20 ACCUSED EDIPI'],
};

/**
 * D-45: the six fields the item 9 signature was MEANT to close.
 *
 * DEFECT 3.9. The NAVMC 10132's own `/Lock` dictionary for
 * `9 NJP AUTHORITY SIGNATURE` names these under field names the form no
 * longer uses, so Acrobat closes nothing and the app reads no lock. Measured
 * on Stephen's own signed file on 2026-08-26: 45 fields come back locked and
 * not one of them is an item 8 field, while all 20 victim fields are.
 *
 * STEPHEN'S RULING, 2026-08-26, choosing between four options: close them
 * AT THE ITEM 9 SIGNATURE, not earlier. Item 8 names the officer imposing
 * the punishment. Until that officer has signed, nobody has attested to the
 * name, and a clerk's typo in a commanding officer's name or EDIPI has to
 * stay correctable. After the signature it is part of what was signed.
 *
 * Item 5's findings are NOT here. They are closed by the form's own lock
 * list under names that DO resolve, so they need no mitigation.
 */
export const NAVMC_10132_ITEM_9_LOCK_FIELDS: readonly string[] = [
  '6 PUNISHMENT IMPOSED',
  '6 PUNISHMENT IMPOSITION DATE',
  '8 NJP AUTHORITY NAME TITLE SERVICE',
  '8A NJP AUTHORITY GRADE',
  '8B NJP AUTHORITY EDIPI',
  '10 DATE OF DISPOSITION NOTICE',
];

/** The signature that closes them. */
export const NAVMC_10132_ITEM_9_SIGNATURE = '9 NJP AUTHORITY SIGNATURE';

/**
 * Which of the six the app should close, given what the loaded file carries.
 *
 * ONLY FIELDS THE FILE ACTUALLY CARRIES A VALUE FOR, and the exception is
 * the whole reason this takes `values` rather than just the signature list.
 * An app lock over a field the file left EMPTY is a trap, not a
 * safeguard: the signature attested to nothing there, the clerk still has
 * to fill it, and the incremental writer refuses every locked field, so
 * locking a blank item 10 would mean the app shows the date, refuses to
 * write it, and the export silently drops it. That is the data-loss path
 * Stephen already made me close once. A signature can only close what it
 * signed over.
 *
 * Computed AT LOAD, where the file's own values are in hand, and recorded
 * on the report. Re-deriving it later from `formData` would read values the
 * clerk has since edited and could close a field the file left open.
 */
export function navmc10132ItemNineAppLocks(
  signedSignatures: readonly string[],
  values: Readonly<Record<string, string | boolean>>,
): string[] {
  if (!signedSignatures.includes(NAVMC_10132_ITEM_9_SIGNATURE)) return [];
  return NAVMC_10132_ITEM_9_LOCK_FIELDS.filter((field) => {
    const value = values[field];
    return typeof value === 'string' ? value.trim() !== '' : value === true;
  });
}

/** Offense row letters, matching the form and navmc10132-acroform.ts. */
const ROW_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/**
 * The locked FORM FIELD names recorded by the last load, if any.
 *
 * Exported because the incremental writer needs the form's vocabulary, not
 * the document-state keys the UI asks about: it refuses by field name, and
 * the fields it must refuse include ones that have no input at all, such as
 * `2 BOOKER` and the derived items 6, 7 and 21.
 */
export function navmc10132LockedFieldNames(formData: FormData): Set<string> {
  return lockedFieldNames(formData);
}

/** String entries of one recorded field-name list on the load report. */
function reportList(formData: FormData, key: 'lockedFields' | 'appLockedFields'): string[] {
  const report: unknown = formData.navmc10132LoadReport;
  if (!report || typeof report !== 'object') return [];
  const names = (report as Record<string, unknown>)[key];
  return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string') : [];
}

/**
 * Closed by the FILE ITSELF: the field names its `/Lock` dictionaries
 * resolved to. Separate from the app locks below because the two answer to
 * different authorities, and an export refusal has to be able to say which.
 */
export function navmc10132FormLockedFieldNames(formData: FormData): Set<string> {
  return new Set(reportList(formData, 'lockedFields'));
}

/**
 * Closed by the APP, mitigating defect 3.9 where the form's own lock list
 * resolves to nothing. See navmc10132ItemNineAppLocks. Empty on any file
 * whose item 9 is unsigned, which is the ordinary pass-2 case.
 */
export function navmc10132AppLockedFieldNames(formData: FormData): Set<string> {
  return new Set(reportList(formData, 'appLockedFields'));
}

/** Reads every closed form-field name recorded by the last load, if any. */
function lockedFieldNames(formData: FormData): Set<string> {
  return new Set([
    ...reportList(formData, 'lockedFields'),
    ...reportList(formData, 'appLockedFields'),
  ]);
}

/**
 * The document-state keys that are closed, for the simple one-to-one
 * fields. A component holding an input for `unit` asks this.
 */
export function navmc10132LockedKeys(formData: FormData): Set<string> {
  const fields = lockedFieldNames(formData);
  const keys = new Set<string>();
  for (const [field, key] of Object.entries(NAVMC_10132_FIELD_TO_KEY)) {
    if (fields.has(field)) keys.add(key);
  }
  return keys;
}

/** Convenience for a single input. */
export function isNavmc10132KeyLocked(formData: FormData, key: string): boolean {
  return navmc10132LockedKeys(formData).has(key);
}

/**
 * Whether a whole editor is closed, by the names in
 * `NAVMC_10132_SECTION_LOCKS`. Every field the section owns must be locked
 * for the section to count as locked: a partially closed section is still
 * editable, and the individual inputs answer for themselves.
 */
export function isNavmc10132SectionLocked(formData: FormData, section: string): boolean {
  const required = NAVMC_10132_SECTION_LOCKS[section];
  if (!required || required.length === 0) return false;
  const fields = lockedFieldNames(formData);
  return required.every((name) => fields.has(name));
}

/**
 * Whether one offense row's item 1 half is closed, and separately its item
 * 5 finding.
 *
 * MEASURED ON A REAL PASS-2 FILE: the item 2 signature closes `1A ARTICLE`
 * and `1A SUMMARY` while `1A FINDING` stays open, because the finding is
 * the commander's determination at pass 3. One row, two answers, which is
 * why this returns both rather than a single boolean.
 */
export function navmc10132OffenseRowLocks(
  formData: FormData,
  index: number,
): { offenceLocked: boolean; findingLocked: boolean } {
  const letter = ROW_LETTERS[index];
  if (!letter) return { offenceLocked: false, findingLocked: false };
  const fields = lockedFieldNames(formData);
  return {
    offenceLocked: fields.has(`1${letter} ARTICLE`) || fields.has(`1${letter} SUMMARY`),
    findingLocked: fields.has(`1${letter} FINDING`),
  };
}

/**
 * Whether one named signature is APPLIED on the loaded file.
 *
 * DISTINCT FROM A LOCK, and the difference is the point. A lock says a
 * signature closed a particular FIELD. This says a signature exists at all,
 * which is what governs a question no field can answer: whether a new row
 * may be added.
 *
 * Empty on a document with no file behind it, so nothing is ever closed by
 * a signature the app has not read.
 */
export function navmc10132SignatureApplied(formData: FormData, signature: string): boolean {
  const report: unknown = formData.navmc10132LoadReport;
  if (!report || typeof report !== 'object') return false;
  const signed = (report as { signedSignatures?: unknown }).signedSignatures;
  return Array.isArray(signed) && signed.includes(signature);
}

/**
 * The item 3 attestation, which closes the CHARGE SHEET rather than a field.
 *
 * STEPHEN, 2026-08-26: "once a signed item 3 is done we should not eb able
 * to add more offenses". Item 3 reads "The accused has been afforded these
 * rights under Article 31, UCMJ, and advised of the right to demand trial by
 * court-martial", and the commanding officer certifies it. THESE rights are
 * the ones concerning the offenses as they stood at that moment. A sixth
 * offense added afterwards is one the accused was never advised of, and the
 * certificate above it would say otherwise.
 *
 * The FIELD locks are a separate matter and already handled: the item 2
 * signature closes each filled row's article and summary. Nothing closed an
 * EMPTY row, because the form has no lock to place on a field with no value,
 * which is why an empty row F stayed addable over a signed charge sheet.
 */
export function navmc10132ChargesClosed(formData: FormData): boolean {
  return navmc10132SignatureApplied(formData, '3 RIGHTS ATTEST SIGNATURE');
}

/** True when this document was loaded from a file carrying signatures. */
export function navmc10132HasLocks(formData: FormData): boolean {
  return lockedFieldNames(formData).size > 0;
}
