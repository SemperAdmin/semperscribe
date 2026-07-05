'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { loadMilitaryWordSet } from '@/lib/reference-data';
import { MILITARY_ACRONYMS } from '@/lib/acronyms';

export interface SpellIssue {
  word: string;
  index: number;        // character position in text
  type: 'unknown' | 'acronym-suggestion';
  suggestion?: string;  // e.g. expansion of an acronym, or a correction
}

// Common English words that should never be flagged.
// This is intentionally small — we only need words that might appear
// in military correspondence and are NOT in the military word set.
const COMMON_ENGLISH = new Set([
  'THE', 'BE', 'TO', 'OF', 'AND', 'A', 'IN', 'THAT', 'HAVE', 'I',
  'IT', 'FOR', 'NOT', 'ON', 'WITH', 'HE', 'AS', 'YOU', 'DO', 'AT',
  'THIS', 'BUT', 'HIS', 'BY', 'FROM', 'THEY', 'WE', 'SAY', 'HER',
  'SHE', 'OR', 'AN', 'WILL', 'MY', 'ONE', 'ALL', 'WOULD', 'THERE',
  'THEIR', 'WHAT', 'SO', 'UP', 'OUT', 'IF', 'ABOUT', 'WHO', 'GET',
  'WHICH', 'GO', 'ME', 'WHEN', 'MAKE', 'CAN', 'LIKE', 'TIME', 'NO',
  'JUST', 'HIM', 'KNOW', 'TAKE', 'PEOPLE', 'INTO', 'YEAR', 'YOUR',
  'GOOD', 'SOME', 'COULD', 'THEM', 'SEE', 'OTHER', 'THAN', 'THEN',
  'NOW', 'LOOK', 'ONLY', 'COME', 'ITS', 'OVER', 'THINK', 'ALSO',
  'BACK', 'AFTER', 'USE', 'TWO', 'HOW', 'OUR', 'WORK', 'FIRST',
  'WELL', 'WAY', 'EVEN', 'NEW', 'WANT', 'BECAUSE', 'ANY', 'THESE',
  'GIVE', 'DAY', 'MOST', 'US', 'IS', 'ARE', 'WAS', 'WERE', 'BEEN',
  'BEING', 'HAS', 'HAD', 'DOES', 'DID', 'DOING', 'DONE', 'MADE',
  'SHOULD', 'SHALL', 'MAY', 'MUST', 'NEED', 'EACH', 'EVERY', 'BOTH',
  'FEW', 'MORE', 'MANY', 'MUCH', 'SUCH', 'BEFORE', 'BETWEEN',
  'UNDER', 'AGAIN', 'FURTHER', 'THOSE', 'OWN', 'SAME', 'DURING',
  'WHILE', 'WHERE', 'VERY', 'THROUGH', 'BELOW', 'ABOVE', 'BELOW',
  'PER', 'THE', 'FOLLOWING', 'ENSURE', 'UPON', 'WITHIN', 'WITHOUT',
  'ACCORDINGLY', 'WHEREAS', 'HEREBY', 'THEREOF', 'HEREIN', 'THEREIN',
  'HEREWITH', 'HOWEVER', 'THEREFORE', 'REFERENCE', 'REFERENCED',
  'SUBJECT', 'PURSUANT', 'EFFECTIVE', 'IMMEDIATELY', 'ATTACHED',
  'ENCLOSED', 'FORWARDED', 'RECOMMENDED', 'APPROVED', 'DISAPPROVED',
  'REQUESTED', 'DIRECTED', 'AUTHORIZED', 'REQUIRED', 'SUBMITTED',
  'PROVIDED', 'INDICATED', 'ADDRESSED', 'ASSIGNED', 'DESIGNATED',
  'ESTABLISHED', 'ACCOMPLISHED', 'COMPLETED', 'CONTINUED', 'RECEIVED',
  'NOTED', 'CONCUR', 'NONCONCUR', 'SIGNED', 'UNSIGNED', 'CLASSIFIED',
  'UNCLASSIFIED', 'DISTRIBUTION', 'COMMANDING', 'OFFICER', 'GENERAL',
  'COLONEL', 'CAPTAIN', 'LIEUTENANT', 'MAJOR', 'SERGEANT', 'CORPORAL',
  'PRIVATE', 'ADMIRAL', 'COMMANDER', 'CHIEF', 'STAFF', 'DEPUTY',
  'ASSISTANT', 'DIRECTOR', 'HEAD', 'SECTION', 'DIVISION', 'BRANCH',
  'OFFICE', 'UNIT', 'COMMAND', 'FORCE', 'GROUP', 'TEAM', 'SQUADRON',
  'BATTALION', 'REGIMENT', 'BRIGADE', 'COMPANY', 'PLATOON', 'MARINE',
  'MARINES', 'NAVY', 'NAVAL', 'CORPS', 'AMPHIBIOUS', 'INFANTRY',
  'ARTILLERY', 'AVIATION', 'LOGISTICS', 'COMBAT', 'OPERATIONS',
  'TRAINING', 'EDUCATION', 'PERSONNEL', 'SUPPLY', 'MAINTENANCE',
  'COMMUNICATION', 'INTELLIGENCE', 'SECURITY', 'SUPPORT', 'SERVICE',
  'SERVICES', 'REPORT', 'REPORTS', 'ORDER', 'ORDERS', 'INSTRUCTION',
  'DIRECTIVE', 'POLICY', 'PROCEDURE', 'STANDARD', 'REGULATION',
  'MANUAL', 'GUIDE', 'CHAPTER', 'PARAGRAPH', 'SECTION', 'ENCLOSURE',
  'APPENDIX', 'ANNEX', 'TAB', 'EXHIBIT', 'FIGURE', 'TABLE', 'PAGE',
  'DATE', 'NUMBER', 'TOTAL', 'AMOUNT', 'PERIOD', 'FISCAL', 'CALENDAR',
  'ANNUAL', 'QUARTERLY', 'MONTHLY', 'WEEKLY', 'DAILY', 'CURRENT',
  'PREVIOUS', 'NEXT', 'LAST', 'BEGINNING', 'ENDING', 'EFFECTIVE',
  'MISSION', 'SITUATION', 'EXECUTION', 'COORDINATING', 'COORDINATION',
  'ADMINISTRATION', 'LOGISTICS', 'CONCEPT', 'INTENT', 'PURPOSE',
  'BACKGROUND', 'DISCUSSION', 'RECOMMENDATION', 'RECOMMENDATIONS',
  'ACTION', 'ACTIONS', 'DECISION', 'POINT', 'POINTS', 'ISSUE',
  'ISSUES', 'INFORMATION', 'DATA', 'ANALYSIS', 'ASSESSMENT', 'REVIEW',
  'PLAN', 'PROGRAM', 'PROJECT', 'BUDGET', 'FUNDING', 'RESOURCES',
  'EQUIPMENT', 'MATERIAL', 'WEAPON', 'VEHICLE', 'AIRCRAFT', 'SHIP',
  'FACILITY', 'INSTALLATION', 'BASE', 'CAMP', 'STATION', 'POST',
  'NOT', 'BEEN', 'HAVE', 'HAS', 'WILL', 'SHALL', 'WOULD', 'SHOULD',
  'COULD', 'CAN', 'MAY', 'MIGHT', 'MUST', 'NEED', 'DOES', 'DID',
  'REGARDING', 'CONCERNING', 'PERTAINING', 'RELATED', 'APPLICABLE',
  'APPROPRIATE', 'NECESSARY', 'SUFFICIENT', 'ADEQUATE', 'SPECIFIC',
]);

