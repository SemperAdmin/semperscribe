/**
 * Proofreading Checklist Engine
 * Per SECNAV M-5216.5, Ch 2, Para 19
 *
 * Runs automated checks against form data and paragraphs,
 * and defines manual confirmation items for the user.
 */

import { FormData, ParagraphData } from '@/types';
import { runLetterValidators } from './letter-validators';
import { PDF_MARGINS } from './pdf-settings';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'manual' | 'info';
export type CheckCategory = 'format' | 'framework' | 'typography' | 'content';

export interface ProofreadCheck {
  id: string;
  category: CheckCategory;
  reference: string;        // e.g. "b.(2)"
  label: string;
  description: string;
  status: CheckStatus;
  detail?: string;          // Explanation of pass/fail
  isAutomatic: boolean;     // true = checked by code; false = user must confirm
}


/**
 * Short Letter mode widens the side margins to 2 inches, matching the
 * allowance at M-5216.5 12-4.2.b for a memorandum of fewer than 11
 * lines. The value mirrors the one NavalLetterPDF applies to the page.
 */
const SHORT_LETTER_SIDE_MARGIN_PT = 144;

/** A point measurement written the way the checklist asks about it. */
function inches(points: number): string {
  const value = points / 72;
  const rounded = Math.round(value * 100) / 100;
  return `${rounded} inch${rounded === 1 ? '' : 'es'} (${points} pt)`;
}

/**
 * The paragraph ladder behind check b.(6). A document opens at level 1
 * and never drops more than one level at a time, so a level 3 directly
 * under a level 1 has no parent to letter against.
 */
function checkParagraphLadder(
  paragraphs: ParagraphData[],
): { problem: boolean; detail: string } {
  const used = paragraphs.filter((p) => p.content.trim() || p.title);
  if (used.length === 0) {
    return { problem: false, detail: 'No paragraphs to number yet.' };
  }
  if (used[0].level !== 1) {
    return {
      problem: true,
      detail: `The first paragraph is at level ${used[0].level}. A letter opens at level 1, which the app numbers "1.".`,
    };
  }
  for (let i = 1; i < used.length; i++) {
    if (used[i].level > used[i - 1].level + 1) {
      return {
        problem: true,
        detail:
          `Paragraph ${used[i].id} jumps from level ${used[i - 1].level} to level ${used[i].level}. `
          + 'A subparagraph sits one level under the paragraph above it (figure 7-8).',
      };
    }
  }
  return {
    problem: false,
    detail:
      `${used.length} paragraph(s) form an unbroken ladder from level 1, and the designators `
      + '(1., a., (1)) are generated from those levels. Indentation is item b.(5).',
  };
}

/**
 * Run all proofreading checks against current document state.
 */
