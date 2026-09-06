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
import { ranks } from '@/lib/ranks';

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

/**
 * Rank and grade tokens which never belong on a naval signature line.
 *
 * M-5216.5 7-2.14.b lists the four forms a signature line takes: name
 * only, name and title, name and title and "Acting", or name and "By
 * direction". No form carries a rank, and 7-2.14.a(1) asks only for
 * the typed name below the signature with the surname in capitals.
 *
 * The Marine abbreviations come from src/lib/ranks.ts, the app's own
 * rank table, so the two never drift apart. The supplement below is
 * the other services, which a naval letter signer is as free to be:
 * ranks.ts is Marine Corps only, and a Navy or Army signer typing
 * "LCDR" or "MAJ" is exactly the case this rule is for. Pay grades
 * are included because 7-2.14.b has no form for a grade either.
 */
const OTHER_SERVICE_RANKS = [
  // Navy officer and warrant
  'ENS', 'LTJG', 'LT', 'LCDR', 'CDR', 'CAPT', 'RDML', 'RADM', 'VADM', 'ADM',
  // Navy enlisted. The apprenticeships (SR, SA, SN) are left out
  // deliberately: "SR" collides with the generational suffix in
  // "J. A. SMITH SR", and a signature line at that pay grade is rare.
  'PO3', 'PO2', 'PO1', 'CPO', 'SCPO', 'MCPO',
  // Army and Air Force officer
  '2LT', '1LT', 'CPT', 'MAJ', 'LTC', 'COL', 'BG', 'MG', 'LTG', 'GEN',
  // Army and Air Force enlisted
  'PVT', 'PFC', 'SPC', 'CPL', 'SGT', 'SSG', 'SFC', 'MSG', 'SGM', 'CSM',
  'AMN', 'SRA', 'SSGT', 'TSGT', 'MSGT', 'SMSGT', 'CMSGT',
];

/** Pay grades, with or without the dash the forms argue about. */
const PAY_GRADE = /^[EWO]-?(?:10|[1-9])$/i;

/** Every rank token this rule recognises, upper case for comparison. */
const RANK_TOKENS = new Set<string>([
  ...ranks.map((r) => r.abbreviation.toUpperCase()),
  ...OTHER_SERVICE_RANKS,
]);

/** Spelled-out rank names, longest first so "Lieutenant Colonel" wins. */
const RANK_NAMES = ranks
  .map((r) => r.name.toUpperCase())
  .sort((a, b) => b.length - a.length);

/**
 * The rank or grade a signature line carries, or null when it carries
 * none. Trailing punctuation is stripped, so "Maj." reads as "MAJ".
 */
export function rankInSignature(sig: string): string | null {
  const clean = sig.trim();
  if (!clean) return null;
  const upper = clean.toUpperCase();
  for (const name of RANK_NAMES) {
    if (upper.startsWith(name + ' ')) return name;
  }
  for (const raw of clean.split(/\s+/)) {
    const token = raw.replace(/[.,]+$/, '');
    if (!token) continue;
    if (RANK_TOKENS.has(token.toUpperCase())) return token;
    if (PAY_GRADE.test(token)) return token;
  }
  return null;
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

  // 2. Rank or grade on the signature line (7-2.14.b).
  if (sig) {
    const rank = rankInSignature(sig);
    if (rank) {
      issues.push({
        id: 'signature-rank',
        severity: 'warn',
        field: 'sig',
        rule: 'A naval signature line carries no rank or grade',
        citation: 'SECNAV M-5216.5 7-2.14.b',
        detail:
          `"${rank}" reads as a rank or grade. The four forms are name, name and title, name and title with `
          + '"Acting", or name with "By direction". Drop the rank and leave the surname in capitals.',
      });
    }
  }

  // 3. Delegation line present but not a recognized authority phrase.
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
