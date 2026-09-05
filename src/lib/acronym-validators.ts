/**
 * R6 (USER_DRIVEN_ROADMAP) - acronym first-use checker.
 *
 * SECNAV M-5216.5: spell an acronym out at first use, with the acronym
 * in parentheses - "Marine Corps Order (MCO)" - then use the acronym
 * alone. This finds acronyms that appear in body text without ever
 * being defined, and suggests the expansion when the military
 * dictionary knows exactly one.
 *
 * NO AUTOFIX by design (see autofix.ts rule 1): choosing the right
 * expansion, its capitalization for running text, and whether a
 * token is even an acronym all need human judgment. Wrong "fixes"
 * are worse than warnings. Advisory only, warn severity.
 *
 * Scope: paragraph CONTENT only. Subjects and directive paragraph
 * titles are all-caps by format, so scanning them would flag every
 * word.
 */

import { ParagraphData } from '@/types';
import type { ValidationIssue } from '@/lib/letter-validators';
import type { DictionaryEntry } from '@/lib/military-dictionary';

/**
 * Tokens that are all-caps but need no definition: roman numerals,
 * emphasis words, and organizations a naval reader knows cold.
 * Deliberately tight - anything arguable stays flaggable.
 */
export const ACRONYM_STOPLIST = new Set([
  // Roman numerals
  'II', 'III', 'IV', 'VI', 'VII', 'VIII', 'IX', 'XI', 'XII',
  // Emphasis / plain words that appear capitalized in running text
  'MUST', 'SHALL', 'WILL', 'NOT', 'ALL', 'ANY', 'MAY', 'AND', 'THE', 'FOR',
  'NOTE', 'WARNING', 'CAUTION', 'YES', 'NO', 'OK',
  // Universally known in naval correspondence
  'US', 'USA', 'USMC', 'USN', 'USAF', 'USCG', 'DOD', 'DON', 'SECNAV',
  'CMC', 'HQMC', 'CONUS', 'OCONUS', 'NOTAL',
  // Format tokens
  'SUBJ', 'REF', 'ENCL', 'VIA', 'FROM', 'TO', 'CANC',
]);

const ACRONYM = /\b[A-Z]{2,6}\b/g;

/**
 * acronym -> expansions, inverted from the dictionary (meaning = abbrev).
 * Built once per dictionary array and cached by identity, so a caller
 * which holds the loaded table pays for the index one time. The
 * subject-line rule in letter-validators.ts reads the same index, so
 * the two rules agree on what counts as a known acronym.
 */
const expansionIndexes = new WeakMap<readonly DictionaryEntry[], Map<string, string[]>>();

export function expansionIndexFor(dictionary: readonly DictionaryEntry[]): Map<string, string[]> {
  let index = expansionIndexes.get(dictionary);
  if (!index) {
    index = new Map();
    for (const entry of dictionary) {
      const abbrev = entry.meaning.trim();
      if (!/^[A-Z]{2,8}$/.test(abbrev)) continue;
      const list = index.get(abbrev) ?? [];
      if (!list.includes(entry.term)) list.push(entry.term);
      index.set(abbrev, list);
    }
    expansionIndexes.set(dictionary, index);
  }
  return index;
}

/**
 * True when the text defines the acronym at or before `index`:
 * a parenthesized "(ACRO)" preceded by at least one word.
 */
function definedBefore(text: string, acronym: string, index: number): boolean {
  const defPattern = new RegExp(`\\w\\s*\\(${acronym}\\)`, 'g');
  let m: RegExpExecArray | null;
  while ((m = defPattern.exec(text)) !== null) {
    if (m.index <= index) return true;
  }
  return false;
}

/**
 * Flags acronyms used before they are spelled out. Detection needs no
 * data; the optional `dictionary` (the lazily loaded military table,
 * B.5 of HARDENING_PLAN_2026-09) only adds the suggested expansion to
 * the detail text. Without it the same issues are reported, unsuggested.
 */
export function validateAcronyms(
  paragraphs: ParagraphData[],
  dictionary: readonly DictionaryEntry[] = [],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const expansionIndex = dictionary.length > 0 ? expansionIndexFor(dictionary) : null;
  // Content only, joined in document order, so "first use" is real.
  const text = paragraphs.map((p) => p.content).join('\n');
  if (!text.trim()) return issues;

  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const pattern = new RegExp(ACRONYM.source, 'g');

  while ((m = pattern.exec(text)) !== null) {
    const acronym = m[0];
    if (seen.has(acronym) || ACRONYM_STOPLIST.has(acronym)) continue;
    seen.add(acronym);

    // A parenthesized first occurrence IS the definition.
    const isParenthesized = text.slice(Math.max(0, m.index - 1), m.index) === '(';
    if (isParenthesized) continue;
    if (definedBefore(text, acronym, m.index)) continue;

    const expansions = expansionIndex?.get(acronym) ?? [];
    const suggestion =
      expansions.length === 1
        ? ` The dictionary reads it as "${expansions[0]}".`
        : expansions.length > 1
          ? ` The dictionary offers ${expansions.length} readings (e.g. "${expansions[0]}") - confirm which applies.`
          : '';

    issues.push({
      id: `acronym-undefined-${acronym}`,
      severity: 'warn',
      rule: `Acronym "${acronym}" is used without being spelled out at first use`,
      citation: 'SECNAV M-5216.5 (acronyms: spell out at first use)',
      detail: `Write it out with the acronym in parentheses the first time, e.g. "Spelled Out Words (${acronym})", then use "${acronym}" alone.${suggestion}`,
    });
  }

  return issues;
}
