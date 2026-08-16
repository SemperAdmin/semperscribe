import { Confidence, ExtractedText } from './extractionTypes';

/**
 * Heuristic document-type detection for the Word/PDF import pipeline.
 *
 * Scans the first ~30 lines of extracted text for the headings and anchors
 * that distinguish the standard-letter family (basic letter, MFR,
 * letterhead memo, from-to memo) and the civilian business letter, which
 * is identified by its salutation. Types the importer does not support yet
 * (endorsements, directives, bulletins, NAVMC forms, AMHS messages) are
 * still recognized so the user gets a clear "importing as Basic Letter"
 * warning instead of a silent misclassification.
 *
 * The review modal lets the user override the result, which re-runs
 * parseCorrespondence with the chosen type.
 */

export interface DocTypeDetection {
  /** A DOCUMENT_TYPES registry id — always one the importer supports. */
  documentType: string;
  confidence: Confidence;
  warnings: string[];
}

/** How many leading lines carry the type-identifying headings. */
const SCAN_WINDOW = 30;

const SERVICE_LINE_RE = /(UNITED STATES MARINE CORPS|DEPARTMENT OF THE NAVY|UNITED STATES NAVY)/i;
const MFR_RE = /^MEMORANDUM\s+FOR\s+THE\s+RECORD\b/i;
const MEMO_FOR_RE = /^MEMORANDUM\s+FOR\b/i;
const MEMO_RE = /^MEMORANDUM\b/i;
const FROM_RE = /^from\s*[:.]/i;
const TO_RE = /^to\s*[:.]/i;
const SUBJ_RE = /^subj(?:ect)?\s*[:.]/i;
/**
 * Civilian salutation, the one anchor unique to the business-letter
 * family (SECNAV M-5216.5 Fig 11-1). "Dear Mr. Smith:", "Dear Sir or
 * Madam:", "To Whom It May Concern:". Bounded length keeps a body
 * sentence beginning with "Dear" from matching.
 */
const SALUTATION_RE = /^(dear\s+[A-Za-z][A-Za-z.'’\- ]{0,58}|to whom it may concern)\s*[:,]$/i;
/** Civilian date, "August 14, 2026" - business letters never use 14 Aug 26. */
const CIVILIAN_DATE_RE = /^[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}$/;

/** Recognized-but-unsupported headings, with a label for the warning. */
const UNSUPPORTED_SIGNALS: { re: RegExp; label: string }[] = [
  { re: /^(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH)\s+ENDORSEMENT\b/i, label: 'an endorsement' },
  { re: /^MARINE CORPS ORDER\b|^MCO\s+\d/i, label: 'a Marine Corps Order' },
  { re: /^MCBUL\b|^MARINE CORPS BULLETIN\b/i, label: 'a Marine Corps Bulletin' },
  { re: /^NAVMC\b/i, label: 'a NAVMC form' },
  // AMHS/naval message date-time group, e.g. "161200Z FEB 26"
  { re: /^\d{6}Z\s+[A-Z]{3}\s+\d{2,4}\b/i, label: 'a naval message (AMHS)' },
];

export function detectDocumentType(text: ExtractedText): DocTypeDetection {
  const window = text.lines.slice(0, SCAN_WINDOW).map(l => l.trim());
  const hasLetterhead = window.some(l => SERVICE_LINE_RE.test(l));
  const hasFrom = window.some(l => FROM_RE.test(l));
  const hasTo = window.some(l => TO_RE.test(l));
  const hasSubj = window.some(l => SUBJ_RE.test(l));
  const hasSalutation = window.some(l => SALUTATION_RE.test(l));
  const hasCivilianDate = window.some(l => CIVILIAN_DATE_RE.test(l));

  // Heading-based signals first: they are more specific than the From/To/Subj
  // anchors, which unsupported types (e.g. endorsements) also contain.
  for (const line of window) {
    if (!line) continue;

    if (MFR_RE.test(line)) {
      return { documentType: 'mfr', confidence: 'high', warnings: [] };
    }

    const unsupported = UNSUPPORTED_SIGNALS.find(sig => sig.re.test(line));
    if (unsupported) {
      return {
        documentType: 'basic',
        confidence: 'low',
        warnings: [
          `This looks like ${unsupported.label}, which is not yet supported for import; importing as a Basic Letter.`,
        ],
      };
    }

    if (MEMO_FOR_RE.test(line)) {
      return { documentType: 'letterhead-memo', confidence: 'high', warnings: [] };
    }
    if (MEMO_RE.test(line)) {
      if (hasLetterhead) {
        return { documentType: 'letterhead-memo', confidence: 'high', warnings: [] };
      }
      if (hasFrom && hasTo) {
        return { documentType: 'from-to-memo', confidence: 'high', warnings: [] };
      }
      return { documentType: 'letterhead-memo', confidence: 'low', warnings: [] };
    }
  }

  // Business letter. The salutation is decisive, and its absence from the
  // naval standard letter is what makes it safe: a From/To letter never
  // carries one. Checked after the heading loop so a MEMORANDUM or an
  // unsupported heading still wins.
  if (hasSalutation && !hasFrom && !hasTo) {
    return { documentType: 'business-letter', confidence: 'high', warnings: [] };
  }
  if (hasSalutation) {
    // Both a salutation and From/To: contradictory. The naval anchors are
    // structural, the salutation is one line, so the naval read wins with
    // the conflict surfaced.
    return {
      documentType: 'basic',
      confidence: 'low',
      warnings: ['This document has both a salutation and From/To lines; importing as a Basic Letter. Switch to Business Letter if the salutation is correct.'],
    };
  }
  if (hasCivilianDate && hasSubj && !hasFrom && !hasTo) {
    // Civilian date and a SUBJECT line with no naval anchors: the
    // business-letter shape with the salutation missing or unrecognized.
    return {
      documentType: 'business-letter',
      confidence: 'low',
      warnings: ['No salutation found; verify the document type and add a salutation.'],
    };
  }

  if (hasFrom && hasTo && hasSubj) {
    return { documentType: 'basic', confidence: 'high', warnings: [] };
  }
  if (hasFrom || hasTo || hasSubj) {
    return { documentType: 'basic', confidence: 'low', warnings: [] };
  }

  return {
    documentType: 'basic',
    confidence: 'low',
    warnings: ['Could not recognize a document type; importing as a Basic Letter.'],
  };
}
