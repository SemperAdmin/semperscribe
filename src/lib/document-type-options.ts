/**
 * Picker options over the document-type registry.
 *
 * SECNAV M-5216.5 9-1 makes the same-page endorsement a placement of
 * the one endorsement type, and the schema, the emitters and the
 * validators treat it as such: `documentType` stays 'endorsement' and
 * `endorsementPlacement` carries the placement. Drafters pick by the
 * form they want, so the sidebar, the command palette and the header
 * show "Endorsement" and "Same-Page Endorsement" as two options. This
 * module is the one place the two views meet: a picker id maps to the
 * form fields it stands for, and a form maps back to the picker id
 * that should read as selected.
 */
import { DOCUMENT_TYPES, type DocumentTypeDefinition } from '@/lib/schemas';
import { isSamePageEndorsement } from '@/lib/same-page-endorsement';
import type { FormData } from '@/types';

/** Picker id for the same-page endorsement. Never a `documentType`. */
export const SAME_PAGE_ENDORSEMENT_OPTION = 'same-page-endorsement';

export interface PickerOption {
  /** What the picker passes to the type-change handler. */
  key: string;
  name: string;
  description: string;
  icon?: string;
}

/** The fields a picker option stands for. */
export interface PickerSelection {
  documentType: string;
  endorsementPlacement: 'new-page' | 'same-page';
}

const SAME_PAGE_OPTION: PickerOption = {
  key: SAME_PAGE_ENDORSEMENT_OPTION,
  name: 'Same-Page Endorsement',
  description: 'Forwards correspondence on the signature page of the letter it endorses when it fits there (M-5216.5 9-1).',
  icon: DOCUMENT_TYPES.endorsement?.icon,
};

/**
 * The picker id a form should show as selected. A same-page
 * endorsement reads as the same-page option; everything else reads as
 * its own document type.
 */
export function pickerTypeFor(
  formData: Pick<FormData, 'documentType' | 'endorsementPlacement'>,
): string {
  return isSamePageEndorsement(formData) ? SAME_PAGE_ENDORSEMENT_OPTION : formData.documentType;
}

/**
 * The form fields a picker id stands for. Every real document type
 * selects new-page placement, which is what the type-change handler
 * has always written, so a switch away from an endorsement leaves no
 * same-page flag behind.
 */
export function resolvePickerType(key: string): PickerSelection {
  if (key === SAME_PAGE_ENDORSEMENT_OPTION) {
    return { documentType: 'endorsement', endorsementPlacement: 'same-page' };
  }
  return { documentType: key, endorsementPlacement: 'new-page' };
}

/** Name, description and icon for the header above the form. */
export function pickerDefinitionFor(
  formData: Pick<FormData, 'documentType' | 'endorsementPlacement'>,
): Pick<DocumentTypeDefinition, 'name' | 'description' | 'icon'> {
  if (isSamePageEndorsement(formData)) return SAME_PAGE_OPTION;
  return DOCUMENT_TYPES[formData.documentType] || DOCUMENT_TYPES.basic;
}

/**
 * Every picker option in registry order, with the same-page option
 * directly after the endorsement it is a placement of.
 */
export function pickerOptions(): PickerOption[] {
  const options: PickerOption[] = [];
  for (const [key, def] of Object.entries(DOCUMENT_TYPES)) {
    options.push({ key, name: def.name, description: def.description, icon: def.icon });
    if (key === 'endorsement') options.push(SAME_PAGE_OPTION);
  }
  return options;
}
