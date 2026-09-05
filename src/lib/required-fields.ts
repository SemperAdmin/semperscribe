/**
 * D.8 (UX audit finding 9): the preview pane on a fresh document was a
 * blank grey rectangle under a red compliance strip. The first thing a
 * new drafter saw after picking a type was a void plus a failure.
 *
 * This module names what the preview is waiting for. The list is read
 * out of the document-type definition in src/lib/schemas.ts, the same
 * declaration the schema validators run against, so the empty state and
 * the compliance banner never disagree about what is required.
 *
 * On a basic letter the definition declares six required header fields:
 * SSIC, Originator Code, Date, From, To and Subject. The date arrives
 * pre-filled with today, so it shows as already done rather than as
 * something to type.
 */

import { DOCUMENT_TYPES } from '@/lib/schemas';
import type { ParagraphData } from '@/types';

export interface RequiredFieldStatus {
  /** The form field name, for the data-field lookup. */
  name: string;
  /** The label the form shows for it. */
  label: string;
  /** True once the field carries text. */
  filled: boolean;
}

function readField(formData: Record<string, unknown>, name: string): string {
  const parts = name.split('.');
  let value: unknown = formData;
  for (const part of parts) {
    if (value === null || typeof value !== 'object') return '';
    value = (value as Record<string, unknown>)[part];
  }
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

/** The required header fields the document type declares, with their state. */
export function requiredFieldStatus(
  documentType: string,
  formData: Record<string, unknown>,
): RequiredFieldStatus[] {
  const definition = DOCUMENT_TYPES[documentType];
  if (!definition) return [];
  const seen = new Set<string>();
  const out: RequiredFieldStatus[] = [];
  for (const section of definition.sections) {
    for (const field of section.fields) {
      if (!field.required || field.type === 'hidden') continue;
      if (seen.has(field.name)) continue;
      seen.add(field.name);
      out.push({
        name: field.name,
        label: field.label,
        filled: readField(formData, field.name).trim() !== '',
      });
    }
  }
  return out;
}

/**
 * True when the drafter has picked a type and typed nothing yet: every
 * required header field blank except the pre-filled date, and no
 * paragraph carrying text. A letter with any content renders its own
 * preview, so the empty state stays out of the way.
 */
export function isDocumentUnstarted(
  fields: readonly RequiredFieldStatus[],
  paragraphs: readonly ParagraphData[] | undefined,
): boolean {
  if (fields.length === 0) return false;
  const typedField = fields.some((f) => f.filled && f.name !== 'date');
  if (typedField) return false;
  return !(paragraphs ?? []).some((p) => (p.content ?? '').trim() !== '');
}
