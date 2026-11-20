/**
 * Which rendering a NAVMC form gets, decided once for the preview and
 * the export.
 *
 * Owner's rulings: unsigned forms export onto the OFFICIAL fillable
 * form (2026-07-17), and the preview shows that same form being filled,
 * as the NAVMC 10132 preview does (2026-10-21). A signature field or a
 * bound enclosure file forces the flattened redraw on both surfaces: the
 * dynamic-XFA renderer ignores drawn annotations and appended pages, so
 * they would vanish in silence.
 *
 * NAVMC 10922 left this route on 2026-11-20 (owner decision,
 * docs/NAVMC_10922_SPEC.md section 11): it always renders as its fillable
 * AcroForm rebuild on both surfaces, like the 10132 and 11106.
 */
import type { SignaturePosition } from '@/types';
import type { EnclosureAttachment, EnclosureRow } from '@/lib/enclosure-rows';

/** The form data's shape as these helpers read it; FormData declares neither key (it carries an index signature). */
export interface FormRouteFacts {
  documentType?: string;
  signatureFields?: unknown;
}

export function signatureFieldCount(formData: FormRouteFacts): number {
  return ((formData.signatureFields as SignaturePosition[] | undefined) ?? []).length;
}

export function hasBoundEnclosureFiles(
  rows?: readonly EnclosureRow[],
  files?: ReadonlyMap<string, EnclosureAttachment>,
): boolean {
  return Boolean(rows?.some(r => r.fileId && files?.has(r.fileId)));
}

/** True when the AA Form (NAVMC 10274) renders as the official fillable form rather than the flattened redraw. */
export function aaFormUsesOfficialForm(
  formData: FormRouteFacts,
  rows?: readonly EnclosureRow[],
  files?: ReadonlyMap<string, EnclosureAttachment>,
): boolean {
  return formData.documentType === 'aa-form'
    && signatureFieldCount(formData) === 0
    && !hasBoundEnclosureFiles(rows, files);
}

/** Document types whose unsigned PDF export goes onto the official dynamic-XFA blank. */
export const OFFICIAL_XFA_EXPORT_TYPES: readonly string[] = ['aa-form', 'page11'];

/** True when this document type can export onto the official XFA blank (useDocumentExport.ts). */
export function exportsOfficialXfa(documentType: string | undefined): boolean {
  return OFFICIAL_XFA_EXPORT_TYPES.includes(documentType ?? '');
}
