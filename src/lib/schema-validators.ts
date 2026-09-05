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

/**
 * Field-to-policy citations for the required header fields.
 *
 * Before this map the generic pass wrote "SSIC fails its document
 * schema", cited to "Basic Letter schema (src/lib/schemas.ts)". A
 * source path in a citation field teaches a drafter nothing and gives
 * a reviewing officer nothing to check the claim against (UX audit
 * finding 3). Each entry below states the requirement as the manual
 * states it and cites the paragraph it comes from.
 *
 * Paragraph numbers were read out of docs/SecNav5216/, not inferred:
 * SSIC, originator's code and the date are the three parts of the
 * sender's symbol at 7-2.3.a, the From line is 7-2.6, the To line is
 * 7-2.7, the Via line 7-2.8, the subject 7-2.9 and the signature
 * 7-2.14. Chapter 2 carries the date FORMATS at 2-16, so the date
 * entry cites both.
 */
interface FieldRule {
  /** The requirement, in the manual's own terms. */
  requirement: string;
  /** The paragraph the requirement comes from. */
  citation: string;
  /** What the drafter does about it. */
  guidance: string;
}

const NAVAL_FIELD_RULES: Record<string, FieldRule> = {
  ssic: {
    requirement: 'An SSIC is required on every naval letter',
    citation: 'SECNAV M-5216.5 7-2.3.a(1)',
    guidance:
      'The four- or five-digit code for the subject. Look it up in SECNAV M-5210.2 or use the picker on this field.',
  },
  originatorCode: {
    requirement: 'The originator\'s code goes under the SSIC',
    citation: 'SECNAV M-5216.5 7-2.3.a(2)',
    guidance:
      'The office symbol or the hull number of a ship, blocked immediately under the SSIC.',
  },
  date: {
    requirement: 'A letter is dated the day it is signed',
    citation: 'SECNAV M-5216.5 7-2.3.a(3) and 2-16.a',
    guidance:
      'Abbreviated format: day, three-letter month, two-digit year, for example 5 Sep 26.',
  },
  from: {
    requirement: 'Every standard letter carries a From line',
    citation: 'SECNAV M-5216.5 7-2.6.a',
    guidance:
      'The activity head\'s title and the activity name. A window-envelope letter is the one exception.',
  },
  to: {
    requirement: 'The To line names the action addressee',
    citation: 'SECNAV M-5216.5 7-2.7.a',
    guidance:
      'Address the activity head rather than a person, with the office code in parentheses when it is known.',
  },
  via: {
    requirement: 'A Via line names each activity which reviews the letter first',
    citation: 'SECNAV M-5216.5 7-2.8.a',
    guidance:
      'Chain of command order. Two or more are numbered.',
  },
  subj: {
    requirement: 'Every letter carries a subject line',
    citation: 'SECNAV M-5216.5 7-2.9.a',
    guidance:
      'A sentence fragment in normal word order, capitalised, no acronyms and no end punctuation.',
  },
  sig: {
    requirement: 'The signature line carries the signer\'s name below the signature',
    citation: 'SECNAV M-5216.5 7-2.14.a(1)',
    guidance:
      'The typed name below the signature, last name in capitals. 7-2.14.b gives four forms: name, name and title, name and title with Acting, or name with By direction.',
  },
};

/**
 * The civilian branch blocks the same three identification symbols in
 * the upper left instead of the sender's symbol block, and carries an
 * inside address rather than a From and To pair.
 */
