/**
 * NAVMC 10132 official-form export.
 *
 * Deliberately NOT part of xfa-form-fill.ts. That module replaces the datasets
 * stream inside a dynamic LiveCycle XFA document, which is how NAVMC 10274,
 * 118(11), and 10922 work. NAVMC 10132 is a plain AcroForm addressed by field
 * NAME, with no XFA array at all, so it shares nothing with that path except
 * the idea of filling a bundled blank.
 *
 * What this produces is the OFFICIAL form, still fillable, with its seven
 * signature widgets left open so items 9 and 16 can be CAC-signed in Acrobat.
 * The app never draws a signature onto it.
 *
 * TWO PATHS, AND WHICH ONE RUNS IS DECIDED BY THE DOCUMENT, NOT BY A FLAG.
 *
 *   NO BASE FILE  -> fill the bundled blank, full rewrite, the original path.
 *                    This is pass 1 and every document nobody has signed.
 *   BASE FILE     -> write an incremental update INTO the uploaded signed
 *                    file, appending bytes and touching none that came
 *                    before, so its CAC signatures stay valid.
 *
 * A base file exists only when a clerk uploaded a signed UPB, which is
 * exactly when the full rewrite would be wrong: it would produce a document
 * that resembles theirs with every signature broken. See
 * navmc10132-incremental-write.ts for what that costs and why.
 *
 * WHICH DOCUMENT'S FILE (audit P6-1). The base is looked up by the id the
 * loader recorded on `formData.navmc10132BaseFileId`, and only when the
 * document also carries the load report saying a signed file is behind it.
 * A fresh document has neither and fills the blank; a document whose id
 * does not resolve in this browser (a `.nldp` from another machine) fills
 * the blank and the report says so. No document can reach a base it did
 * not load.
 *
 * THE PREVIEW USES THIS TOO. `pdfPipelineService` calls this function for
 * both the export and the live preview, so a loaded document previews as
 * ITSELF rather than as a fresh blank. That was Stephen's ask in the same
 * breath as the upload: "This is what we will use in the preview."
 *
 * Rule source: docs/NAVMC_10132_SPEC.md section 7 and the Phase 0 report.
 */

import { FormData } from '@/types';
import { fillAcroForm, type AcroFormFieldMeta } from '@/lib/acroform-fill';
import {
  navmc10132Values,
  NAVMC_10132_UNLOCK_READ_ONLY,
} from '@/lib/navmc10132-acroform';
import fieldMap from '../../tools/aa-forms/navmc10132-map.json';
import { officialFormAsset } from '@/lib/xfa-form-fill';
import { loadAssetBytes } from '@/lib/assets';
import { getNavmc10132Base, navmc10132BaseFileIdOf } from '@/lib/navmc10132-base-file';
import { writeNavmc10132Incremental } from '@/lib/navmc10132-incremental-write';
import { navmc10132LockedFieldNames } from '@/lib/navmc10132-locks';

/** What an export did, for the caller to tell the clerk. */
export interface Navmc10132ExportReport {
  /** `incremental`: written into the loaded signed file. `blank`: the bundled blank, filled. */
  path: 'blank' | 'incremental';
  /** Field names the incremental writer refused (signature-closed, or not on the form). */
  refused: string[];
  /**
   * True when the document carries a load report but its recorded base
   * did not resolve, so the blank was filled in place of the signed file.
   */
  baseMissing: boolean;
}

/**
 * The export, with the report of which path ran and what was refused.
 *
 * Throws when the blank cannot be read, because a silently empty export of
 * a legal record is worse than a visible failure; and throws when the
 * signed base cannot be READ from storage (Navmc10132BaseReadError), for
 * the same reason with more force: a blank in place of a signed file is a
 * document with every signature gone.
 */
export async function exportNavmc10132FormWithReport(
  formData: FormData,
): Promise<{ blob: Blob; report: Navmc10132ExportReport }> {
  // A signed file the clerk loaded is the base every later pass writes
  // into. Only a document whose load report says a file is behind it, and
  // whose recorded id resolves, takes that path. Everything else starts
  // from the bundled blank.
  const loaded = Boolean(formData.navmc10132LoadReport);
  const baseFileId = loaded ? navmc10132BaseFileIdOf(formData) : null;
  const uploaded = loaded ? await getNavmc10132Base(baseFileId) : null;
  if (uploaded) return exportIntoUploadedFile(formData, uploaded.bytes);

  const asset = officialFormAsset('navmc10132');
  if (!asset) throw new Error('No official blank registered for NAVMC 10132.');
  const base = await loadAssetBytes(asset);
  const bytes = await fillAcroForm(base, navmc10132Values(formData), {
    fields: fieldMap.fields as AcroFormFieldMeta[],
    unlockReadOnly: [...NAVMC_10132_UNLOCK_READ_ONLY],
    // The Adobe usage-rights signature is void the moment the bytes change.
    // Removing it shows no signature rather than an invalid one, which reads
    // as tampering. Spec decision D-12.
    stripUsageRights: true,
  });
  return {
    blob: new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
    report: { path: 'blank', refused: [], baseMissing: loaded },
  };
}

/** The export alone, for callers that want only the bytes. */
export async function exportNavmc10132Form(formData: FormData): Promise<Blob> {
  return (await exportNavmc10132FormWithReport(formData)).blob;
}

/**
 * Write this pass into the uploaded signed file.
 *
 * VALUES COME FROM THE SAME TABLE THE BLANK PATH USES. `navmc10132Values`
 * is the one place the form's field names live, so this path cannot drift
 * from the other by learning the form a second time.
 *
 * THE WRITER DECIDES WHAT NOT TO WRITE, not this function. It refuses every
 * signature-closed field, every field the app has no value for, and every
 * field the file already agrees with. Those three rules belong with the
 * bytes rather than with the export, because they are true of any write into
 * a signed document, not only of an export.
 *
 * REFUSALS ARE REPORTED, NOT SWALLOWED (audit P6-5). A clerk who edited a
 * locked field will not see their change in the file. The UI half already
 * stops them editing one (navmc10132-locks.ts), so a refusal here means
 * either a stale value from before the file was loaded, or a bug; either
 * way the export toast names the field, and the console keeps the line.
 */
async function exportIntoUploadedFile(
  formData: FormData,
  base: Uint8Array,
): Promise<{ blob: Blob; report: Navmc10132ExportReport }> {
  const result = await writeNavmc10132Incremental(
    base,
    navmc10132Values(formData),
    navmc10132LockedFieldNames(formData),
    // The SAME field map the blank path fills from. The writer needs it for
    // the two-step dropdown rule, so a findings widget draws "G" rather than
    // a clipped "Guilty" while /V still carries the export value.
    fieldMap.fields as AcroFormFieldMeta[],
  );

  if (result.refused.length > 0) {
    console.warn(
      'NAVMC 10132: fields not written because a signature closed them, or the form does not ' +
        'carry them:',
      result.refused,
    );
  }

  return {
    blob: new Blob([new Uint8Array(result.bytes)], { type: 'application/pdf' }),
    report: { path: 'incremental', refused: [...result.refused], baseMissing: false },
  };
}
