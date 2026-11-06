/**
 * NAVMC 11106 official-form export. A plain AcroForm, so it fills through
 * acroform-fill.ts, not xfa-form-fill.ts. Preview and export share this path.
 * Rule source: docs/NAVMC_11106_SPEC.md section 11.
 */
import type { FormData } from '@/types';
import { fillAcroFormWithReport, type AcroFormFieldMeta } from '@/lib/acroform-fill';
import { loadAssetBytes } from '@/lib/assets';
import { navmc11106FieldProblems, navmc11106Values } from '@/lib/navmc11106-rules';
import { officialFormAsset } from '@/lib/xfa-form-fill';
import fieldMap from '../../tools/aa-forms/navmc11106-map.json';

/** Plain words for the first thing the form cannot take, ahead of the fill. */
function describeFieldProblems(formData: FormData): string | null {
  const problems = navmc11106FieldProblems(formData);
  if (problems.length === 0) return null;
  const lines = problems.map((p) =>
    p.problem === 'unprintable'
      ? `Block ${p.block}: ${p.detail} ${p.detail.includes(' ') ? 'are not characters' : 'is not a character'} the form can print. Enter the Latin spelling.`
      : `Block ${p.block}: ${p.detail} Shorten it.`);
  return `NAVMC 11106 cannot be exported. ${lines.join(' ')}`;
}

export async function exportNavmc11106Form(formData: FormData): Promise<Blob> {
  // The form font cannot print every Unicode character and the fill would
  // throw an encoder error. Refuse in plain words; never transliterate a name.
  const refusal = describeFieldProblems(formData);
  if (refusal) throw new Error(refusal);
  const asset = officialFormAsset('navmc11106');
  if (!asset) throw new Error('No official blank registered for NAVMC 11106.');
  const base = await loadAssetBytes(asset);
  const { bytes, report } = await fillAcroFormWithReport(base, navmc11106Values(formData), {
    fields: fieldMap.fields as AcroFormFieldMeta[],
  });
  // A pay document missing a value is a wrong record, not a degraded one.
  if (report.errors.length > 0) {
    const detail = report.errors.map(([name, why]) => `${name}: ${why}`).join('; ');
    throw new Error(`NAVMC 11106 fill failed. ${detail}`);
  }
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}
