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
import { validateClassification } from '@/lib/classification';
import { validateSignature } from '@/lib/signature-validators';
import { validateAcronyms, ACRONYM_STOPLIST, expansionIndexFor } from '@/lib/acronym-validators';
import type { DictionaryEntry } from '@/lib/military-dictionary';
import { runNavmc10922Validators } from '@/lib/navmc10922-validators';
import { runNavmc10132Validators } from '@/lib/navmc10132-validators';
import { isSamePageEndorsement } from '@/lib/same-page-endorsement';
import {
  validateSchemaFields,
  validateSalutation,
  validateCivilianReferences,
  validateRetiredFouo,
} from '@/lib/schema-validators';
import {
  refLetterAt,
  startingRefLetterFor,
  startingEnclosureNumberFor,
} from '@/lib/reference-letters';

// One source for reference lettering across the validator and both
// emitters (src/lib/reference-letters.ts). Re-exported here so the
// existing importers of indexToRefLetter keep their path.
export { indexToRefLetter } from '@/lib/reference-letters';

export type ValidatorSeverity = 'block' | 'fail' | 'warn';

export interface ValidationIssue {
  id: string;
  severity: ValidatorSeverity;
  rule: string;
  citation: string;
  detail: string;
  /**
   * The form field the issue belongs to, when one field owns it. The
   * compliance dialog turns this into a jump-to-field action, so the
   * value is a form field name (the same name the header inputs
   * carry), never a label.
   */
  field?: string;
}

/**
 * Reference rules (audit line 24): every listed reference must be
 * cited in the text, references are listed in order of FIRST text
 * citation, and citations must not exceed the list.
 *
 * startLetter is the letter the first listed reference carries. It is
 * "a" for every document which starts its own sequence and the
 * continuation letter for an endorsement (M-5216.5 9-2.3), so an
 * endorsement whose list runs (c) and (d) is read against those two
 * letters rather than against (a) and (b).
 */
