import { Confidence, ExtractedText } from './extractionTypes';

/**
 * Heuristic document-type detection for the Word/PDF import pipeline.
 *
 * Scans the first ~30 lines of extracted text for the headings and anchors
 * that distinguish the standard-letter family (basic letter, MFR,
 * letterhead memo, from-to memo). Types the importer does not support yet
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
