'use client';

import { useEffect, useCallback } from 'react';
import { useSyncedState } from '@/hooks/useSyncedState';
import { MILITARY_ACRONYMS } from '@/lib/acronyms';

/**
 * Acronym guidance for a single paragraph (D.6).
 *
 * English spelling belongs to the browser. The paragraph textarea carries
 * spellCheck and lang="en-US", so the platform dictionary marks misspelled
 * words in the text itself. This pass no longer keeps an English word list
 * and no longer reports unknown words: the hand-typed allowlist it used to
 * carry flagged ordinary prose as suspect and taught drafters to ignore
 * the bar.
 *
 * What is left is the one thing the browser has no view of: SECNAV
 * M-5216.5 paragraph 2-17.c, spell an acronym out at first use and put the
 * acronym in parentheses. This pass supplies the expansion to write. It
 * does not state the rule or report a violation. The document-level
 * checker in acronym-validators.ts owns the rule, because first use is a
 * property of the whole document and a single paragraph has no view of it.
 * A paragraph which already spells an acronym out is left alone.
 */
export interface SpellIssue {
  word: string;
  index: number;       // character position in text
  suggestion: string;  // expansion to write on first use
  type: 'acronym-suggestion';
}

// Strip formatting markers so they do not pollute word extraction
function stripFormatting(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')   // bold
    .replace(/\*(.+?)\*/g, '$1')       // italic
    .replace(/<u>(.+?)<\/u>/g, '$1');  // underline
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
 * Look up a token in the acronym table. The match is exact, so the token
 * has to be written the way the table spells it: "MCO", or "GySgt" for the
 * mixed-case ranks. A lowercase token is ordinary prose and draws no
 * suggestion, which is what keeps this pass off the drafter's back.
 */
function expansionFor(word: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(MILITARY_ACRONYMS, word)) return null;
  return MILITARY_ACRONYMS[word];
}

/**
 * True when the paragraph spells the acronym out, as a word followed by
 * the acronym in parentheses. This is the form 2-17.c asks for, and it is
 * the same shape the document-level checker reads as a definition.
 */
function definedInText(text: string, acronym: string): boolean {
  const escaped = acronym.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&');
  return new RegExp(`\\w\\s*\\(${escaped}\\)`).test(text);
}

function findAcronyms(content: string): SpellIssue[] {
  const stripped = stripFormatting(content);
  const found: SpellIssue[] = [];
  const seen = new Set<string>();

  for (const token of tokenize(stripped)) {
    // Report each acronym once, at its first appearance
    if (seen.has(token.word)) continue;
    seen.add(token.word);

    const expansion = expansionFor(token.word);
    if (!expansion) continue;
    if (definedInText(stripped, token.word)) continue;

    found.push({
      word: token.word,
      index: token.index,
      suggestion: `${expansion} (${token.word})`,
      type: 'acronym-suggestion',
    });
  }

  return found;
}

export function useSpellCheck(text: string, enabled: boolean = true, debounceMs: number = 800) {
  // Issues clear in the render where the text empties or the check is
  // disabled. While text is merely edited, the previous issues stay
  // until the debounced check replaces them, so the list does not
  // flicker on every keystroke.
  const cleared = !enabled || !text;
  const [issues, setIssues] = useSyncedState(cleared, (isCleared, prev): SpellIssue[] =>
    isCleared ? [] : prev ?? [],
  );

  const runCheck = useCallback((content: string) => {
    if (!content || !enabled) {
      setIssues([]);
      return;
    }
    setIssues(findAcronyms(content));
  }, [enabled, setIssues]);

  useEffect(() => {
    if (cleared) return;
    const timer = setTimeout(() => runCheck(text), debounceMs);
    return () => clearTimeout(timer);
  }, [text, cleared, debounceMs, runCheck]);

  return { issues, recheck: () => runCheck(text) };
}
