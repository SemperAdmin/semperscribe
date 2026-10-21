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