export function runProofreadChecks(
  formData: FormData,
  paragraphs: ParagraphData[],
  enclosures: string[],
  references: string[],
  vias: string[] = [],
  spellIssueCount?: number,
): ProofreadCheck[] {
  const checks: ProofreadCheck[] = [];
  const docType = formData.documentType;

  // Phase 2 conditional-logic validators (letter-validators.ts).
  // Severity map: block/fail -> fail, warn -> warn. The vias come from
  // the panel's caller: passing [] here left every via-dependent rule
  // silently inert in this surface, so a window-envelope letter with a
  // Via addressee proofread clean and then refused at the export gate.
  for (const issue of runLetterValidators(formData, vias, references, paragraphs, { enclosures })) {
    checks.push({
      id: issue.id,
      category: 'framework',
      reference: issue.citation,
      label: issue.rule,
      description: issue.rule,
      status: issue.severity === 'warn' ? 'warn' : 'fail',
      detail: issue.detail,
      isAutomatic: true,
    });
  }

  // Skip checks entirely for non-letter types
  const isForm = ['page11', 'aa-form', 'navmc10922', 'navmc10132', 'coordination-page', 'decision-paper'].includes(docType);
  const isAmhs = docType === 'amhs';
  const isDLAType = docType?.startsWith('dla-') || false;

  // ─── a. Format Check (auto-pass: controlled by generators) ───────────

  checks.push({
    id: 'format-first',
    category: 'format',
    reference: 'a.',
    label: 'Check format before substance',
    description: 'Verify formatting is correct before reading for content.',
    status: 'info',
    detail: 'Review the items below before reading for substance.',
    isAutomatic: true,
  });

  // ─── b. Framework Checks ─────────────────────────────────────────────

  // b.(1) Letterhead
  if (!isForm && !isAmhs) {
    const hasLetterhead = !!(formData.line1 || formData.headerType);
    const noLetterheadTypes = ['from-to-memo', 'mfr', 'position-paper', 'information-paper'];
    const needsLetterhead = !noLetterheadTypes.includes(docType);

    checks.push({
      id: 'letterhead',
      category: 'framework',
      reference: 'b.(1)',
      label: 'Letterhead correct',
      description: 'Is letterhead correct and straight?',
      status: needsLetterhead
        ? (hasLetterhead ? 'pass' : 'warn')
        : 'pass',
      detail: needsLetterhead
        ? (hasLetterhead ? 'Letterhead is configured.' : 'No letterhead unit information set. Verify this is intentional.')
        : 'This document type does not use letterhead.',
      isAutomatic: true,
    });
  }

  // b.(2) Margins: measured from the generator's own constants.
  //
  // This check used to read `status: 'pass'` with the detail "Margins
  // are controlled by the PDF generator (1\" all sides)", which was
  // false in two directions: the top margin is 44 pt (0.61 in) by the
  // recorded 2026-06-10 ruling in pdf-settings.ts, and Short Letter
  // mode widens the sides to 2 inches. The figures below are the ones
  // the generator uses, so the drafter reads the real page.
  const sideMarginPt = formData.isShortLetter ? SHORT_LETTER_SIDE_MARGIN_PT : PDF_MARGINS.left;
  checks.push({
    id: 'margins',
    category: 'framework',
    reference: 'b.(2)',
    label: 'Margins',
    description: 'Are the margins 1 inch?',
    status: 'info',
    detail:
      `Measured from the generator: top ${inches(PDF_MARGINS.top)}, bottom ${inches(PDF_MARGINS.bottom)}, `
      + `left and right ${inches(sideMarginPt)}. `
      + (formData.isShortLetter
          ? 'Short Letter mode widens the side margins to 2 inches, which is the allowance at 12-4.2.b for a memorandum of fewer than 11 lines. '
          : '')
      + '7-2.1 asks for 1 inch on every side. The top departs by a recorded 2026-06-10 ruling, '
      + 'which sets it so the letterhead lands where Word puts it.',
    isAutomatic: true,
  });

  // b.(3) Page numbers: not checked automatically.
  //
  // The footer geometry lives in the PDF component, not in the inputs
  // this module receives, and the page count is unknown until the
  // document renders. The old hardcoded pass asserted both.
  checks.push({
    id: 'page-numbers',
    category: 'framework',
    reference: 'b.(3)',
    label: 'Page numbers centered',
    description: 'Are page numbers centered 1/2 inch from the bottom?',
    status: 'manual',
    detail:
      'Not checked automatically. On the preview, confirm the second and later pages carry a centred number '
      + 'about half an inch above the bottom edge, and page 1 carries none (7-2.17).',
    isAutomatic: false,
  });

  // b.(4) Date
  if (!isForm && !isAmhs) {
    const hasDate = !!(formData.date && formData.date.trim());
    const dateOmitted = formData.omitDate === true; // exec corr may omit

    checks.push({
      id: 'date',
      category: 'framework',
      reference: 'b.(4)',
      label: 'Date field',
      description: 'Is there enough/too much room for the date?',
      status: dateOmitted ? 'pass' : (hasDate ? 'pass' : 'warn'),
      detail: dateOmitted
        ? 'Date intentionally omitted (added after signing).'
        : (hasDate ? `Date set: ${formData.date}` : 'No date entered. Verify this is intentional.'),
      isAutomatic: true,
    });
  }

  // b.(5) Paragraph alignment: not checked automatically.
  //
  // Indent positions are measured at render time by the relative
  // indent engine against the chosen font, so nothing in this module
  // sees where a designator lands on the page.
  if (!isForm) {
    checks.push({
      id: 'paragraph-alignment',
      category: 'framework',
      reference: 'b.(5)',
      label: 'Paragraphs aligned properly',
      description: 'Are paragraphs aligned/indented properly?',
      status: 'manual',
      detail:
        'Not checked automatically. Against figure 7-8, each designator sits under the first letter of the '
        + 'parent\'s text and a runover line returns to the left margin.',
      isAutomatic: false,
    });
  }

  // b.(6) Paragraph numbering: measured from the paragraph levels.
  //
  // The designators themselves are generated, so the question worth
  // asking is whether the LADDER is sound: a document which opens at a
  // subparagraph level, or which drops two levels at once, gets
  // designators the manual has no reading for.
  if (!isForm) {
    const ladder = checkParagraphLadder(paragraphs);
    checks.push({
      id: 'paragraph-numbering',
      category: 'framework',
      reference: 'b.(6)',
      label: 'Paragraphs sequentially numbered',
      description: 'Are paragraphs sequentially numbered/lettered?',
      status: ladder.problem ? 'warn' : 'pass',
      detail: ladder.detail,
      isAutomatic: true,
    });
  }

  // b.(7) Enclosure markings
  if (!isForm && !isAmhs) {
    const enclsWithContent = enclosures.filter(e => e.trim());
    const allText = paragraphs.map(p => p.content).join(' ').toLowerCase();

    // Look for enclosure references in paragraph text
    const enclRefPattern = /\(encl(?:osure)?\s*\(?(\d+)\)?/gi;
    const referencedEncls = new Set<number>();
    let match;
    while ((match = enclRefPattern.exec(allText)) !== null) {
      referencedEncls.add(parseInt(match[1], 10));
    }

    let enclStatus: CheckStatus = 'pass';
    // Assigned in every branch below (the chain ends in a plain else).
    let enclDetail: string;

    if (enclsWithContent.length === 0 && referencedEncls.size > 0) {
      enclStatus = 'fail';
      enclDetail = `Paragraph text references enclosure(s) but no enclosures are listed.`;
    } else if (enclsWithContent.length > 0 && referencedEncls.size === 0) {
      enclStatus = 'warn';
      enclDetail = `${enclsWithContent.length} enclosure(s) listed but none referenced in paragraph text. Verify this is correct.`;
    } else if (referencedEncls.size > enclsWithContent.length) {
      enclStatus = 'fail';
      enclDetail = `Text references enclosure ${Math.max(...referencedEncls)} but only ${enclsWithContent.length} enclosure(s) listed.`;
    } else if (enclsWithContent.length === 0 && referencedEncls.size === 0) {
      enclDetail = 'No enclosures listed or referenced.';
    } else {
      enclDetail = `${enclsWithContent.length} enclosure(s) listed, references found in text.`;
    }

    checks.push({
      id: 'enclosure-markings',
      category: 'framework',
      reference: 'b.(7)',
      label: 'Enclosure markings correct',
      description: 'Are enclosure markings correct?',
      status: enclStatus,
      detail: enclDetail,
      isAutomatic: true,
    });
  }

  // b.(8) Hyphenation — manual check
  if (!isForm) {
    checks.push({
      id: 'hyphenation',
      category: 'framework',
      reference: 'b.(8)',
      label: 'No excessive hyphenation',
      description: 'Are more than three lines hyphenated? Are successive lines hyphenated?',
      status: 'manual',
      detail: 'Review the preview for excessive line-end hyphenation.',
      isAutomatic: false,
    });
  }

  // b.(9) Signature room
  if (!isForm && !isAmhs) {
    const noSigTypes = ['mfr'];
    const needsSig = !noSigTypes.includes(docType) && !formData.omitSignatureBlock;
    // DLA types use signerFullName instead of sig
    const hasSig = isDLAType
      ? !!(formData.signerFullName && formData.signerFullName.trim())
      : !!(formData.sig && formData.sig.trim());
    const sigDisplay = isDLAType ? formData.signerFullName : formData.sig;

    checks.push({
      id: 'signature',
      category: 'framework',
      reference: 'b.(9)',
      label: 'Signature block present',
      description: 'Is there enough room for the signature line?',
      status: needsSig
        ? (hasSig ? 'pass' : 'warn')
        : 'pass',
      detail: needsSig
        ? (hasSig ? `Signature: ${sigDisplay}` : 'No signature name entered.')
        : (formData.omitSignatureBlock ? 'Signature block intentionally omitted.' : 'This document type does not require a signature block.'),
      isAutomatic: true,
    });
  }

  // b.(10) Header margin: the same measured figure as b.(2).
  checks.push({
    id: 'header-margin',
    category: 'framework',
    reference: 'b.(10)',
    label: 'Header margin',
    description: 'Is the header margin 1 inch from the top of the page?',
    status: 'info',
    detail:
      `Measured from the generator: ${inches(PDF_MARGINS.top)} to the first line of the letterhead, `
      + 'against the 1 inch at 7-2.1. The difference is the recorded 2026-06-10 ruling.',
    isAutomatic: true,
  });

  // b.(11) Footer margin: not checked automatically.
  checks.push({
    id: 'footer-margin',
    category: 'framework',
    reference: 'b.(11)',
    label: 'Footer margin 1/2 inch',
    description: 'Is the footer margin 1/2 inch from the bottom of the page?',
    status: 'manual',
    detail:
      'Not checked automatically. The footer position is set in the PDF component rather than in the values '
      + 'this checklist reads. Confirm the spacing on the preview.',
    isAutomatic: false,
  });

  // ─── c. Typography / Grammar ─────────────────────────────────────────

  // c.(1) Read slowly
  checks.push({
    id: 'read-slowly',
    category: 'typography',
    reference: 'c.(1)',
    label: 'Read slowly for errors',
    description: 'Read slowly. Look at each word separately.',
    status: 'manual',
    detail: 'Carefully review each paragraph for typographical errors.',
    isAutomatic: false,
  });

  // c.(2) Hyphenated words
  if (!isForm) {
    const allText = paragraphs.map(p => p.content).join(' ');
    const hyphenatedWords = allText.match(/\b\w+-\w+\b/g) || [];
    const uniqueHyphenated = [...new Set(hyphenatedWords)];

    checks.push({
      id: 'hyphenated-words',
      category: 'typography',
      reference: 'c.(2)',
      label: 'Verify hyphenated words',
      description: 'Look up all hyphenated words you are not sure of.',
      status: uniqueHyphenated.length > 0 ? 'manual' : 'pass',
      detail: uniqueHyphenated.length > 0
        ? `Found ${uniqueHyphenated.length} hyphenated term(s): ${uniqueHyphenated.slice(0, 5).join(', ')}${uniqueHyphenated.length > 5 ? '...' : ''}`
        : 'No hyphenated words found in paragraph text.',
      isAutomatic: uniqueHyphenated.length === 0,
    });
  }

  // c.(3) Spell check
  checks.push({
    id: 'spell-check',
    category: 'typography',
    reference: 'c.(3)',
    label: 'Spell check and grammar check',
    description: 'Use spell check as an additional tool, never solely depend on it.',
    status: spellIssueCount !== undefined
      ? (spellIssueCount === 0 ? 'pass' : 'warn')
      : 'manual',
    detail: spellIssueCount !== undefined
      ? (spellIssueCount === 0
          ? 'No spelling issues detected by the military spell checker.'
          : `${spellIssueCount} potential spelling issue(s) flagged. Review in the paragraph editor.`)
      : 'Run the military spell checker in the paragraph editor.',
    isAutomatic: spellIssueCount !== undefined,
  });

  // Subject line case check
  if (!isForm && !isAmhs && formData.subj) {
    const isDLAMemo = docType === 'dla-memorandum';
    const isCivilianStyleNonDLA = ['business-letter', 'executive-correspondence'].includes(docType);

    if (isDLAMemo) {
      // DLA Memo: Title Case per DLA Corr Manual Ch.3 Para 8
      // "Capitalize first letter of each word except articles, prepositions, and conjunctions"
      const hasUpperStart = /^[A-Z]/.test(formData.subj);
      checks.push({
        id: 'subject-caps',
        category: 'typography',
        reference: 'c.',
        label: 'Subject line in Title Case',
        description: 'DLA memorandums use Title Case for subject (capitalize first letter of each word except articles, prepositions, conjunctions).',
        status: hasUpperStart ? 'pass' : 'warn',
        detail: hasUpperStart ? 'Subject appears to use Title Case.' : 'Subject should start with a capital letter (Title Case).',
        isAutomatic: true,
      });
    } else if (!isCivilianStyleNonDLA || isDLAType) {
      // Standard naval correspondence & DLA business letter: ALL CAPS
      const isAllCaps = formData.subj === formData.subj.toUpperCase();
      checks.push({
        id: 'subject-caps',
        category: 'typography',
        reference: 'c.',
        label: 'Subject line in ALL CAPS',
        description: 'Standard naval correspondence requires subject in ALL CAPS.',
        status: isAllCaps ? 'pass' : 'fail',
        detail: isAllCaps ? 'Subject is in ALL CAPS.' : 'Subject line contains lowercase letters.',
        isAutomatic: true,
      });
    }
  }

  // SSIC format check (DLA types don't use SSIC)
  if (!isForm && !isAmhs && !isDLAType && formData.ssic) {
    const ssicValid = /^\d{4,5}$/.test(formData.ssic);
    checks.push({
      id: 'ssic-format',
      category: 'typography',
      reference: 'c.',
      label: 'SSIC format valid',
      description: 'SSIC must be 4-5 digits.',
      status: ssicValid ? 'pass' : 'fail',
      detail: ssicValid ? `SSIC: ${formData.ssic}` : `SSIC "${formData.ssic}" is not a valid 4-5 digit code.`,
      isAutomatic: true,
    });
  }

  // Reference cross-check
  if (!isForm && !isAmhs) {
    const refsWithContent = references.filter(r => r.trim());
    const allText = paragraphs.map(p => p.content).join(' ').toLowerCase();
    const refPattern = /\bref(?:erence)?\s*\(?([a-z])\)?/gi;
    const referencedRefs = new Set<string>();
    let refMatch;
    while ((refMatch = refPattern.exec(allText)) !== null) {
      referencedRefs.add(refMatch[1].toLowerCase());
    }

    if (refsWithContent.length > 0 && referencedRefs.size === 0) {
      checks.push({
        id: 'reference-cross-check',
        category: 'typography',
        reference: 'c.',
        label: 'References cited in text',
        description: 'Listed references should be cited in paragraph text.',
        status: 'warn',
        detail: `${refsWithContent.length} reference(s) listed but no "ref (a)" citations found in text. Verify references are properly cited.`,
        isAutomatic: true,
      });
    }
  }

  // ─── d. Content ──────────────────────────────────────────────────────

  checks.push({
    id: 'content-review',
    category: 'content',
    reference: 'd.',
    label: 'Read for content',
    description: 'Lastly, read for content. Ensure the substance is accurate and complete.',
    status: 'manual',
    detail: 'Review the entire document for accuracy, completeness, and clarity.',
    isAutomatic: false,
  });

  // Empty paragraph check
  if (!isForm) {
    const emptyParas = paragraphs.filter(p => !p.content?.trim() && !p.title);
    if (emptyParas.length > 0) {
      checks.push({
        id: 'empty-paragraphs',
        category: 'content',
        reference: 'd.',
        label: 'No empty paragraphs',
        description: 'All paragraphs should have content.',
        status: 'warn',
        detail: `${emptyParas.length} empty paragraph(s) found. Remove or fill them before finalizing.`,
        isAutomatic: true,
      });
    }
  }

  return checks;
}

/**
 * Get summary counts for the proofreading results.
 */
export function getProofreadSummary(checks: ProofreadCheck[]) {
  return {
    total: checks.length,
    pass: checks.filter(c => c.status === 'pass' || c.status === 'info').length,
    fail: checks.filter(c => c.status === 'fail').length,
    warn: checks.filter(c => c.status === 'warn').length,
    manual: checks.filter(c => c.status === 'manual').length,
  };
}
