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
import { officialFormPath } from '@/lib/xfa-form-fill';
import { getNavmc10132Base } from '@/lib/navmc10132-base-file';
import { writeNavmc10132Incremental } from '@/lib/navmc10132-incremental-write';
import { navmc10132LockedFieldNames } from '@/lib/navmc10132-locks';

/**
 * Fetch the bundled blank and fill it from document state.
 *
 * Throws when the blank cannot be fetched, because a silently empty export of a
 * legal record is worse than a visible failure.
 */
export async function exportNavmc10132Form(formData: FormData): Promise<Blob> {
  const uploaded = await getNavmc10132Base();
  if (uploaded) return exportIntoUploadedFile(formData, uploaded.bytes);

  const path = officialFormPath('navmc10132');
  if (!path) throw new Error('No official blank registered for NAVMC 10132.');
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load the NAVMC 10132 blank (${res.status}).`);
  const blank = await res.arrayBuffer();
  const bytes = await fillAcroForm(blank, navmc10132Values(formData), {
    fields: fieldMap.fields as AcroFormFieldMeta[],
    unlockReadOnly: [...NAVMC_10132_UNLOCK_READ_ONLY],
    // The Adobe usage-rights signature is void the moment the bytes change.
    // Removing it shows no signature rather than an invalid one, which reads
    // as tampering. Spec decision D-12.
    stripUsageRights: true,
  });
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
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
 * REFUSALS ARE LOGGED, NOT SWALLOWED. A clerk who edited a locked field will
 * not see their change in the file, and the console line is the only trace
 * of why until the UI surfaces it. The UI half already stops them editing
 * one (navmc10132-locks.ts), so a refusal here means either a stale value
 * from before the file was loaded, or a bug.
 */
async function exportIntoUploadedFile(formData: FormData, base: Uint8Array): Promise<Blob> {
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

  return new Blob([new Uint8Array(result.bytes)], { type: 'application/pdf' });
}
