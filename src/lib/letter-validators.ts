/**
 * Phase 2 letter validators — conditional-logic rules from
 * POLICY_COMPLIANCE_AUDIT.md (SECNAV M-5216.5; MCO 5216.20B).
 *
 * Pure functions: form state in, typed issues out. Severity contract:
 *   block — export must refuse (window-envelope rules, audit line 69)
 *   fail  — non-compliant output, fix before release
 *   warn  — cannot be verified automatically or plan-only provenance
 */
import { FormData, ParagraphData } from '@/types';

export type ValidatorSeverity = 'block' | 'fail' | 'warn';

export interface ValidationIssue {
  id: string;
  severity: ValidatorSeverity;
  rule: string;
  citation: string;
  detail: string;
}

/** Excel-style letters: 1 -> a, 26 -> z, 27 -> aa (audit line 147). */
export function indexToRefLetter(num: number): string {
  let result = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/**
 * Reference rules (audit line 24): every listed reference must be
 * cited in the text; references are listed in order of FIRST text
 * citation; citations must not exceed the list.
 */
export function validateReferences(
  references: string[],
  paragraphs: ParagraphData[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const refs = references.filter((r) => r.trim());
  if (refs.length === 0) return issues;

  const allText = paragraphs
    .map((p) => `${p.title ?? ''} ${p.content}`)
    .join(' ');

  // Citations: "ref (a)", "reference (b)", "refs (a) and (c)" — capture
  // every parenthesized letter group following a ref keyword, including
  // list continuations like "and (c)".
  const cited: string[] = [];
  const refClause = /\brefs?(?:erences?)?\s*((?:\([a-z]+\)(?:\s*(?:,|and|through|thru)?\s*)?)+)/gi;
  let m: RegExpExecArray | null;
  while ((m = refClause.exec(allText)) !== null) {
    const letters = m[1].matchAll(/\(([a-z]+)\)/g);
    for (const l of letters) cited.push(l[1].toLowerCase());
  }

  const citedSet = new Set(cited);
  const listedLetters = refs.map((_, i) => indexToRefLetter(i + 1));

  // Every listed ref cited in text.
  listedLetters.forEach((letter, i) => {
    if (!citedSet.has(letter)) {
      issues.push({
        id: `ref-not-cited-${letter}`,
        severity: 'fail',
        rule: 'Every listed reference must be cited in the text',
        citation: 'M-5216.5; audit line 24',
        detail: `Reference (${letter}) "${refs[i].slice(0, 40)}" is listed but never cited.`,
      });
    }
  });

  // Citations must not exceed the list.
  for (const letter of citedSet) {
    if (!listedLetters.includes(letter)) {
      issues.push({
        id: `ref-cited-not-listed-${letter}`,
        severity: 'fail',
        rule: 'Cited references must appear in the reference list',
        citation: 'M-5216.5; audit line 24',
        detail: `Text cites ref (${letter}) but only ${refs.length} reference(s) are listed.`,
      });
    }
  }

  // Order of first citation must equal listing order.
  const firstCitationOrder: string[] = [];
  for (const c of cited) {
    if (!firstCitationOrder.includes(c)) firstCitationOrder.push(c);
  }
  const expected = listedLetters.filter((l) => firstCitationOrder.includes(l));
  const mismatch = firstCitationOrder.findIndex((l, i) => l !== expected[i]);
  if (mismatch !== -1) {
    issues.push({
      id: 'ref-citation-order',
      severity: 'fail',
      rule: 'References are listed in order of first citation in the text',
      citation: 'M-5216.5; audit line 24',
      detail: `First-citation order is (${firstCitationOrder.join('), (')}) — reference (${firstCitationOrder[mismatch]}) is cited before (${expected[mismatch]}). Reorder the reference list.`,
    });
  }

  // NOTAL / undated annotations — PLAN-ONLY provenance (the audit text
  // does not state these rules; CORE_CONCEPTS_UPDATE_PLAN.md Phase 2
  // item 2 does). Surface as warns, never fails.
  refs.forEach((r, i) => {
    if (/\bNOTAL\b/.test(r) && !/\(NOTAL\)/.test(r)) {
      issues.push({
        id: `ref-notal-format-${indexToRefLetter(i + 1)}`,
        severity: 'warn',
        rule: 'NOTAL annotation is parenthesized: "(NOTAL)"',
        citation: 'CORE_CONCEPTS_UPDATE_PLAN.md Phase 2 item 2 (plan-only; not located in audit text)',
        detail: `Reference (${indexToRefLetter(i + 1)}) contains NOTAL without parentheses.`,
      });
    }
  });

  return issues;
}

/**
 * Paragraph structure rules (audit line ~148; M-5216.5 Fig 7-8):
 * a subdivision requires at least two members (1a needs 1b), and
 * subdividing never goes past level 8.
 */
export function validateParagraphStructure(
  paragraphs: ParagraphData[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ps = paragraphs.filter((p) => p.content.trim() || p.title);

  ps.forEach((p, i) => {
    if (p.level > 8) {
      issues.push({
        id: `level-cap-${p.id}`,
        severity: 'fail',
        rule: 'Never subdivide past the 8th level',
        citation: 'M-5216.5 Fig 7-8; audit line 43',
        detail: `Paragraph ${p.id} is at level ${p.level}.`,
      });
    }
  });

  // Lone-subdivision detection: for each paragraph, count siblings at
  // the same level under the same parent (same scan generateCitation
  // uses). A sibling group of exactly one is non-compliant.
  for (let i = 0; i < ps.length; i++) {
    const level = ps[i].level;
    if (level === 1) continue;
    // Find parent: nearest preceding paragraph with lower level.
    let parentIdx = -1;
    for (let j = i - 1; j >= 0; j--) {
      if (ps[j].level < level) { parentIdx = j; break; }
    }
    // Count members of this sibling group (scan forward from parent
    // until a paragraph at a level lower than `level`).
    let count = 0;
    let firstOfGroup = -1;
    for (let j = parentIdx + 1; j < ps.length; j++) {
      if (ps[j].level < level) break;
      if (ps[j].level === level) {
        if (firstOfGroup === -1) firstOfGroup = j;
        count++;
      }
    }
    // Report once, on the first member of a lone group.
    if (count === 1 && firstOfGroup === i) {
      issues.push({
        id: `lone-subdivision-${ps[i].id}`,
        severity: 'fail',
        rule: 'A subdivision requires at least two members (an "a" needs a "b")',
        citation: 'M-5216.5; MCO 5215.1K; audit line 148',
        detail: `Paragraph ${ps[i].id} (level ${level}) is the only member of its group.`,
      });
    }
  }

  return issues;
}

/**
 * Window-envelope rules (audit lines 29, 69) — HARD BLOCK:
 * reject the window format when the address exceeds 5 lines, when any
 * Via addressee exists, or when a classification is set.
 */
export function validateWindowEnvelope(
  formData: FormData,
  vias: string[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!formData.isWindowEnvelope) return issues;

  const addressLines = String(formData.to ?? '')
    .split('\n')
    .filter((l: string) => l.trim()).length;
  if (addressLines > 5) {
    issues.push({
      id: 'window-address-lines',
      severity: 'block',
      rule: 'Window envelope requires an address of 5 lines or fewer',
      citation: 'M-5216.5 Fig 7-3; audit lines 29, 69',
      detail: `Address has ${addressLines} lines.`,
    });
  }

  // Business/exec letters render no Via line at all (MCO 5216.20B;
  // the Fig 11-4 window variant has none). Via entries lingering in
  // form state from a previously selected letter type are not part of
  // this document — blocking on them is a false positive
  // (user-reported, 2026-06-10).
  const rendersVias = !['business-letter', 'executive-correspondence'].includes(
    formData.documentType,
  ) && !String(formData.documentType ?? '').startsWith('dla-');
  if (rendersVias && vias.some((v) => v.trim())) {
    issues.push({
      id: 'window-via',
      severity: 'block',
      rule: 'Window envelope is incompatible with Via addressees',
      citation: 'M-5216.5 Fig 7-3; audit lines 29, 69',
      detail: 'Remove the Via addressees or disable the window format.',
    });
  }

  // Classification rides as a C/S prefix on the SSIC (schemas.ts) or
  // an explicit classification field.
  const ssic = String(formData.ssic ?? '');
  const classified = /^[CS]\d/.test(ssic) ||
    (!!formData.classification && formData.classification !== 'UNCLASSIFIED');
  if (classified) {
    issues.push({
      id: 'window-classified',
      severity: 'block',
      rule: 'Window envelope requires unclassified correspondence',
      citation: 'M-5216.5 Fig 7-3; audit lines 29, 69',
      detail: `Classification detected (SSIC "${ssic}").`,
    });
  }

  return issues;
}

/**
 * Action-addressee rule (audit line 26): more than 4 action
 * addressees drops the To line in favor of a Distribution line.
 */
export function validateActionAddressees(formData: FormData): ValidationIssue[] {
  const recipients: string[] =
    formData.distribution?.recipients?.filter((r: string) => r && r.trim()) ?? [];
  const toCount = recipients.length || (String(formData.to ?? '').trim() ? 1 : 0);
  if (toCount > 4 && !formData.distribution?.toDistribution) {
    return [{
      id: 'addressees-over-four',
      severity: 'fail',
      rule: 'More than 4 action addressees: drop the To line, use a Distribution line',
      citation: 'M-5216.5 Ch 8; audit line 26',
      detail: `${toCount} action addressees listed. Switch to Distribution.`,
    }];
  }
  return [];
}

/**
 * Date-format-by-slot rules (plan Phase 2 item 6; M-5216.5 2-2 date
 * conventions; audit line 48 for the civilian business format):
 * sender symbols abbreviated (15 Feb 09); body text standard
 * (5 May 2015); business letters civilian (May 23, 2014).
 */
export function validateDateSlots(
  formData: FormData,
  paragraphs: ParagraphData[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const isCivilian = ['business-letter', 'executive-correspondence'].includes(
    formData.documentType,
  ) || String(formData.documentType ?? '').startsWith('dla-');

  const allText = paragraphs.map((p) => `${p.title ?? ''} ${p.content}`).join(' ');
  const civilianDate = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/;
  const abbreviatedDate = /\b\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2}\b(?!\d)/;

  if (!isCivilian) {
    if (civilianDate.test(allText)) {
      issues.push({
        id: 'date-civilian-in-text',
        severity: 'fail',
        rule: 'Body text uses the standard date (5 May 2015), not civilian (May 23, 2014)',
        citation: 'M-5216.5 2-2; plan Phase 2 item 6',
        detail: `Civilian-format date found in paragraph text: "${allText.match(civilianDate)?.[0]}".`,
      });
    }
    if (abbreviatedDate.test(allText)) {
      issues.push({
        id: 'date-abbreviated-in-text',
        severity: 'fail',
        rule: 'Body text uses the standard date (5 May 2015); the abbreviated form belongs in sender symbols only',
        citation: 'M-5216.5 2-2; plan Phase 2 item 6',
        detail: `Abbreviated date found in paragraph text: "${allText.match(abbreviatedDate)?.[0]}".`,
      });
    }
  }
  return issues;
}

/** Aggregate run used by the proofread engine and the export gate. */
export function runLetterValidators(
  formData: FormData,
  vias: string[],
  references: string[],
  paragraphs: ParagraphData[],
): ValidationIssue[] {
  return [
    ...validateReferences(references, paragraphs),
    ...validateParagraphStructure(paragraphs),
    ...validateWindowEnvelope(formData, vias),
    ...validateActionAddressees(formData),
    ...validateDateSlots(formData, paragraphs),
  ];
}

/** Export gate: hard blockers only (audit line 69 — "not a warning"). */
export function getExportBlockers(
  formData: FormData,
  vias: string[],
  references: string[],
  paragraphs: ParagraphData[],
): ValidationIssue[] {
  return runLetterValidators(formData, vias, references, paragraphs)
    .filter((i) => i.severity === 'block');
}
