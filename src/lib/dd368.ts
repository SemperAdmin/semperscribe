/**
 * DD Form 368, Request for Conditional Release (AUG 2011, updated
 * 20241126). Shared vocabulary and value rules, from the form's own
 * instructions on its reverse. docs/INTERSERVICE_TRANSFER_DD368_SPEC.md
 * section 2 is the item-by-item source.
 */
import type { FormData } from '@/types';

/**
 * "Use short title Service/Component names" (General Instructions).
 * The twelve the form lists, in its order.
 */
export const DD368_COMPONENTS = [
  'USA', 'ARNGUS', 'USAR',
  'USN', 'USNR',
  'USMC', 'USMCR',
  'USAF', 'ANGUS', 'USAFR',
  'USCG', 'USCGR',
] as const;

export type Dd368Component = (typeof DD368_COMPONENTS)[number];

export function isDd368Component(value: string | undefined | null): value is Dd368Component {
  return (DD368_COMPONENTS as readonly string[]).includes(String(value ?? ''));
}

/** Item 5: exactly one of the two boxes is marked. */
export type Dd368Decision = '' | 'approved' | 'disapproved';

/**
 * Item 3 prints 3.b for an officer and 3.c for an enlisted member. The
 * form has no category box of its own, so the pay grade in 1.b decides:
 * O and W grades are officers who tender a resignation (3.b), E grades
 * are enlisted members who are discharged (3.c).
 */
export type Dd368MemberCategory = 'officer' | 'enlisted' | 'unknown';

export function dd368MemberCategory(payGrade: string | undefined | null): Dd368MemberCategory {
  const m = String(payGrade ?? '').trim().toUpperCase().match(/^([EOW])-?\s?(\d{1,2})$/);
  if (!m) return 'unknown';
  return m[1] === 'E' ? 'enlisted' : 'officer';
}

/** "Enter all dates in YYMMDD format" (General Instructions). */
export function isDd368Date(value: string | undefined | null): boolean {
  const s = String(value ?? '').trim();
  if (!/^\d{6}$/.test(s)) return false;
  const mm = Number(s.slice(2, 4));
  const dd = Number(s.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return false;
  const yy = 2000 + Number(s.slice(0, 2));
  const date = new Date(Date.UTC(yy, mm - 1, dd));
  return date.getUTCMonth() === mm - 1 && date.getUTCDate() === dd;
}

/** "Use last name, first name, and middle initial format." */
export function isDd368Name(value: string | undefined | null): boolean {
  const s = String(value ?? '').trim();
  if (!s) return false;
  return /^[A-Za-z][A-Za-z'’ -]*,\s*[A-Za-z][A-Za-z'’ -]*(?:,?\s+[A-Za-z]\.?)?$/.test(s);
}

/** Every DD 368 field the app carries, all flat on FormData. */
export const DD368_DATE_FIELDS = [
  ['dd368MemberSignedDate', '3.e'],
  ['dd368RecruiterSignedDate', '4.d'],
  ['dd368ReleaseValidUntil', '5.a'],
  ['dd368OfficialSignedDate', '6.f'],
  ['dd368CertifyingSignedDate', '8.g'],
] as const;

export const DD368_NAME_FIELDS = [
  ['dd368MemberName', '1.a'],
  ['dd368RecruiterName', '4.b'],
  ['dd368OfficialName', '6.a'],
  ['dd368CertifyingName', '8.a'],
] as const;

export const DD368_COMPONENT_FIELDS = [
  ['dd368ServiceComponent', '1.d'],
  ['dd368CurrentComponent', '3.b'],
  ['dd368GainingComponent', '3.b and 4.a'],
  ['dd368OathService', '7'],
] as const;

export const DD368_ZIP_FIELDS = [
  ['dd368MemberZip', '1.f(4)'],
  ['dd368RecruiterZip', '2.d'],
  ['dd368OfficialZip', '6.d(4)'],
  ['dd368CertifyingZip', '8.e(4)'],
] as const;

export function dd368Field(formData: FormData, name: string): string {
  const v = (formData as Record<string, unknown>)[name];
  return v == null ? '' : String(v);
}