// Strip formatting markers so they don't pollute word extraction
function stripFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/\*(.+?)\*/g, '$1')         // *italic*
    .replace(/<u>(.+?)<\/u>/g, '$1');    // <u>underline</u>
}

// Tokenize text into words with their positions
function tokenize(text: string): { word: string; index: number }[] {
  const tokens: { word: string; index: number }[] = [];
  const regex = /[A-Za-z][A-Za-z0-9/&'-]*/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({ word: match[0], index: match.index });
  }
  return tokens;
}

/**
 * Check a single word against our dictionaries.
 * Returns null if the word is recognized, or a SpellIssue if not.
 */
function checkWord(word: string, index: number, milWords: Set<string>): SpellIssue | null {
  const upper = word.toUpperCase();

  // Skip very short words (1-2 chars) — too many false positives
  if (word.length <= 2) return null;

  // Skip numbers and number-prefixed tokens (e.g. "3d", "1st")
  if (/^\d/.test(word)) return null;

  // Check common English
  if (COMMON_ENGLISH.has(upper)) return null;

  // Check military word set
  if (milWords.has(upper)) return null;

  // Check if it's a known military acronym — show its expansion as a suggestion
  const acronymMeaning = MILITARY_ACRONYMS[upper] || MILITARY_ACRONYMS[word];
  if (acronymMeaning) {
    return { word, index, type: 'acronym-suggestion', suggestion: `${acronymMeaning} (${upper})` };
  }

  // If it looks like an all-caps acronym (3+ caps), be lenient — many acronyms
  // won't be in our set. Only flag if it's mixed case.
  if (/^[A-Z]{3,}$/.test(word)) return null;

  // Flag as unknown
  return { word, index, type: 'unknown' };
}

export function useSpellCheck(text: string, enabled: boolean = true, debounceMs: number = 800) {
  const [issues, setIssues] = useState<SpellIssue[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lazy-loaded word set; null until the chunk arrives. Checks are
  // deferred (not run with an empty set) so military terms are never
  // briefly flagged as unknown while the data loads.
  const [milWordSet, setMilWordSet] = useState<Set<string> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    loadMilitaryWordSet().then(set => {
      if (!cancelled) setMilWordSet(set);
    }).catch(e => console.error('Failed to load military word set:', e));
    return () => { cancelled = true; };
  }, [enabled]);

  const runCheck = useCallback((content: string) => {
    if (!content || !enabled) {
      setIssues([]);
      return;
    }
    if (!milWordSet) return;

    const milWords = milWordSet;
    const stripped = stripFormatting(content);
    const tokens = tokenize(stripped);
    const found: SpellIssue[] = [];
    const seen = new Set<string>();

    for (const token of tokens) {
      // Deduplicate — only report each unique word once
      const key = token.word.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const issue = checkWord(token.word, token.index, milWords);
      if (issue) {
        found.push(issue);
      }
    }

    setIssues(found);
  }, [enabled, milWordSet]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!enabled || !text) {
      setIssues([]);
      return;
    }

    timerRef.current = setTimeout(() => runCheck(text), debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, enabled, debounceMs, runCheck]);

  return { issues, recheck: () => runCheck(text) };
}
