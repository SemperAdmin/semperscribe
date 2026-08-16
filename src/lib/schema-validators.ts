/**
 * Schema-backed field validation.
 *
 * The Zod schemas in src/lib/schemas.ts declared required fields for
 * every document type ("Salutation is required" on
 * BusinessLetterSchema, for example) and NO runtime path evaluated
 * them: the only safeParse callers were storage-utils (imported
 * documents) and a template example. A drafter could therefore export
 * a business letter with no salutation and no inside address and see
 * nothing. This module runs the registry schema against live form
 * state and translates field errors into the shared ValidationIssue
 * shape, so the compliance dialog reports them.
 *
 * Severity contract:
 *   fail - the field has an editor in the form and the drafter fixes it
 *   warn - the schema requires a field the UI never exposes (an app
 *          defect, reported so it is visible rather than silent)
 * Never "block": an in-progress draft must still export. Hard blockers
 * stay with the hand-written rules, which cite a paragraph of policy.
 */

import { FormData } from '@/types';
// type-only: letter-validators imports this module at runtime, so a
// value import here would create a cycle.
import type { ValidationIssue } from '@/lib/letter-validators';
import { DOCUMENT_TYPES } from '@/lib/schemas';

/**
 * Paths the generic pass never reports.
 * - documentType: a literal/enum mismatch is an app wiring defect, not
 *   a drafter error, and the message ("Invalid literal value") means
 *   nothing to a user.
 * - salutation: validateSalutation below reports it WITH its policy
 *   citation. Two issues for one empty field is noise.
 */
const SUPPRESSED_PATHS = new Set(['documentType', 'salutation']);

/** Label + editor presence for a schema path, from the form definition. */
function describeField(
  documentType: string,
  path: string,
): { label: string; hasEditor: boolean } {
  const definition = DOCUMENT_TYPES[documentType];
  const root = path.split('.')[0];
  for (const section of definition?.sections ?? []) {
    for (const field of section.fields) {
      if (field.name !== root) continue;
      // A field whose condition is false is hidden right now, so the
      // drafter cannot act on it. Treat it as having no editor.
      let visible = true;
      if (typeof field.condition === 'function') {
        try {
          visible = Boolean(field.condition({}));
        } catch {
          visible = true;
        }
      }
      return { label: field.label || root, hasEditor: visible };
    }
  }
  return { label: root, hasEditor: false };
}

/**
 * Runs the document type's registry schema over the live form state.
 * One issue per field path, first message wins.
 */
export function validateSchemaFields(formData: FormData): ValidationIssue[] {
  const documentType = formData.documentType;
  const schema = DOCUMENT_TYPES[documentType]?.schema;
  if (!schema) return [];

  const result = schema.safeParse(formData);
  if (result.success) return [];

  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    if (!path || SUPPRESSED_PATHS.has(path)) continue;
    if (seen.has(path)) continue;
    seen.add(path);

    const { label, hasEditor } = describeField(documentType, path);
    // Zod reports an ABSENT field as a type error ("Invalid input:
    // expected string, received undefined") because the type check runs
    // before .min(1). A drafter reads that as a bug report, so an
    // absent value is restated as the plain requirement.
    const missing =
      issue.code === 'invalid_type' && /received (undefined|null)/.test(issue.message);
    const message = missing ? `${label} is required` : issue.message;
    issues.push({
      id: `schema-${documentType}-${path}`,
      severity: hasEditor ? 'fail' : 'warn',
      rule: `${label} fails its document schema`,
      citation: `${DOCUMENT_TYPES[documentType]?.name ?? documentType} schema (src/lib/schemas.ts)`,
      detail: hasEditor
        ? `${label}: ${message}`
        : `${label}: ${message} (no editor exposes this field - app defect)`,
    });
  }

  return issues;
}

/**
 * Salutation presence for the three letter formats that require one.
 *
 * Cited separately from the generic pass because it carries policy
 * weight: the salutation is a required element of the business letter
 * (SECNAV M-5216.5 Fig 11-1), and the DLA schema leaves it optional,
 * so the generic pass alone would miss the DLA case. Until this rule,
 * all three PDF renderers substituted "Dear Sir or Madam:" for an
 * empty field while the DOCX emitters wrote nothing, so the preview
 * showed a salutation the exported file did not contain.
 */
const SALUTATION_REQUIRED_TYPES = [
  'business-letter',
  'executive-correspondence',
  'dla-business-letter',
];

/**
 * FOUO is a retired control marking. DoDI 5200.48 (6 March 2020)
 * cancelled DoDM 5200.01 Volume 4 - the very document SECNAV M-5216.5
 * para 7-3 cites - and ended FOUO on newly created documents. The
 * Marine Corps implemented it in MARADMIN 664/20. CUI replaces it.
 *
 * The form control was removed 2026-08-16, so a value here reaches the
 * app only from a saved draft, a library document, or an import. Both
 * emitters still render it, deliberately: a legacy document keeps the
 * marking it was created with. This rule states why the marking is
 * obsolete and points at the replacement.
 */
export function validateRetiredFouo(formData: FormData): ValidationIssue[] {
  const designation = (formData.fouoDesignation ?? '').trim();
  if (!designation) return [];
  return [{
    id: 'fouo-retired',
    severity: 'fail',
    rule: 'FOUO is a retired control marking',
    citation: 'DoDI 5200.48 (6 Mar 2020); MARADMIN 664/20',
    detail:
      'This document is marked FOR OFFICIAL USE ONLY. DoDI 5200.48 cancelled ' +
      'DoDM 5200.01 Vol 4 and ended FOUO on new documents. Turn on Classification ' +
      'Markings and set the level to CUI instead. The FOUO marking still renders ' +
      'so an existing document keeps what it was created with.',
  }];
}

/**
 * References on a civilian letter. M-5216.5 11-2.9 keeps them out of
 * both emitters, so a drafter who fills the References section sees the
 * entries vanish from every output. The section stays available for the
 * executive MEMO format, which does carry a reference list, so this is
 * a report rather than a hidden control.
 */
const NO_REFERENCE_LIST_TYPES = ['business-letter'];

export function validateCivilianReferences(
  formData: FormData,
  references: string[],
): ValidationIssue[] {
  const isExecLetter =
    formData.documentType === 'executive-correspondence' &&
    (formData.execFormat === 'letter' || !formData.execFormat);
  if (!NO_REFERENCE_LIST_TYPES.includes(formData.documentType) && !isExecLetter) return [];
  const refs = references.filter((r) => r && r.trim());
  if (refs.length === 0) return [];
  return [{
    id: 'civilian-reference-list',
    severity: 'warn',
    rule: 'A business letter carries no reference list',
    citation: 'SECNAV M-5216.5 11-2.9',
    detail:
      `${refs.length} reference${refs.length > 1 ? 's are' : ' is'} listed, and neither the preview nor the export prints them. ` +
      'Refer to previous communications in the body of the letter instead.',
  }];
}

export function validateSalutation(formData: FormData): ValidationIssue[] {
  if (!SALUTATION_REQUIRED_TYPES.includes(formData.documentType)) return [];
  if ((formData.salutation ?? '').trim()) return [];
  return [{
    id: 'salutation-missing',
    severity: 'fail',
    rule: 'A business letter requires a salutation',
    citation: 'SECNAV M-5216.5 Fig 11-1 (audit line 48)',
    detail:
      'Salutation is empty, so the exported letter opens with no greeting. ' +
      'Enter one, for example "Dear Mr. Smith:" (colon with a surname, ' +
      'comma when a first name is used).',
  }];
}
