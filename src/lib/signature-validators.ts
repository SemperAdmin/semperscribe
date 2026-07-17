/**
 * R7 (USER_DRIVEN_ROADMAP) - signature block validators.
 *
 * Pure functions over the signature fields. Every issue is WARN
 * severity: signature conventions carry judgment (suffixes, particles,
 * acting/by-direction variants), so these advise rather than block.
 * The goal is catching the two common errors - a spelled-out first
 * name where naval format wants initials, and a freeform delegation
 * line - without false-flagging legitimate names.
 *
 * Authority: SECNAV M-5216.5 Ch. 7 (signature: initials + surname,
 * all caps) and the "By direction" / "Acting" delegation conventions.
 */

import { FormData } from '@/types';
import type { ValidationIssue } from '@/lib/letter-validators';

/** Doc types that render a left-block naval signature (formData.sig). */
const NAVAL_SIG_TYPES = new Set([
  'basic', 'multiple-address', 'endorsement', 'mco', 'bulletin',
  'secnav-instruction', 'secnav-notice', 'change-transmittal',
  'from-to-memo', 'letterhead-memo', 'mfr',
]);

/** Recognized delegation-authority phrases (case-insensitive prefix). */
const DELEGATION_FORMS = [
  'by direction',
  'acting',
  'deputy',
  'by direction of',
];

/** Name particles that are legitimately short-or-lowercase, not initials. */
const NAME_PARTICLES = new Set(['de', 'la', 'le', 'van', 'von', 'del', 'di', 'da', 'mac', 'mc', 'st']);

/**
 * True when a token reads as initials. Covers a bare letter ("J"), a
 * single initial ("J."), and a RUN of initials written without spaces
 * ("J.A.", "J.A.B.", "J.A") - the last case was a false-positive bug
 * caught by Stephen's local test run: "J.A. SMITH" is a correctly
 * formatted signature and must never be flagged as a spelled-out name.
 */
export function looksLikeInitial(token: string): boolean {
  if (/^[A-Za-z]$/.test(token)) return true;
  // One or more "X." groups, with an optional trailing letter and period.
  return /^(?:[A-Za-z]\.)+[A-Za-z]?\.?$/.test(token);
}

export function validateSignature(formData: FormData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!NAVAL_SIG_TYPES.has(formData.documentType)) return issues;

  const sig = (formData.sig ?? '').trim();

  // 1. First-name spelled out where the convention wants initials.
  if (sig) {
    const tokens = sig.split(/\s+/);
    if (tokens.length >= 2) {
      const first = tokens[0];
      const firstBare = first.replace(/\.$/, '');
      const isParticle = NAME_PARTICLES.has(firstBare.toLowerCase());
      // A surname-first "SMITH, J. A." form starts with a comma-terminated
      // token - do not flag that as a spelled-out first name.
      const isSurnameFirst = first.endsWith(',');
      if (!looksLikeInitial(first) && !isParticle && !isSurnameFirst && firstBare.length > 1) {
        issues.push({
          id: 'signature-initials',
          severity: 'warn',
          rule: 'Signature typically uses first and middle initials, not a spelled-out first name',
          citation: 'SECNAV M-5216.5 Ch. 7',
          detail: `"${first}" looks like a full first name. Naval format is initials plus surname, e.g. "${firstBare.charAt(0).toUpperCase()}. ${tokens.slice(1).join(' ')}".`,
        });
      }
    }
  }

  // 2. Delegation line present but not a recognized authority phrase.
  const delegation = (formData.delegationText ?? '').trim();
  if (delegation) {
    const lower = delegation.toLowerCase();
    const recognized = DELEGATION_FORMS.some((form) => lower.startsWith(form));
    if (!recognized) {
      issues.push({
        id: 'signature-delegation-form',
        severity: 'warn',
        rule: 'Delegation line does not match a standard authority phrase',
        citation: 'SECNAV M-5216.5 Ch. 7 (signature authority)',
        detail: `"${delegation}" is not one of: By direction, Acting, Deputy. Confirm the delegation wording is correct.`,
      });
    }
  }

  return issues;
}
