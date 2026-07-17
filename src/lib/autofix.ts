/**
 * R5 (USER_DRIVEN_ROADMAP) - one-click autofix for validation issues.
 *
 * The category move: validators say what is wrong, fixers make it
 * right. Every fixer is a PURE function over the document slices,
 * returning new slices - the caller applies them through the normal
 * setters, so one fix equals one undo step.
 *
 * Rules for adding a fixer:
 * 1. Only mechanical, unambiguous corrections. Anything requiring
 *    judgment stays advisory - a wrong "fix" is worse than a warning.
 * 2. Never touch content outside the rule's scope (see the citation
 *    remap: it rewrites letters ONLY inside reference clauses).
 * 3. Fixing must be idempotent - running it twice changes nothing.
 */

import { FormData, ParagraphData } from '@/types';
import { indexToRefLetter } from '@/lib/letter-validators';
import { looksLikeInitial } from '@/lib/signature-validators';

export interface DocumentSlices {
  formData: FormData;
  paragraphs: ParagraphData[];
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  distList: string[];
}

export interface Fixer {
  /** Validator issue id, or a prefix when the id carries a suffix. */
  match: (issueId: string) => boolean;
  /** Button label shown on the issue. */
  label: string;
  /** Pure transform. Returns the same object when nothing changes. */
  apply: (slices: DocumentSlices) => DocumentSlices;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_BY_ABBREV: Record<string, string> = {
  Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
  Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December',
};

/** The reference-clause matcher - MUST mirror validateReferences. */
const REF_CLAUSE = /\brefs?(?:erences?)?\s*((?:\([a-z]+\)(?:\s*(?:,|and|through|thru)?\s*)?)+)/gi;

function mapParagraphs(
  paragraphs: ParagraphData[],
  transform: (text: string) => string,
): ParagraphData[] {
  let changed = false;
  const next = paragraphs.map((p) => {
    const content = transform(p.content);
    if (content !== p.content) changed = true;
    return content === p.content ? p : { ...p, content };
  });
  return changed ? next : paragraphs;
}

// ---------------------------------------------------------------------------
// Fixer: reference list order (ref-citation-order)
// ---------------------------------------------------------------------------

/**
 * Reorders the reference list into first-citation order AND remaps the
 * in-text citation letters to match, so the letters keep pointing at
 * the same reference content. Rewrites letters only inside reference
 * clauses - a paragraph designator like "(a)" is never touched.
 */
export function fixReferenceOrder(slices: DocumentSlices): DocumentSlices {
  const refs = slices.references.filter((r) => r.trim());
  if (refs.length < 2) return slices;

  const listedLetters = refs.map((_, i) => indexToRefLetter(i + 1));
  const allText = slices.paragraphs.map((p) => `${p.title ?? ''} ${p.content}`).join(' ');

  // First-citation order, restricted to letters that actually exist.
  const cited: string[] = [];
  let m: RegExpExecArray | null;
  const clause = new RegExp(REF_CLAUSE.source, 'gi');
  while ((m = clause.exec(allText)) !== null) {
    for (const l of m[1].matchAll(/\(([a-z]+)\)/g)) {
      const letter = l[1].toLowerCase();
      if (listedLetters.includes(letter) && !cited.includes(letter)) cited.push(letter);
    }
  }
  if (cited.length === 0) return slices;

  // New order: cited refs in citation order, then any uncited refs
  // keeping their relative order.
  const uncited = listedLetters.filter((l) => !cited.includes(l));
  const newOrder = [...cited, ...uncited];
  if (newOrder.every((l, i) => l === listedLetters[i])) return slices; // already correct

  // old letter -> new letter
  const remap = new Map<string, string>();
  newOrder.forEach((oldLetter, newIndex) => {
    remap.set(oldLetter, indexToRefLetter(newIndex + 1));
  });

  const newReferences = newOrder.map((letter) => refs[listedLetters.indexOf(letter)]);

  // Remap citation letters inside reference clauses only.
  const remapText = (text: string): string =>
    text.replace(new RegExp(REF_CLAUSE.source, 'gi'), (whole, group: string) => {
      const fixedGroup = group.replace(/\(([a-z]+)\)/g, (paren, letter: string) => {
        const mapped = remap.get(letter.toLowerCase());
        return mapped ? `(${mapped})` : paren;
      });
      return whole.replace(group, fixedGroup);
    });

  return {
    ...slices,
    references: newReferences,
    paragraphs: mapParagraphs(slices.paragraphs, remapText),
  };
}

// ---------------------------------------------------------------------------
// Fixer: civilian date in body text (date-civilian-in-text)
// ---------------------------------------------------------------------------

/** "May 23, 2014" -> "23 May 2014". */
export function fixCivilianDates(slices: DocumentSlices): DocumentSlices {
  const pattern = new RegExp(`\\b(${MONTHS.join('|')})\\s+(\\d{1,2}),\\s+(\\d{4})\\b`, 'g');
  return {
    ...slices,
    paragraphs: mapParagraphs(slices.paragraphs, (text) =>
      text.replace(pattern, (_all, month: string, day: string, year: string) => `${Number(day)} ${month} ${year}`),
    ),
  };
}

// ---------------------------------------------------------------------------
// Fixer: abbreviated date in body text (date-abbreviated-in-text)
// ---------------------------------------------------------------------------

/**
 * "5 May 15" -> "5 May 2015". Two-digit years expand to 20YY: the
 * abbreviated form belongs to sender symbols on current correspondence,
 * so a 19xx reading is not a live case.
 */
export function fixAbbreviatedDates(slices: DocumentSlices): DocumentSlices {
  const abbrevs = Object.keys(MONTH_BY_ABBREV).join('|');
  const pattern = new RegExp(`\\b(\\d{1,2})\\s+(${abbrevs})\\s+(\\d{2})\\b(?!\\d)`, 'g');
  return {
    ...slices,
    paragraphs: mapParagraphs(slices.paragraphs, (text) =>
      text.replace(pattern, (_all, day: string, abbrev: string, year: string) =>
        `${Number(day)} ${MONTH_BY_ABBREV[abbrev]} 20${year}`,
      ),
    ),
  };
}

// ---------------------------------------------------------------------------
// Fixer: NOTAL parenthesization (ref-notal-format-*)
// ---------------------------------------------------------------------------

/** Bare NOTAL -> (NOTAL) in the reference list. */
export function fixNotalFormat(slices: DocumentSlices): DocumentSlices {
  let changed = false;
  const references = slices.references.map((r) => {
    if (!/\bNOTAL\b/.test(r) || /\(NOTAL\)/.test(r)) return r;
    changed = true;
    return r.replace(/\bNOTAL\b/g, '(NOTAL)');
  });
  return changed ? { ...slices, references } : slices;
}

// ---------------------------------------------------------------------------
// Fixer: signature initials (signature-initials)
// ---------------------------------------------------------------------------

/** "JOHN A. SMITH" -> "J. A. SMITH". Leaves the surname untouched. */
export function fixSignatureInitials(slices: DocumentSlices): DocumentSlices {
  const sig = (slices.formData.sig ?? '').trim();
  if (!sig) return slices;
  const tokens = sig.split(/\s+/);
  if (tokens.length < 2) return slices;
  const first = tokens[0];
  if (first.endsWith(',')) return slices; // surname-first form
  // Share the validator's predicate so the fixer and the rule that
  // triggers it can never disagree about what counts as initials
  // (e.g. "J.A." - a run of initials, not a spelled-out name).
  if (looksLikeInitial(first)) return slices;
  const bare = first.replace(/\.$/, '');
  if (!/^[A-Za-z]+$/.test(bare)) return slices; // not a plain name token
  const initial = `${bare.charAt(0).toUpperCase()}.`;
  return {
    ...slices,
    formData: { ...slices.formData, sig: [initial, ...tokens.slice(1)].join(' ') },
  };
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const FIXERS: Fixer[] = [
  { match: (id) => id === 'ref-citation-order', label: 'Reorder references', apply: fixReferenceOrder },
  { match: (id) => id === 'date-civilian-in-text', label: 'Convert to standard date', apply: fixCivilianDates },
  { match: (id) => id === 'date-abbreviated-in-text', label: 'Expand to standard date', apply: fixAbbreviatedDates },
  { match: (id) => id.startsWith('ref-notal-format-'), label: 'Parenthesize NOTAL', apply: fixNotalFormat },
  { match: (id) => id === 'signature-initials', label: 'Use initials', apply: fixSignatureInitials },
];

/** The fixer for an issue id, or undefined when none applies. */
export function getFixer(issueId: string): Fixer | undefined {
  return FIXERS.find((f) => f.match(issueId));
}

export function hasFixer(issueId: string): boolean {
  return getFixer(issueId) !== undefined;
}

/** Applies every fixer whose issue is present. Returns new slices. */
export function fixAll(slices: DocumentSlices, issueIds: string[]): DocumentSlices {
  const applied = new Set<Fixer>();
  let next = slices;
  for (const id of issueIds) {
    const fixer = getFixer(id);
    if (fixer && !applied.has(fixer)) {
      applied.add(fixer);
      next = fixer.apply(next);
    }
  }
  return next;
}
