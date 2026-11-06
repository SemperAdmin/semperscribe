/**
 * NAVMC 11106 official-form export. A plain AcroForm, so it fills through
 * acroform-fill.ts, not xfa-form-fill.ts. Preview and export share this path.
 * Rule source: docs/NAVMC_11106_SPEC.md section 11.
 */
import type { FormData } from '@/types';
import { fillAcroFormWithReport, type AcroFormFieldMeta } from '@/lib/acroform-fill';
import { loadAssetBytes } from '@/lib/assets';
import { navmc11106Values } from '@/lib/navmc11106-rules';
import { officialFormAsset } from '@/lib/xfa-form-fill';
import fieldMap from '../../tools/aa-forms/navmc11106-map.json';

export async function exportNavmc11106Form(formData: FormData): Promise<Blob> {
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
