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
 *
 * TWO CLASSES OF DOCUMENT ARE REFUSED OUTRIGHT rather than warned about, and
 * the distinction is the difference between a bad import and a destructive
 * one. Everything this detector cannot type still IMPORTS, as a Basic
 * Letter with a warning, because the user gets editable text out of it and
 * loses nothing. A FILLED NAVMC FORM is the opposite trade on both sides:
 *
 *   - Nothing useful comes out. The extractor reads the page content
 *     stream, and every value on a NAVMC form lives in an AcroForm widget's
 *     appearance stream, which that call does not touch. So the "import"
 *     yields the blank form's Privacy Act boilerplate and instruction text,
 *     never the case data. There is no version of this that works.
 *   - Something valuable goes in. Applying an import calls
 *     `resetDocumentState` (src/app/page.tsx), which builds a fresh
 *     formData with no spread of the previous one. A clerk who does this
 *     with a Unit Punishment Book open loses the whole case, silently, and
 *     is told "Document imported."
 *
 * THE SECOND CLASS IS AN XFA FORM, and it was missed by reasoning and found
 * by measurement. Three of the four NAVMC blanks this repo ships are XFA,
 * and their entire extracted text is Adobe's "Please wait..." fallback
 * notice: no form number, no title, nothing the NAVMC check below could
 * see. Running all four shipped blanks through the real extractor is what
 * turned that up. See `XFA_FALLBACK_RE`.
 *
 * SO REFUSAL IS THE FEATURE HERE. `DocTypeDetection.refuse` stops the flow
 * in useDocumentImport before the review modal opens, so the destructive
 * confirm button is never reachable for these files.
 *
 * WHY THE SCAN WINDOW DID NOT CATCH THIS ALREADY, and why the fix is not
 * simply a bigger window. The `^NAVMC` signal below is line-anchored and
 * scoped to the first 30 lines. On the real NAVMC 10132 the string "NAVMC
 * 10132" first appears in the PAGE FOOTER, around line 75 of the extracted
 * text, so the signal could never fire. Widening SCAN_WINDOW would have
 * fixed that one case and changed the classification of every other
 * document, since a body line beginning "MEMORANDUM" would suddenly win.
 * The form check below is a separate full-text pass instead: it can only
 * ADD a refusal, never move an existing document into a different type.
 */

export interface DocTypeDetection {
  /** A DOCUMENT_TYPES registry id — always one the importer supports. */
  documentType: string;
  confidence: Confidence;
  warnings: string[];
  /**
   * Set when this file must NOT be imported at all. The caller stops here
   * and shows `reason`; it does not open the review modal. See the module
   * comment for why refusing beats importing badly for this one class.
   */
  refuse?: { label: string; reason: string };
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

/**
 * A NAVMC form's own identity, matched anywhere in the text rather than at
 * the start of a line, because these strings live in page footers.
 *
 * `UNIT PUNISHMENT BOOK (5812)` is carried because it sits on line 2 of the
 * NAVMC 10132, far earlier than the footer, and it names the form even on a
 * page where the number does not appear.
 */
const NAVMC_FORM_RE = /\bNAVMC\s*\d{3,5}\b/i;
const UPB_TITLE_RE = /\bUNIT PUNISHMENT BOOK\b/i;

/**
 * A naval letter that CITES a NAVMC form is not a NAVMC form, and this is
 * what tells them apart. A letter carries From, To and Subj, or a civilian
 * salutation; a blank or filled form carries none of them, because a form's
 * field VALUES never reach the extracted text at all. So the refusal fires
 * only when a form marker appears with no correspondence anchors anywhere
 * near the top. A memo about UPB procedure still imports normally.
 */
/**
 * Adobe's XFA fallback page, which is the ENTIRE text layer of an XFA form.
 *
 * The NAVMC 10274, 118(11) and 10922 blanks shipped in public/forms are all
 * XFA. Their content lives in an XML payload that pdfjs's `getTextContent`
 * does not touch, so the whole extraction is Adobe's nine-line "Please
 * wait..." notice telling the reader to upgrade. There is no form number in
 * it, no title, nothing: the NAVMC check above cannot see these files at
 * all, which is how this second case was missed until the four shipped
 * blanks were run through the real extractor rather than reasoned about.
 *
 * MATCHED ON ADOBE'S OWN SENTENCE, not on "Please wait...", which is three
 * common words that could appear in a real document. This sentence could
 * not plausibly be correspondence.
 *
 * WIDER THAN THE NAVMC CHECK ON PURPOSE. This catches any XFA form, not
 * only the ones this repo happens to ship, and an XFA form yields nothing
 * importable whatever it is.
 */
const XFA_FALLBACK_RE =
  /If this message is not eventually replaced by the proper contents of the document/i;

function looksLikeXfaForm(text: ExtractedText): boolean {
  return text.lines.some((l) => XFA_FALLBACK_RE.test(l));
}

function looksLikeAForm(text: ExtractedText, window: string[]): boolean {
  const hasCorrespondenceAnchor = window.some(
    (l) => FROM_RE.test(l) || TO_RE.test(l) || SUBJ_RE.test(l) || SALUTATION_RE.test(l),
  );
  if (hasCorrespondenceAnchor) return false;
  return text.lines.some((l) => NAVMC_FORM_RE.test(l) || UPB_TITLE_RE.test(l));
}

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

  // BEFORE ANYTHING ELSE, because these are refusals rather than
  // classifications and nothing below can produce a right answer for a form.
  if (looksLikeXfaForm(text)) {
    return {
      documentType: 'basic',
      confidence: 'low',
      warnings: [],
      refuse: {
        label: 'this form',
        reason:
          'This file is an XFA form. Its content lives in an XML payload rather than in the ' +
          'page, so the only text readable here is the "Please wait..." notice Adobe shows ' +
          'when a viewer cannot display it. Nothing of the form itself would be imported, ' +
          'and importing it would replace the document you have open. To carry a form ' +
          'between sessions, save it to the library or export it as a .nldp file and import ' +
          'that instead.',
      },
    };
  }

  if (looksLikeAForm(text, window)) {
    return {
      documentType: 'basic',
      confidence: 'low',
      warnings: [],
      refuse: {
        label: 'a NAVMC form',
        reason:
          'A NAVMC form cannot be imported this way, and importing it would replace the ' +
          'document you have open. Field values on these forms live in the form fields ' +
          'themselves, which this reader cannot see, so the only thing it would recover is ' +
          'the blank form\'s boilerplate. To carry a form between sessions, save it to the ' +
          'library or export it as a .nldp file and import that instead.',
      },
    };
  }
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