export function validateReferences(
  references: string[],
  paragraphs: ParagraphData[],
  startLetter: string = 'a',
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
  // Separators are required tokens inside the starred group (no bare `\s*`
  // alternative), so whitespace has a single parse — avoids polynomial
  // backtracking (CodeQL js/polynomial-redos) on imported document text.
  const refClause = /\brefs?(?:erences?)?\s*((?:\([a-z]+\)(?:\s*(?:,|and|through|thru))*\s*)+)/gi;
  let m: RegExpExecArray | null;
  while ((m = refClause.exec(allText)) !== null) {
    const letters = m[1].matchAll(/\(([a-z]+)\)/g);
    for (const l of letters) cited.push(l[1].toLowerCase());
  }

  const citedSet = new Set(cited);
  const listedLetters = refs.map((_, i) => refLetterAt(startLetter, i));

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
        detail: `Text cites ref (${letter}) but the reference list runs (${listedLetters[0]}) to (${listedLetters[listedLetters.length - 1]}).`,
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
        id: `ref-notal-format-${refLetterAt(startLetter, i)}`,
        severity: 'warn',
        rule: 'NOTAL annotation is parenthesized: "(NOTAL)"',
        citation: 'CORE_CONCEPTS_UPDATE_PLAN.md Phase 2 item 2 (plan-only; not located in audit text)',
        detail: `Reference (${refLetterAt(startLetter, i)}) contains NOTAL without parentheses.`,
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
/**
 * P3.2 — directive typewriter spacing (MCO 5215.1K; USMC directives
 * follow typewriter conventions: two spaces after a sentence period).
 * WARN only and deliberately conservative: flags ". X" only when the
 * period ends a word of two or more lowercase letters, so "U.S.",
 * "e.g.", and initialisms do not trip it. The tool never rewrites
 * user text (user-responsibility posture); the author fixes it.
 */
export function validateDirectiveTypography(
  formData: FormData,
  paragraphs: ParagraphData[],
): ValidationIssue[] {
  // P4.3: SECNAV directives share the Courier typewriter conventions
  // (warn-only, as ruled for P3.3 typography checks).
  const isAnyDirective = ['mco', 'bulletin', 'change-transmittal', 'secnav-instruction', 'secnav-notice']
    .includes(formData.documentType);
  if (!isAnyDirective) return [];
  const issues: ValidationIssue[] = [];
  const singleSpaced = /[a-z]{2}[.!?] (?=[A-Z])/;
  for (const p of paragraphs) {
    if (singleSpaced.test(p.content)) {
      issues.push({
        id: `directive-sentence-spacing-${p.id}`,
        severity: 'warn',
        rule: 'Directives use two spaces after a sentence period',
        citation: 'MCO 5215.1K (typewriter conventions)',
        detail: 'A sentence in this paragraph is followed by a single space. USMC directives use two.',
      });
      break; // one warning per document is enough signal
    }
  }
  return issues;
}

/**
 * P3.5 — mandatory paragraph schemas (MCO 5215.1K; audit lines 139-140).
 * MCO (SMEAC): Situation, [Cancellation always second], Mission,
 * Execution, Administration and Logistics, Command and Signal.
 * MCBul: Purpose always first, [Cancellation second], Background,
 * Action, Reserve Applicability, [Cancellation Contingency last].
 * Order is checked on level-1 paragraph titles; content is the
 * author's responsibility (Signal effectiveness sentence is a manual
 * check, not automated).
 */
const MCO_MANDATORY = ['situation', 'mission', 'execution', 'administration and logistics', 'command and signal'];
const MCBUL_MANDATORY = ['purpose'];

export function validateDirectiveSchema(
  formData: FormData,
  paragraphs: ParagraphData[],
): ValidationIssue[] {
  const t = formData.documentType;
  if (t !== 'mco' && t !== 'bulletin') return [];
  const issues: ValidationIssue[] = [];
  const titles = paragraphs
    .filter((p) => p.level <= 1 && p.title && p.title.trim())
    .map((p) => p.title!.trim().toLowerCase());

  const mandatory = t === 'mco' ? MCO_MANDATORY : MCBUL_MANDATORY;
  for (const m of mandatory) {
    if (!titles.includes(m)) {
      issues.push({
        id: `directive-missing-${m.replace(/\s+/g, '-')}`,
        // WARN, not fail: MCO 5215.1K sanctions reduced formats
        // (e.g. assumption-of-command orders per Fig 1-1, which carry
        // only Situation/Cancellation/Execution). The order and slot
        // rules below remain fail severity.
        severity: 'warn',
        rule: `${t === 'mco' ? 'MCO' : 'MCBul'} requires a "${m.replace(/(^|\s)\S/g, (c) => c.toUpperCase())}" paragraph`,
        citation: 'MCO 5215.1K (mandatory paragraphs; Fig 1-1 reduced formats exempt)',
        detail: 'Mandatory level-1 paragraph title not found.',
      });
    }
  }

  // Relative order of the mandatory titles must hold.
  const positions = mandatory
    .map((m) => titles.indexOf(m))
    .filter((i) => i >= 0);
  if ([...positions].sort((a, b) => a - b).join() !== positions.join()) {
    issues.push({
      id: 'directive-paragraph-order',
      severity: 'fail',
      rule: 'Mandatory paragraphs are out of order',
      citation: 'MCO 5215.1K (mandatory paragraph sequence)',
      detail: `Required sequence: ${mandatory.join(', ')}.`,
    });
  }

  // Cancellation, when present, is always second (MCO) / second (MCBul).
  const cancIdx = titles.indexOf('cancellation');
  if (cancIdx >= 0 && cancIdx !== 1) {
    issues.push({
      id: 'directive-cancellation-position',
      severity: 'fail',
      rule: 'Cancellation paragraph must be second when present',
      citation: 'MCO 5215.1K (audit lines 139-140)',
      detail: `Found at position ${cancIdx + 1}.`,
    });
  }

  // MCBul: Purpose must be FIRST, Cancellation Contingency LAST.
  if (t === 'bulletin') {
    if (titles.length > 0 && titles[0] !== 'purpose') {
      issues.push({
        id: 'bulletin-purpose-first',
        severity: 'fail',
        rule: 'Bulletin Purpose paragraph must come first',
        citation: 'MCO 5215.1K (audit line 140)',
        detail: `First titled paragraph is "${titles[0]}".`,
      });
    }
    const ccIdx = titles.indexOf('cancellation contingency');
    if (ccIdx >= 0 && ccIdx !== titles.length - 1) {
      issues.push({
        id: 'bulletin-canc-contingency-last',
        severity: 'fail',
        rule: 'Cancellation Contingency must be the last paragraph',
        citation: 'MCO 5215.1K (audit line 140)',
        detail: `Found at position ${ccIdx + 1} of ${titles.length}.`,
      });
    }
  }
  return issues;
}

/**
 * P3.5 — bulletin cancellation date rules (MCO 5215.1K; audit:
 * bulletins self-cancel, "Canc frp: Mmm yyyy", last day of month,
 * 12-month hard ceiling from the bulletin date).
 */
/**
 * Timezone-safe parse for date inputs. `new Date('2027-01-31')` reads
 * date-only ISO strings as UTC MIDNIGHT, so every getDate() west of
 * Greenwich returns the previous day and month-end checks falsely
 * fail (found by Stephen's local test run, 2026-07-15). Date-only
 * strings parse into LOCAL calendar parts; anything else falls back
 * to the platform parser.
 */
function parseDateLocal(raw: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (dateOnly) {
    return new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  }
  return new Date(raw);
}

export function validateBulletinCancellation(
  formData: FormData,
): ValidationIssue[] {
  if (formData.documentType !== 'bulletin') return [];
  const issues: ValidationIssue[] = [];
  const raw = (formData as { cancellationDate?: string }).cancellationDate;
  if (!raw) {
    issues.push({
      id: 'bulletin-canc-missing',
      severity: 'fail',
      rule: 'Bulletins must carry a cancellation date',
      citation: 'MCO 5215.1K (bulletins self-cancel)',
      detail: 'Set the Canc/Canc frp date.',
    });
    return issues;
  }
  const canc = parseDateLocal(raw);
  if (isNaN(canc.getTime())) {
    issues.push({
      id: 'bulletin-canc-invalid',
      severity: 'fail',
      rule: 'Cancellation date is not a valid date',
      citation: 'MCO 5215.1K',
      detail: `Could not parse "${raw}".`,
    });
    return issues;
  }
  // Last day of its month (cancellation is expressed as Mmm yyyy and
  // takes effect at month end).
  const lastDay = new Date(canc.getFullYear(), canc.getMonth() + 1, 0).getDate();
  if (canc.getDate() !== lastDay) {
    issues.push({
      id: 'bulletin-canc-month-end',
      severity: 'fail',
      rule: 'Cancellation date must be the last day of the month',
      citation: 'MCO 5215.1K (Canc expressed as Mmm yyyy)',
      detail: `${raw} is not the last day of its month (${lastDay}).`,
    });
  }
  // 12-month hard ceiling from the bulletin's own date.
  const base = parseDateLocal(formData.date || '');
  if (!isNaN(base.getTime())) {
    const ceiling = new Date(base.getFullYear() + 1, base.getMonth(), base.getDate());
    if (canc.getTime() > ceiling.getTime()) {
      issues.push({
        id: 'bulletin-canc-ceiling',
        severity: 'fail',
        rule: 'Bulletins may not remain in effect longer than 12 months',
        citation: 'MCO 5215.1K (12-month ceiling)',
        detail: `Cancellation ${raw} exceeds 12 months from the bulletin date.`,
      });
    }
  }
  return issues;
}

/**
 * P4.4 — revision suffix rules (audit line 151; MCO 5215.1K /
 * SECNAV M-5215.1): revision suffixes skip I, O, Q for USMC
 * directives (I and O for SECNAV — both resemble numerals, Q
 * resembles O in Courier); a directive revised past Z gets a NEW
 * point number, never a two-letter suffix.
 */
const USMC_DIRECTIVE_TYPES_V = ['mco', 'bulletin', 'change-transmittal'];
const SECNAV_DIRECTIVE_TYPES_V: string[] = ['secnav-instruction', 'secnav-notice']; // P4.3

export function validateRevisionSuffix(formData: FormData): ValidationIssue[] {
  const t = formData.documentType;
  const isUsmc = USMC_DIRECTIVE_TYPES_V.includes(t);
  const isSecnav = SECNAV_DIRECTIVE_TYPES_V.includes(t);
  if (!isUsmc && !isSecnav) return [];
  const ssic = (formData.ssic || '').replace(/\s*w\/.*$/i, '').trim();
  if (!ssic) return [];
  // Suffix = letters trailing the point number ("5215.1K" -> K).
  const m = ssic.match(/\.(\d+)([A-Za-z]+)$/);
  if (!m) return [];
  const suffix = m[2].toUpperCase();
  const issues: ValidationIssue[] = [];
  if (suffix.length > 1) {
    issues.push({
      id: 'revision-suffix-past-z',
      severity: 'fail',
      rule: 'A directive revised past Z requires a new point number',
      citation: 'MCO 5215.1K (audit line 151)',
      detail: `Suffix "${suffix}" is not a single letter. Assign a new consecutive point number instead.`,
    });
    return issues;
  }
  const forbidden = isUsmc ? ['I', 'O', 'Q'] : ['I', 'O'];
  if (forbidden.includes(suffix)) {
    issues.push({
      id: `revision-suffix-${suffix.toLowerCase()}`,
      severity: 'fail',
      rule: `Revision suffix ${suffix} is skipped (${forbidden.join(', ')} are never used)`,
      citation: isUsmc ? 'MCO 5215.1K (audit line 151)' : 'SECNAV M-5215.1',
      detail: `"${ssic}" carries suffix ${suffix}. Use the next permitted letter.`,
    });
  }
  return issues;
}

/**
 * P4.3 — SECNAV directive paragraph-order rules (SECNAV M-5215.1;
 * audit line 83): Purpose first (revision states the purpose of the
 * series); Cancellation second when superseding (instructions);
 * Forms and Information Collections last — next-to-last on a notice
 * that carries a cancellation paragraph, which then stands last.
 * Missing-title checks are WARN (P3.5 precedent: reduced formats);
 * order violations are FAIL.
 */
export function validateSecnavSchema(
  formData: FormData,
  paragraphs: ParagraphData[],
): ValidationIssue[] {
  const t = formData.documentType;
  if (!SECNAV_DIRECTIVE_TYPES_V.includes(t)) return [];
  const issues: ValidationIssue[] = [];
  const titles = paragraphs
    .filter((p) => p.level <= 1 && p.title && p.title.trim())
    .map((p) => p.title!.trim().toLowerCase());

  if (titles.length > 0 && titles[0] !== 'purpose') {
    issues.push({
      id: 'secnav-purpose-first',
      severity: 'fail',
      rule: 'Purpose must be the first paragraph',
      citation: 'SECNAV M-5215.1 (audit line 83)',
      detail: `First titled paragraph is "${titles[0]}".`,
    });
  }
  if (!titles.includes('purpose')) {
    issues.push({
      id: 'secnav-missing-purpose',
      severity: 'warn',
      rule: 'SECNAV directives require a "Purpose" paragraph',
      citation: 'SECNAV M-5215.1 (audit line 83)',
      detail: 'Mandatory level-1 paragraph title not found.',
    });
  }

  const formsIdx = titles.indexOf('forms and information collections');
  const cancIdx = titles.indexOf('cancellation');

  if (formsIdx < 0) {
    issues.push({
      id: 'secnav-missing-forms',
      severity: 'warn',
      rule: 'SECNAV directives require a "Forms and Information Collections" paragraph',
      citation: 'SECNAV M-5215.1 (audit line 83)',
      detail: 'Mandatory level-1 paragraph title not found.',
    });
  }

  if (t === 'secnav-instruction') {
    if (cancIdx >= 0 && cancIdx !== 1) {
      issues.push({
        id: 'secnav-cancellation-position',
        severity: 'fail',
        rule: 'Cancellation must be the second paragraph when present',
        citation: 'SECNAV M-5215.1 (audit line 83)',
        detail: `Found at position ${cancIdx + 1}.`,
      });
    }
    if (formsIdx >= 0 && formsIdx !== titles.length - 1) {
      issues.push({
        id: 'secnav-forms-last',
        severity: 'fail',
        rule: 'Forms and Information Collections must be the last paragraph',
        citation: 'SECNAV M-5215.1 (audit line 83)',
        detail: `Found at position ${formsIdx + 1} of ${titles.length}.`,
      });
    }
  } else {
    // Notice: cancellation paragraph, when present, stands LAST and
    // pushes Forms to next-to-last.
    if (cancIdx >= 0) {
      if (cancIdx !== titles.length - 1) {
        issues.push({
          id: 'secnav-notice-cancellation-last',
          severity: 'fail',
          rule: 'A notice cancellation paragraph must be the last paragraph',
          citation: 'SECNAV M-5215.1 (audit line 83)',
          detail: `Found at position ${cancIdx + 1} of ${titles.length}.`,
        });
      }
      if (formsIdx >= 0 && formsIdx !== titles.length - 2) {
        issues.push({
          id: 'secnav-notice-forms-next-to-last',
          severity: 'fail',
          rule: 'Forms and Information Collections must be next-to-last when a cancellation paragraph is present',
          citation: 'SECNAV M-5215.1 (audit line 83)',
          detail: `Found at position ${formsIdx + 1} of ${titles.length}.`,
        });
      }
    } else if (formsIdx >= 0 && formsIdx !== titles.length - 1) {
      issues.push({
        id: 'secnav-forms-last',
        severity: 'fail',
        rule: 'Forms and Information Collections must be the last paragraph',
        citation: 'SECNAV M-5215.1 (audit line 83)',
        detail: `Found at position ${formsIdx + 1} of ${titles.length}.`,
      });
    }
    // Notices carry no consecutive point number (audit line 90).
    const ssic = (formData.ssic || '').replace(/\s*w\/.*$/i, '').trim();
    if (/\.\d/.test(ssic)) {
      issues.push({
        id: 'secnav-notice-no-point-number',
        severity: 'fail',
        rule: 'Notices carry no consecutive point number — cite by SSIC and date',
        citation: 'SECNAV M-5215.1 (audit line 90)',
        detail: `"${formData.ssic}" carries a point number.`,
      });
    }
  }
  return issues;
}

/**
 * P4.3 — notice cancellation date (SECNAV M-5215.1; audit line 86,
 * verbatim-verified 2026-06-10 via secnav.navy.mil search excerpt:
 * "indicated in the upper right margin of the first page, on the
 * second line above the identification symbols", always the last day
 * of a month; "self-canceling on the 1 year anniversary date unless
 * the Canc date is for a longer period" — so unlike MCBul there is
 * NO 12-month ceiling).
 */
export function validateSecnavNoticeCancellation(
  formData: FormData,
): ValidationIssue[] {
  if (formData.documentType !== 'secnav-notice') return [];
  const issues: ValidationIssue[] = [];
  const raw = (formData as { cancellationDate?: string }).cancellationDate;
  if (!raw) {
    issues.push({
      id: 'secnav-notice-canc-missing',
      severity: 'fail',
      rule: 'Notices must carry a Canc date',
      citation: 'SECNAV M-5215.1 (audit line 86)',
      detail: 'Set the cancellation date (upper right, 2nd line above the ID symbols).',
    });
    return issues;
  }
  const canc = parseDateLocal(raw);
  if (isNaN(canc.getTime())) {
    issues.push({
      id: 'secnav-notice-canc-invalid',
      severity: 'fail',
      rule: 'Cancellation date is not a valid date',
      citation: 'SECNAV M-5215.1',
      detail: `Could not parse "${raw}".`,
    });
    return issues;
  }
  const lastDay = new Date(canc.getFullYear(), canc.getMonth() + 1, 0).getDate();
  if (canc.getDate() !== lastDay) {
    issues.push({
      id: 'secnav-notice-canc-month-end',
      severity: 'fail',
      rule: 'Canc date must be the last day of the month',
      citation: 'SECNAV M-5215.1 (audit line 86)',
      detail: `${raw} is not the last day of its month (${lastDay}).`,
    });
  }
  return issues;
}

/**
 * P4.3 — references overflow (SECNAV M-5215.1; audit line 85:
 * "References overflow -> move to enclosure"). The manual states the
 * rule but no count; the page-1-fit trigger is layout-dependent. The
 * threshold below is an implementation heuristic — flagged for SME
 * confirmation at Gate 4 (same handling as the Ref/Via anomaly).
 */
const SECNAV_REFS_OVERFLOW_THRESHOLD = 8;
export function validateSecnavReferencesOverflow(
  formData: FormData,
  references: string[],
): ValidationIssue[] {
  if (!SECNAV_DIRECTIVE_TYPES_V.includes(formData.documentType)) return [];
  const refs = references.filter((r) => r && r.trim());
  if (refs.length <= SECNAV_REFS_OVERFLOW_THRESHOLD) return [];
  return [{
    id: 'secnav-refs-overflow',
    severity: 'warn',
    rule: 'Extensive references should move to an enclosure',
    citation: 'SECNAV M-5215.1 (audit line 85; threshold heuristic, SME ruling pending)',
    detail: `${refs.length} references listed; consider listing them in an enclosure.`,
  }];
}

/**
 * P4.3 — 5-page text cap (SECNAV M-5215.1; audit line 85: instruction
 * and notice text <=5 pages INCLUDING the signature block, EXCLUDING
 * enclosures; audit line 115: the paginator counts pre-export and the
 * verdict is shared — the PDF engine is the paginator, DOCX reuses
 * the result). Pure issue builder so the export gate and tests share
 * one definition; severity "block" refuses export (audit line 69).
 */
export const SECNAV_PAGE_CAP = 5;
export function secnavPageCapIssue(
  documentType: string,
  pageCount: number,
): ValidationIssue | null {
  if (!SECNAV_DIRECTIVE_TYPES_V.includes(documentType)) return null;
  if (pageCount <= SECNAV_PAGE_CAP) return null;
  return {
    id: 'secnav-page-cap',
    severity: 'block',
    rule: `SECNAV ${documentType === 'secnav-notice' ? 'notice' : 'instruction'} text may not exceed ${SECNAV_PAGE_CAP} pages`,
    citation: 'SECNAV M-5215.1 (audit lines 85, 115)',
    detail: `Document paginates to ${pageCount} pages including the signature block. Move content to an enclosure.`,
  };
}

/**
 * Endorsement continuation (M-5216.5 9-2.3 and 9-2.4). An endorsement
 * letters its added references and numbers its added enclosures by
 * "continuing the sequence" from the basic letter and previous
 * endorsements, so a second document in a package which still starts
 * at (a) and 1 repeats letters and numbers already in use.
 *
 * Both issues are warns rather than fails. A basic letter which listed
 * no references leaves its first endorsement legitimately starting at
 * (a), and the same holds for enclosure 1, so the starting values are
 * never wrong on their face. The package assembler sets them from the
 * running totals when the endorsement is filed in a package.
 */
export function validateEndorsementContinuation(
  formData: FormData,
  references: string[],
  enclosures: readonly string[] = [],
): ValidationIssue[] {
  if (formData.documentType !== 'endorsement') return [];
  const issues: ValidationIssue[] = [];

  const refCount = references.filter((r) => r.trim()).length;
  const startLetter = String(formData.startingReferenceLevel ?? '').trim();
  if (refCount > 0 && (startLetter === '' || startLetter.toLowerCase() === 'a')) {
    issues.push({
      id: 'endorsement-reference-continuation',
      severity: 'warn',
      rule: 'Endorsement references continue the basic letter lettering',
      citation: 'M-5216.5 9-2.3',
      detail: `This endorsement adds ${refCount} reference(s) starting at (a). Paragraph 9-2.3 assigns added references a letter by "continuing the sequence of letters from the basic letter and previous endorsements". Set the starting reference letter to the one after the last reference already in use, unless nothing before this endorsement listed a reference.`,
    });
  }

  const enclCount = enclosures.filter((e) => e.trim()).length;
  const startNumber = String(formData.startingEnclosureNumber ?? '').trim();
  if (enclCount > 0 && (startNumber === '' || startNumber === '1')) {
    issues.push({
      id: 'endorsement-enclosure-continuation',
      severity: 'warn',
      rule: 'Endorsement enclosures continue the basic letter numbering',
      citation: 'M-5216.5 9-2.4',
      detail: `This endorsement adds ${enclCount} enclosure(s) starting at 1. Paragraph 9-2.4 assigns added enclosures a number by "continuing the sequence of numbers from the basic letter and previous endorsements". Set the starting enclosure number to the one after the last enclosure already in use, unless nothing before this endorsement carried an enclosure.`,
    });
  }

  return issues;
}

/**
 * E.1 (M-5216.5 9-1). A same-page endorsement has no meaning on its
 * own: 9-1 decides its placement by whether it fits on the signature
 * page of the document it endorses, and that page is not present when
 * the endorsement is exported by itself. The single-document export
 * produces the block, which is the right file to hand a drafter who
 * will add it to a signed page, so this reports rather than refuses.
 */
export function validateSamePageEndorsementExport(formData: FormData): ValidationIssue[] {
  if (!isSamePageEndorsement(formData)) return [];
  return [{
    id: 'same-page-endorsement-alone',
    severity: 'warn',
    rule: 'Same-page placement is decided against the page below it',
    citation: 'M-5216.5 9-1',
    detail: 'Same-page placement is decided at package export against the basic letter; exported alone, this is the block only. Assemble the package to have the fit measured and the block placed.',
    field: 'endorsementPlacement',
  }];
}

/**
 * Subject-line rules (M-5216.5 7-2.9.a and 12-3.2.c(4), figure 7-1).
 *
 * Two rules the app had no check for at all. 7-2.9.a says "In
 * correspondence, do not use acronyms in the subject line", and
 * 12-3.2.c(4) repeats it for executive correspondence: an acronym is
 * allowed once spelled out "except in the subject line or title".
 * Figure 7-1 sets the shape of the line itself, "NORMAL WORD ORDER
 * WITH ALL LETTERS CAPITALIZED AND NO PUNCTUATION".
 *
 * The whole subject is upper case by format, so an all-caps token
 * proves nothing. A token is reported only when the military
 * dictionary carries it as an abbreviation, which is the same index
 * the first-use rule reads, and only at three letters or more: a
 * two-letter token in a capitalised subject is an ordinary word far
 * more often than an acronym. The dictionary arrives on demand
 * (B.5), so it comes in as an argument the way validateAcronyms takes
 * it, never as a static import.
 *
 * Both rules are warn severity. A drafter who means the acronym, or
 * whose command writes a subject with a slash in it, keeps the export.
 */
const SUBJECT_RULE_TYPES = new Set([
  'basic', 'multiple-address', 'endorsement',
  'from-to-memo', 'letterhead-memo', 'mfr',
  'executive-correspondence',
]);

/** Trailing punctuation figure 7-1 keeps off the subject line. */
const TERMINAL_PUNCTUATION = /[.,;:!?]+$/;

export function validateSubjectLine(
  formData: FormData,
  dictionary: readonly DictionaryEntry[] = [],
): ValidationIssue[] {
  if (!SUBJECT_RULE_TYPES.has(formData.documentType)) return [];
  const subject = String(formData.subj ?? '').trim();
  if (!subject) return [];

  const issues: ValidationIssue[] = [];

  // Acronyms. Dictionary membership is the gate, so a subject of
  // ordinary words in capitals reports nothing.
  const index = dictionary.length > 0 ? expansionIndexFor(dictionary) : null;
  if (index) {
    const found: string[] = [];
    for (const match of subject.matchAll(/\b[A-Z]{3,8}\b/g)) {
      const token = match[0];
      if (found.includes(token) || ACRONYM_STOPLIST.has(token)) continue;
      if (!index.has(token)) continue;
      found.push(token);
    }
    if (found.length > 0) {
      const readings = found
        .map((token) => {
          const expansions = index.get(token) ?? [];
          return expansions.length > 0 ? `${token} ("${expansions[0]}")` : token;
        })
        .join(', ');
      issues.push({
        id: 'subject-acronym',
        severity: 'warn',
        field: 'subj',
        rule: 'The subject line carries no acronyms',
        citation: 'SECNAV M-5216.5 7-2.9.a and 12-3.2.c(4)',
        detail:
          `The subject line uses ${readings}. Write the words out here and use the acronym in the paragraphs below.`,
      });
    }
  }

  // Terminal punctuation.
  const trailing = subject.match(TERMINAL_PUNCTUATION);
  if (trailing) {
    issues.push({
      id: 'subject-terminal-punctuation',
      severity: 'warn',
      field: 'subj',
      rule: 'The subject line ends without punctuation',
      citation: 'SECNAV M-5216.5 7-2.9.a, Fig 7-1',
      detail:
        `The subject line ends with "${trailing[0]}". Figure 7-1 writes it in normal word order, capitalised, with no punctuation.`,
    });
  }

  return issues;
}

/**
 * Enclosure order (M-5216.5 7-2.11.a): "List enclosures in the
 * enclosure line in the order they appear in the text." The reference
 * line carries the same rule at 7-2.10.a and has been checked three
 * ways since Phase 2. The enclosure line had only a count cross-check
 * in the proofread panel, so a letter which cites enclosure (2) before
 * enclosure (1) passed every check the app ran.
 *
 * Numbering starts wherever the document starts it, so an endorsement
 * continuing the basic letter's sequence at (3) is read against (3)
 * and (4) rather than against (1) and (2) (9-2.4).
 *
 * Same severity as the reference-order rule it mirrors: fail. The
 * order is not a matter of judgment once the citations are in the text.
 */
export function validateEnclosureOrder(
  formData: FormData,
  enclosures: readonly string[],
  paragraphs: ParagraphData[],
): ValidationIssue[] {
  const encls = enclosures.filter((e) => e.trim());
  if (encls.length < 2) return [];

  const start = startingEnclosureNumberFor(formData.documentType, formData.startingEnclosureNumber);
  const listed = encls.map((_, i) => String(start + i));

  const allText = paragraphs.map((p) => `${p.title ?? ''} ${p.content}`).join(' ');

  // Mirrors the reference clause matcher: separators are required
  // tokens inside the starred group, so whitespace has one parse and
  // the pattern cannot backtrack polynomially on imported text.
  const enclClause = /\bencls?(?:osures?)?\s*((?:\(\d+\)(?:\s*(?:,|and|through|thru))*\s*)+)/gi;
  const cited: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = enclClause.exec(allText)) !== null) {
    for (const n of m[1].matchAll(/\((\d+)\)/g)) {
      if (!cited.includes(n[1])) cited.push(n[1]);
    }
  }

  const firstCitationOrder = cited.filter((n) => listed.includes(n));
  const expected = listed.filter((n) => firstCitationOrder.includes(n));
  const mismatch = firstCitationOrder.findIndex((n, i) => n !== expected[i]);
  if (mismatch === -1) return [];

  return [{
    id: 'encl-citation-order',
    severity: 'fail',
    rule: 'Enclosures are listed in the order they are first cited in the text',
    citation: 'SECNAV M-5216.5 7-2.11.a',
    detail:
      `First-citation order is (${firstCitationOrder.join('), (')}), so enclosure (${firstCitationOrder[mismatch]}) ` +
      `is cited before enclosure (${expected[mismatch]}). Reorder the enclosure list to match the text.`,
  }];
}

