/**
 * DD Form 368 validators. Pure: FormData in, ValidationIssue[] out,
 * folded into runLetterValidators so the export gate sees the blockers.
 * Every rule cites the form's own instructions (its reverse) or MCO
 * 1001.65. docs/INTERSERVICE_TRANSFER_DD368_SPEC.md section 2 lists them.
 */
import type { FormData } from '@/types';
// type-only: letter-validators imports this module at runtime.
import type { ValidationIssue } from '@/lib/letter-validators';
import {
  DD368_COMPONENTS, DD368_COMPONENT_FIELDS, DD368_DATE_FIELDS, DD368_NAME_FIELDS, DD368_ZIP_FIELDS,
  dd368Field, dd368MemberCategory, isDd368Component, isDd368Date, isDd368Name,
} from '@/lib/dd368';

const FORM = 'DD Form 368 (AUG 2011), Instructions';

export function runDd368Validators(formData: FormData): ValidationIssue[] {
  if (formData.documentType !== 'dd368') return [];
  const issues: ValidationIssue[] = [];
  const get = (name: string) => dd368Field(formData, name).trim();

  for (const [name, item] of DD368_DATE_FIELDS) {
    const v = get(name);
    if (v && !isDd368Date(v)) {
      issues.push({
        id: `dd368-date-${item}`,
        severity: 'block',
        rule: 'Dates are entered in YYMMDD format',
        citation: `${FORM}, General Instructions`,
        detail: `Item ${item} reads "${v}". The form takes every date as six digits, year, month, day: 260906 for 6 Sep 26.`,
        field: name,
      });
    }
  }

  for (const [name, item] of DD368_NAME_FIELDS) {
    const v = get(name);
    if (v && !isDd368Name(v)) {
      issues.push({
        id: `dd368-name-${item}`,
        severity: 'warn',
        rule: 'Names are Last, First, Middle Initial',
        citation: `${FORM}, General Instructions`,
        detail: `Item ${item} reads "${v}". Write it as SMITH, JOHN, A.`,
        field: name,
      });
    }
  }

  for (const [name, item] of DD368_COMPONENT_FIELDS) {
    const v = get(name);
    if (v && !isDd368Component(v)) {
      issues.push({
        id: `dd368-component-${item.replace(/\s+/g, '-')}`,
        severity: 'block',
        rule: 'Service and component by short title only',
        citation: `${FORM}, General Instructions`,
        detail: `Item ${item} reads "${v}". The form takes one of ${DD368_COMPONENTS.join(', ')}.`,
        field: name,
      });
    }
  }

  for (const [name, item] of DD368_ZIP_FIELDS) {
    const v = get(name);
    if (v && !/^\d{5}(-\d{4})?$/.test(v)) {
      issues.push({
        id: `dd368-zip-${item}`,
        severity: 'warn',
        rule: 'Addresses carry a full street, city, state and ZIP code',
        citation: `${FORM}, General Instructions`,
        detail: `Item ${item} reads "${v}". A ZIP code is five digits, or nine with a hyphen.`,
        field: name,
      });
    }
  }

  const edipi = get('dd368Edipi');
  if (edipi && !/^\d{10}$/.test(edipi)) {
    issues.push({
      id: 'dd368-edipi',
      severity: 'block',
      rule: 'EDIPI is the 10-digit DoD ID number',
      citation: `${FORM}, Item 1`,
      detail: `Item 1.c reads "${edipi}". The Electronic Data Interchange Personal Identifier is ten digits.`,
      field: 'dd368Edipi',
    });
  }

  const payGrade = get('dd368PayGrade');
  if (payGrade && dd368MemberCategory(payGrade) === 'unknown') {
    issues.push({
      id: 'dd368-pay-grade',
      severity: 'block',
      rule: 'Pay grade decides which acknowledgement prints',
      citation: `${FORM}, Item 3`,
      detail: `Item 1.b reads "${payGrade}". Write it as E-5, W-2 or O-3: 3.b prints for an officer member and 3.c for an enlisted member, and the app cannot tell which from this value.`,
      field: 'dd368PayGrade',
    });
  }

  const decision = get('dd368Decision');
  const validUntil = get('dd368ReleaseValidUntil');
  const remarks = get('dd368Remarks');
  if (decision === 'approved' && !validUntil) {
    issues.push({
      id: 'dd368-valid-until',
      severity: 'block',
      rule: 'An approved release carries the date it is valid until',
      citation: `${FORM}, Item 5`,
      detail: 'Block 5.a is marked. "If block 5.a. is marked, enter the ending date of this conditional release."',
      field: 'dd368ReleaseValidUntil',
    });
  }
  if (decision === 'disapproved' && !/5\.?b/i.test(remarks)) {
    issues.push({
      id: 'dd368-disapproval-reason',
      severity: 'block',
      rule: 'A disapproval states its reason in Section IV',
      citation: `${FORM}, Item 5 and Section IV`,
      detail: 'Block 5.b is marked. "Indicate in Section IV, Remarks, the reason for disapproval", referencing the item: "Item 5.b. Disapproved for the following reason: ...".',
      field: 'dd368Remarks',
    });
  }
  if (decision !== 'approved' && validUntil) {
    issues.push({
      id: 'dd368-valid-until-without-approval',
      severity: 'warn',
      rule: 'The valid-until date belongs to an approval',
      citation: `${FORM}, Item 5`,
      detail: 'Item 5.a carries a date but block 5.a is not marked.',
      field: 'dd368Decision',
    });
  }

  const current = get('dd368CurrentComponent');
  const service = get('dd368ServiceComponent');
  if (current && service && current !== service) {
    issues.push({
      id: 'dd368-current-component-mismatch',
      severity: 'warn',
      rule: 'The component resigned from is the member\'s current component',
      citation: `${FORM}, Items 1.d and 3.b`,
      detail: `Item 1.d says ${service} and item 3.b says ${current}.`,
      field: 'dd368CurrentComponent',
    });
  }

  const gaining = get('dd368GainingComponent');
  if (gaining && service && gaining === service) {
    issues.push({
      id: 'dd368-gaining-equals-current',
      severity: 'block',
      rule: 'A conditional release is into another Service or component',
      citation: `${FORM}, Item 3.a`,
      detail: `Items 1.d and 4.a both say ${service}. The release is "to process for entrance into another component of the Military Service".`,
      field: 'dd368GainingComponent',
    });
  }

  return issues;
}