const CIVILIAN_FIELD_RULES: Record<string, FieldRule> = {
  ssic: {
    requirement: 'A business letter carries the SSIC in the upper left block',
    citation: 'SECNAV M-5216.5 11-2.1.a',
    guidance:
      'The three identification symbols block one below the other in the upper left corner.',
  },
  originatorCode: {
    requirement: 'The originator\'s code is the second identification symbol',
    citation: 'SECNAV M-5216.5 11-2.1.b',
    guidance: 'It blocks directly under the SSIC in the upper left corner.',
  },
  date: {
    requirement: 'A business letter is dated in civilian format',
    citation: 'SECNAV M-5216.5 11-2.1.c and 2-16.c',
    guidance:
      'Month in full, day in numerals, a comma and the full year.',
  },
  recipientName: {
    requirement: 'The inside address names the person or the business written to',
    citation: 'SECNAV M-5216.5 11-2.2.a',
    guidance:
      'Courtesy title and full name, the business name, the street address, then city, state and ZIP+4.',
  },
  recipientAddress: {
    requirement: 'The inside address carries the full mailing address',
    citation: 'SECNAV M-5216.5 11-2.2.a',
    guidance:
      'End with city, state and ZIP+4, one space before the ZIP.',
  },
  sig: {
    requirement: 'The signer\'s name appears in all capital letters',
    citation: 'SECNAV M-5216.5 11-2.9.a(1)',
    guidance: 'The typed name goes on the fourth line below the complimentary close.',
  },
};

/** Types which follow chapter 11 and chapter 12 rather than chapter 7. */
const CIVILIAN_RULE_TYPES = new Set(['business-letter', 'executive-correspondence']);

/**
 * The authority a document type answers to, for a field the map above
 * does not cover. Never a source path: a drafter who cannot check the
 * claim has no reason to believe it.
 */
const DOCUMENT_AUTHORITY: Record<string, string> = {
  basic: 'SECNAV M-5216.5 Ch 7',
  'multiple-address': 'SECNAV M-5216.5 Ch 8',
  endorsement: 'SECNAV M-5216.5 Ch 9',
  mfr: 'SECNAV M-5216.5 Ch 10',
  'from-to-memo': 'SECNAV M-5216.5 Ch 10',
  'letterhead-memo': 'SECNAV M-5216.5 Ch 10',
  moa: 'SECNAV M-5216.5 10-2.6',
  mou: 'SECNAV M-5216.5 10-2.6',
  'business-letter': 'SECNAV M-5216.5 Ch 11',
  'executive-correspondence': 'SECNAV M-5216.5 Ch 12',
  mco: 'MCO 5215.1K',
  bulletin: 'MCO 5215.1K',
  'change-transmittal': 'MCO 5215.1K',
  'secnav-instruction': 'SECNAV M-5215.1',
  'secnav-notice': 'SECNAV M-5215.1',
  'position-paper': 'MCO 5216.20B',
  'information-paper': 'MCO 5216.20B',
  'decision-paper': 'MCO 5216.20B',
  amhs: 'NTP 3(J)',
};

/** The requirement and citation for one field of one document type. */
function ruleFor(documentType: string, path: string): FieldRule | undefined {
  const table = CIVILIAN_RULE_TYPES.has(documentType) ? CIVILIAN_FIELD_RULES : NAVAL_FIELD_RULES;
  return table[path];
}

/** The authority line for a field with no entry in the citation map. */
function authorityFor(documentType: string): string {
  return (
    DOCUMENT_AUTHORITY[documentType] ??
    `${DOCUMENT_TYPES[documentType]?.name ?? documentType} format requirements`
  );
}

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
    const message = issue.message.replace(/\.$/, '');
    // The rule is the requirement, cited to the paragraph it comes
    // from. A field outside the citation map still gets the document
    // type's own authority rather than a path into this repository.
    const rule = ruleFor(documentType, path);
    const orphaned = hasEditor
      ? ''
      : ' No editor exposes this field, which is a defect in the app rather than in your document.';
    const state = missing ? `${label} is empty.` : `${label}: ${message}.`;
    issues.push({
      id: `schema-${documentType}-${path}`,
      severity: hasEditor ? 'fail' : 'warn',
      field: path,
      rule: rule ? rule.requirement : `${label} is required on a ${DOCUMENT_TYPES[documentType]?.name ?? documentType}`,
      citation: rule ? rule.citation : authorityFor(documentType),
      detail: rule ? `${state} ${rule.guidance}${orphaned}` : `${state}${orphaned}`,
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
