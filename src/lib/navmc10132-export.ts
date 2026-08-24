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

/**
 * Fetch the bundled blank and fill it from document state.
 *
 * Throws when the blank cannot be fetched, because a silently empty export of a
 * legal record is worse than a visible failure.
 */
export async function exportNavmc10132Form(formData: FormData): Promise<Blob> {
  const path = officialFormPath('navmc10132');
  if (!path) throw new Error('No official blank registered for NAVMC 10132.');
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load the NAVMC 10132 blank (${res.status}).`);
  const base = await res.arrayBuffer();
  const bytes = await fillAcroForm(base, navmc10132Values(formData), {
    fields: fieldMap.fields as AcroFormFieldMeta[],
    unlockReadOnly: [...NAVMC_10132_UNLOCK_READ_ONLY],
    // The Adobe usage-rights signature is void the moment the bytes change.
    // Removing it shows no signature rather than an invalid one, which reads
    // as tampering. Spec decision D-12.
    stripUsageRights: true,
  });
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
