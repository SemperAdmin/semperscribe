/**
 * Recognizing a NAVMC 10132 PDF and loading it into the open document.
 *
 * THE ONE ENTRY POINT for the return leg. `navmc10132-pdf-read.ts` parses,
 * `navmc10132-pdf-to-form.ts` maps, and this decides whether a given file is
 * a UPB at all and hands back everything the caller needs in one object.
 *
 * WHY THIS SHARES THE EXISTING IMPORT MENU RATHER THAN ADDING ITS OWN.
 * Stephen's question, 2026-08-25: "can we use the import function?" Yes, and
 * it is better. A clerk should not have to know which of two importers to
 * pick; the app can tell what it is holding by opening the file. So "Import
 * Word/PDF Document..." routes: a NAVMC 10132 comes here, everything else
 * goes to the text importer as before.
 *
 * THAT MAKES THE REFUSAL NARROWER, NOT WRONG. The refusal added the same day
 * stopped a live data-loss path, where a signed UPB imported as a Basic
 * Letter and destroyed the case. It still stops that for XFA forms and for
 * NAVMC forms other than the 10132, because no reader exists for those. The
 * 10132 gets a door because it now has one.
 *
 * RECOGNITION IS BY FIELD NAMES, NEVER BY TEXT. The text layer of this form
 * is the blank's boilerplate whether it is empty or fully filled, so nothing
 * in it distinguishes one UPB from another, or a UPB from a scan of one. The
 * AcroForm field names are the form's identity: `18 ACCUSED FULL NAME` and
 * `9 NJP AUTHORITY SIGNATURE` appear on no other document.
 *
 * A QUORUM, NOT AN EXACT MATCH. A future revision of the form may rename or
 * add a field, and refusing the whole file over one renamed field would be
 * worse than reading the rest. Enough marker fields to be certain, and a
 * count rather than a set.
 */

import type { FormData } from '@/types';
import { navmc10132ItemNineAppLocks } from '@/lib/navmc10132-locks';
import {
  readNavmc10132Pdf,
  Navmc10132ReadError,
  type Navmc10132PdfRead,
} from '@/lib/navmc10132-pdf-read';
import {
  navmc10132PdfToForm,
  type Navmc10132Conflict,
} from '@/lib/navmc10132-pdf-to-form';

/**
 * Field names that identify this form. Chosen to span all three pages and
 * both field kinds, so a partial or damaged file still trips the quorum.
 */
const MARKER_FIELDS: readonly string[] = [
  '17 UNIT',
  '18 ACCUSED FULL NAME',
  '20 ACCUSED EDIPI',
  '1A ARTICLE',
  '2 BOOKER',
  '6 PUNISHMENT IMPOSED',
  '8 NJP AUTHORITY NAME TITLE SERVICE',
  '9 NJP AUTHORITY SIGNATURE',
  '16 FINAL ADMIN INIT',
  '21 REMARKS',
];

/** How many markers must be present. Six of ten leaves room for a form
 *  revision to rename a few fields without making the file unreadable. */
const MARKER_QUORUM = 6;

/** What a load produced, for the clerk. `patch` is what the caller merges. */
export interface Navmc10132LoadResult {
  patch: Record<string, unknown>;
  report: Navmc10132LoadReport;
}

/**
 * The clerk-facing record of a load. Kept on document state deliberately,
 * alongside `vesselException` and `stage`, which are app-only in the same
 * way: it survives a save and reload, so the flags raised when a file was
 * loaded are still there when someone picks the case up next week. The
 * acroform writer only writes field names it knows, so this is inert on
 * export.
 */
export interface Navmc10132LoadReport {
  /** File name as the clerk chose it, for the panel heading. */
  fileName: string;
  /** Which pass the file put the document at. */
  stage: Navmc10132PdfRead['stage'];
  /** Signature field names carrying a signature. */
  signedSignatures: string[];
  /** How many fields those signatures closed. */
  lockedFieldCount: number;
  /**
   * The closed field names themselves, which the UI needs and the count
   * cannot give it. navmc10132-locks.ts turns these into the document-state
   * keys a component can ask about, so an input over a closed field is
   * shown closed rather than offering an edit the export will not keep.
   */
  lockedFields: string[];
  /**
   * Fields the APP closes that the file left open, D-45 and defect 3.9.
   *
   * The form's `/Lock` dictionary for `9 NJP AUTHORITY SIGNATURE` names
   * fields under names the form no longer uses, so it closes nothing.
   * Recorded here rather than derived later, because it depends on the
   * values the FILE carried, not on values the clerk may since have edited.
   * See navmc10132ItemNineAppLocks.
   */
  appLockedFields: string[];
  /** Disagreements between file and form. See navmc10132-pdf-to-form.ts. */
  conflicts: Navmc10132Conflict[];
  /** Values the file carries that this app cannot rebuild into structure. */
  carriedFromFile: { label: string; value: string }[];
  notes: string[];
}

/**
 * True when these bytes are a NAVMC 10132.
 *
 * Never throws. A file that is not a PDF, or carries no form, is simply not
 * a UPB, and the caller has another path for it.
 */
export async function isNavmc10132Pdf(bytes: ArrayBuffer | Uint8Array): Promise<boolean> {
  try {
    const read = await readNavmc10132Pdf(bytes);
    const present = MARKER_FIELDS.filter(
      (name) => name in read.values || read.allSignatures.includes(name),
    ).length;
    return present >= MARKER_QUORUM;
  } catch {
    return false;
  }
}

/**
 * Read a UPB and produce the patch and the report.
 *
 * Throws `Navmc10132ReadError` when the file cannot be read at all. Call
 * `isNavmc10132Pdf` first if you need to choose a path.
 */
export async function loadNavmc10132FromPdf(
  bytes: ArrayBuffer | Uint8Array,
  formData: FormData,
  fileName: string,
): Promise<Navmc10132LoadResult> {
  const read = await readNavmc10132Pdf(bytes);
  const mapped = navmc10132PdfToForm(read, formData);

  return {
    patch: mapped.patch,
    report: {
      fileName,
      stage: read.stage,
      signedSignatures: read.signedSignatures,
      lockedFieldCount: read.lockedFields.size,
      lockedFields: [...read.lockedFields],
      appLockedFields: navmc10132ItemNineAppLocks(read.signedSignatures, read.values),
      conflicts: mapped.conflicts,
      carriedFromFile: mapped.carriedFromFile,
      notes: mapped.notes,
    },
  };
}

export { Navmc10132ReadError };
