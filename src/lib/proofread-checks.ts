/**
 * Proofreading Checklist Engine
 * Per SECNAV M-5216.5, Ch 2, Para 19
 *
 * Runs automated checks against form data and paragraphs,
 * and defines manual confirmation items for the user.
 */

import { FormData, ParagraphData } from '@/types';
import { runLetterValidators } from './letter-validators';

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
 * Run all proofreading checks against current document state.
 */
export function runProofreadChecks(
  formData: FormData,
  paragraphs: ParagraphData[],
  enclosures: string[],
  references: string[],
  spellIssueCount?: number,
): ProofreadCheck[] {
  const checks: ProofreadCheck[] = [];
  const docType = formData.documentType;

  // Phase 2 conditional-logic validators (letter-validators.ts).
  // Severity map: block/fail -> fail, warn -> warn. Vias are not in
  // this signature; window-envelope via blocking runs at the export
  // gate (getExportBlockers), which does receive them.
  for (const issue of runLetterValidators(formData, [], references, paragraphs)) {
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
  const isForm = ['page11', 'aa-form', 'navmc10922', 'coordination-page', 'decision-paper'].includes(docType);
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

  // b.(2) Margins — always auto-pass
  checks.push({
    id: 'margins',
    category: 'framework',
    reference: 'b.(2)',
    label: 'Margins are 1 inch',
    description: 'Are the margins 1 inch?',
    status: 'pass',
    detail: 'Margins are controlled by the PDF generator (1" all sides).',
    isAutomatic: true,
  });

  // b.(3) Page numbers
  checks.push({
    id: 'page-numbers',
    category: 'framework',
    reference: 'b.(3)',
    label: 'Page numbers centered',
    description: 'Are page numbers centered 1/2 inch from the bottom?',
    status: 'pass',
    detail: 'Page numbering is auto-generated and positioned correctly.',
    isAutomatic: true,
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

  // b.(5) Paragraph alignment — auto-pass
  if (!isForm) {
    checks.push({
      id: 'paragraph-alignment',
      category: 'framework',
      reference: 'b.(5)',
      label: 'Paragraphs aligned properly',
      description: 'Are paragraphs aligned/indented properly?',
      status: 'pass',
      detail: 'Paragraph indentation is controlled by the formatter.',
      isAutomatic: true,
    });
  }

  // b.(6) Paragraph numbering — auto-pass
  if (!isForm) {
    checks.push({
      id: 'paragraph-numbering',
      category: 'framework',
      reference: 'b.(6)',
      label: 'Paragraphs sequentially numbered',
      description: 'Are paragraphs sequentially numbered/lettered?',
      status: 'pass',
      detail: 'Citation numbering (1., a., (1), etc.) is auto-generated.',
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
    let enclDetail = '';

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

  // b.(10) Header margin — auto-pass
  checks.push({
    id: 'header-margin',
    category: 'framework',
    reference: 'b.(10)',
    label: 'Header margin 1 inch',
    description: 'Is the header margin 1 inch from the top of the page?',
    status: 'pass',
    detail: 'Header margins are controlled by the PDF generator.',
    isAutomatic: true,
  });

  // b.(11) Footer margin — auto-pass
  checks.push({
    id: 'footer-margin',
    category: 'framework',
    reference: 'b.(11)',
    label: 'Footer margin 1/2 inch',
    description: 'Is the footer margin 1/2 inch from the bottom of the page?',
    status: 'pass',
    detail: 'Footer margins are controlled by the PDF generator.',
    isAutomatic: true,
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