export interface LetterValidatorOptions {
  /**
   * The military dictionary, when the caller has loaded it. Optional:
   * it only enriches acronym warnings with a suggested expansion. The
   * table is loaded on demand (B.5) so the validators never import it.
   */
  dictionary?: readonly DictionaryEntry[];
  /**
   * The enclosure lines, when the caller holds them. Only the
   * endorsement continuation rule (9-2.4) reads them, so a caller with
   * no enclosures in scope leaves the rule inert rather than wrong.
   */
  enclosures?: readonly string[];
}

export function runLetterValidators(
  formData: FormData,
  vias: string[],
  references: string[],
  paragraphs: ParagraphData[],
  options: LetterValidatorOptions = {},
): ValidationIssue[] {
  // Only an endorsement continues another document's reference
  // sequence (9-2.3), which is the scoping rule the PDF already
  // applies. Every other type reads against (a) whatever a saved draft
  // carries in the field.
  const startRefLetter = startingRefLetterFor(
    formData.documentType,
    formData.startingReferenceLevel,
  );
  return [
    ...validateReferences(references, paragraphs, startRefLetter),
    ...validateEndorsementContinuation(formData, references, options.enclosures),
    ...validateParagraphStructure(paragraphs),
    ...validateWindowEnvelope(formData, vias),
    ...validateActionAddressees(formData),
    ...validateDateSlots(formData, paragraphs),
    ...validateDirectiveTypography(formData, paragraphs),
    ...validateDirectiveSchema(formData, paragraphs),
    ...validateBulletinCancellation(formData),
    ...validateSecnavSchema(formData, paragraphs),
    ...validateSecnavNoticeCancellation(formData),
    ...validateSecnavReferencesOverflow(formData, references),
    ...validateRevisionSuffix(formData),
    ...validateClassification(formData, paragraphs),
    ...validateSignature(formData),
    ...validateAcronyms(paragraphs, options.dictionary),
    ...validateSubjectLine(formData, options.dictionary),
    ...validateEnclosureOrder(formData, options.enclosures ?? [], paragraphs),
    ...validateSamePageEndorsementExport(formData),
    // NAVMC 10922 dependency-application rules - no-op for every other
    // documentType (docs/NAVMC_10922_SPEC.md section 9).
    ...runNavmc10922Validators(formData),
    // NAVMC 10132 unit punishment book rules - likewise a no-op for every
    // other documentType (docs/NAVMC_10132_SPEC.md section 6).
    ...runNavmc10132Validators(formData),
    // Salutation presence, then the generic schema pass. Order matters
    // only for reading: the cited rule precedes the schema echo, and
    // the schema pass suppresses the salutation path to avoid a
    // duplicate.
    ...validateSalutation(formData),
    ...validateCivilianReferences(formData, references),
    ...validateRetiredFouo(formData),
    ...validateSchemaFields(formData),
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
