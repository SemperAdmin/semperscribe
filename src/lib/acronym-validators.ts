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
import { militaryDictionary } from '@/lib/military-dictionary';

/**
 * Tokens that are all-caps but need no definition: roman numerals,
 * emphasis words, and organizations a naval reader knows cold.
 * Deliberately tight - anything arguable stays flaggable.
 */
const STOPLIST = new Set([
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

/** acronym -> expansions, inverted from the dictionary (meaning = abbrev). */
let expansionIndex: Map<string, string[]> | null = null;

function getExpansions(acronym: string): string[] {
  if (!expansionIndex) {
    expansionIndex = new Map();
    for (const entry of militaryDictionary) {
      const abbrev = entry.meaning.trim();
      if (!/^[A-Z]{2,8}$/.test(abbrev)) continue;
      const list = expansionIndex.get(abbrev) ?? [];
      if (!list.includes(entry.term)) list.push(entry.term);
      expansionIndex.set(abbrev, list);
    }
  }
  return expansionIndex.get(acronym) ?? [];
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

export function validateAcronyms(paragraphs: ParagraphData[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Content only, joined in document order, so "first use" is real.
  const text = paragraphs.map((p) => p.content).join('\n');
  if (!text.trim()) return issues;

  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const pattern = new RegExp(ACRONYM.source, 'g');

  while ((m = pattern.exec(text)) !== null) {
    const acronym = m[0];
    if (seen.has(acronym) || STOPLIST.has(acronym)) continue;
    seen.add(acronym);

    // A parenthesized first occurrence IS the definition.
    const isParenthesized = text.slice(Math.max(0, m.index - 1), m.index) === '(';
    if (isParenthesized) continue;
    if (definedBefore(text, acronym, m.index)) continue;

    const expansions = getExpansions(acronym);
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
