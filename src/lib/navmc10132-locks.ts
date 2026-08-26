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
};

/** Offense row letters, matching the form and navmc10132-acroform.ts. */
const ROW_LETTERS = ['A', 'B', 'C', 'D', 'E'] as const;

/** Reads the locked form-field names recorded by the last load, if any. */
function lockedFieldNames(formData: FormData): Set<string> {
  const report: unknown = formData.navmc10132LoadReport;
  if (!report || typeof report !== 'object') return new Set();
  const names = (report as { lockedFields?: unknown }).lockedFields;
  return Array.isArray(names) ? new Set(names.filter((n): n is string => typeof n === 'string')) : new Set();
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

/** True when this document was loaded from a file carrying signatures. */
export function navmc10132HasLocks(formData: FormData): boolean {
  return lockedFieldNames(formData).size > 0;
}
