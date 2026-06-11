/**
 * Naval letter formatting utilities
 * Handles font selection and spacing for Times New Roman vs Courier New
 */

import { FormData, ParagraphData } from '@/types';

/**
 * Gets the font name based on user selection
 *
 * @param bodyFont - The font type selection
 * @returns Full font name
 */
export function getBodyFont(bodyFont: 'times' | 'courier'): string {
  return bodyFont === 'courier' ? 'Courier New' : 'Times New Roman';
}

/**
 * Gets proper spacing for From/To labels
 *
 * @param label - "From" or "To"
 * @param bodyFont - The font type
 * @returns Formatted label with appropriate spacing
 */
export function getFromToSpacing(label: string, bodyFont: 'times' | 'courier'): string {
  if (bodyFont === 'courier') {
    if (label === 'From') return 'From:  '; // 2 spaces
    if (label === 'To') return 'To:    '; // 4 spaces
  }
  return `${label}:\t`; // Tab for Times New Roman
}

/**
 * Gets proper spacing for Via entries
 *
 * @param index - Index of the via entry
 * @param bodyFont - The font type
 * @returns Formatted via label with spacing
 */
export function getViaSpacing(index: number, bodyFont: 'times' | 'courier', total: number = 2): string {
  // M-5216.5: number via addressees ONLY when there are two or more.
  // A single via is unnumbered ("Via:  Commanding Officer..." with no
  // "(1)"). Phase 2 item 1; default total=2 preserves the numbered
  // form for legacy callers that do not pass a total.
  if (total === 1) {
    return bodyFont === 'courier' ? 'Via:\u00A0\u00A0\u00A0' : 'Via:\t';
  }
  if (bodyFont === 'courier') {
    return index === 0
      ? `Via:\u00A0\u00A0\u00A0(${index + 1})\u00A0` // 3 spaces before, 1 space after
      : `\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0(${index + 1})\u00A0`; // 7 spaces before, 1 space after
  }
  return index === 0 ? `Via:\t(${index + 1})\t` : `\t(${index + 1})\t`;
}

/**
 * Gets proper spacing for Subject label
 *
 * @param bodyFont - The font type
 * @returns Formatted subject label with spacing
 */
export function getSubjSpacing(bodyFont: 'times' | 'courier'): string {
  return bodyFont === 'courier' ? 'Subj:  ' : 'Subj:\t'; // 2 spaces or tab
}

/**
 * Gets proper spacing for Reference entries
 *
 * @param letter - Reference letter (a, b, c, etc.)
 * @param index - Index of the reference
 * @param bodyFont - The font type
 * @returns Formatted reference label with spacing
 */
export function getRefSpacing(letter: string, index: number, bodyFont: 'times' | 'courier'): string {
  if (bodyFont === 'courier') {
    return index === 0
      ? `Ref:\u00A0\u00A0\u00A0(${letter})\u00A0` // 3 spaces before, 1 space after
      : `\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0(${letter})\u00A0`; // 7 spaces before, 1 space after
  }
  // Times: tab to position "(a)", then single space before text
  return index === 0 ? `Ref:\t(${letter}) ` : `\t(${letter}) `;
}

/**
 * Gets proper spacing for Enclosure entries
 *
 * @param number - Enclosure number
 * @param index - Index of the enclosure
 * @param bodyFont - The font type
 * @returns Formatted enclosure label with spacing
 */
export function getEnclSpacing(number: number, index: number, bodyFont: 'times' | 'courier'): string {
  if (bodyFont === 'courier') {
    return index === 0
      ? `Encl:\u00A0\u00A0(${number})\u00A0` // 2 spaces before, 1 space after
      : `\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0(${number})\u00A0`; // 7 spaces before, 1 space after
  }
  // Times: tab to position "(1)", then single space before text
  return index === 0 ? `Encl:\t(${number}) ` : `\t(${number}) `;
}

/**
 * Gets proper spacing for Copy To label
 *
 * @param bodyFont - The font type
 * @returns Formatted copy to label with spacing
 */
export function getCopySpacing(bodyFont: 'times' | 'courier'): string {
  return bodyFont === 'courier' ? 'Copy to:' : 'Copy to:';
}

/**
 * Alias for getCopySpacing to match consumer expectations
 */
export const getCopyToSpacing = getCopySpacing;

/**
 * Splits a subject line into multiple lines based on a character limit
 * while preserving whole words.
 * 
 * @param subject - The subject string
 * @param maxLength - Maximum characters per line
 * @returns Array of subject lines
 */
export function splitSubject(subject: string, maxLength: number = 60): string[] {
  if (!subject) return [];
  
  const words = subject.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    if (currentLine.length + 1 + words[i].length <= maxLength) {
      currentLine += ' ' + words[i];
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  
  return lines;
}

/**
 * Formats a date string for cancellation (e.g., "Jun 2025")
 * 
 * @param dateString - The date string to format
 * @returns Formatted date string or original if invalid
 */
export function formatCancellationDate(dateString: string): string {
  if (!dateString) return '';
  
  try {
    const dateObj = new Date(dateString);
    if (isNaN(dateObj.getTime())) return dateString;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();
    return `${month} ${year}`;
  } catch {
    return dateString;
  }
}

/**
 * Returns the SSIC value for directives. The SSIC field now contains the full
 * identifier including classification prefix, reserve designation, point number,
 * revision letter, and change indicator (e.g., "C5216R.3K w/ ch 1").
 *
 * For non-directive documents, this still works since those use a plain 4-5 digit SSIC.
 */
export function formatDirectiveSSIC(
  ssic: string,
  _options?: {
    classificationPrefix?: string;
    isReserveOnly?: boolean;
    revisionLetter?: string;
    pointNumber?: string;
  }
): string {
  return ssic || '';
}

/**
 * Builds the full directive title line (e.g., "MCO 5216.3K w/ ch 1").
 * The SSIC field now contains the full identifier, so this just combines
 * the order prefix with the SSIC value.
 */
export function buildDirectiveTitle(formData: FormData): string {
  const prefix = formData.orderPrefix || (formData.documentType === 'bulletin' ? 'MCBul' : 'MCO');
  const ssic = formData.ssic || '';

  return ssic ? `${prefix} ${ssic}` : '';
}

/**
 * Formats the SSIC display in the identification block for directives.
 * The SSIC field now contains the full identifier (e.g., "C5216R.3K"),
 * so this extracts just the base SSIC portion for the identification block.
 */
export function formatDirectiveSSICBlock(formData: FormData): string {
  if (!formData.ssic) return '';
  // Extract the base SSIC portion (digits, optional R, optional .digits, optional letter)
  // Strip "w/ ch #" suffix if present
  const ssic = formData.ssic.replace(/\s*w\/.*$/i, '').trim();
  return ssic;
}

/**
 * Standard MCO 5-Paragraph Order (SMEAC) scaffold per MCO 5216.20B Ch2.
 * Includes mandatory sub-paragraphs for Execution and Command and Signal.
 * Cancellation (para 2) is included as optional — delete if not needed.
 */
export function getMCOParagraphs(): ParagraphData[] {
  // Execution substructure per user ruling 2026-06-10: Commander's
  // Intent / Concept of Operations / Tasks (unit taskings nest under
  // Tasks as (1), (2), ...) / Coordinating Instructions. Designators
  // are ALWAYS generated from levels, never typed into content.
  return [
    { id: 1,  level: 1, content: '', title: 'Situation', isMandatory: true },
    { id: 2,  level: 1, content: '', title: 'Cancellation' },
    { id: 3,  level: 1, content: '', title: 'Mission', isMandatory: true },
    { id: 4,  level: 1, content: '', title: 'Execution', isMandatory: true },
    { id: 5,  level: 2, content: '', title: 'Commander\'s Intent' },
    { id: 6,  level: 2, content: '', title: 'Concept of Operations' },
    { id: 7,  level: 2, content: '', title: 'Tasks' },
    { id: 8,  level: 2, content: '', title: 'Coordinating Instructions' },
    { id: 9,  level: 1, content: '', title: 'Administration and Logistics', isMandatory: true },
    { id: 10, level: 1, content: '', title: 'Command and Signal', isMandatory: true },
    { id: 11, level: 2, content: '', title: 'Command' },
    { id: 12, level: 2, content: '', title: 'Signal' },
  ];
}

/**
 * Assumption of Command Paragraphs
 * Per MCO 5215.1K, Chapter 1, Figure 1-1
 */
export function getAssumptionOfCommandParagraphs(): ParagraphData[] {
  // Reduced format per MCO 5215.1K Fig 1-1 (no Mission/A&L/C&S).
  // Designators generated from levels (user ruling 2026-06-10).
  return [
    { id: 1, level: 1, title: 'Situation', content: 'To publish an assumption of command as required by reference (a).' },
    { id: 2, level: 1, title: 'Cancellation', content: '[Predecessor\'s assumption of command order].' },
    { id: 3, level: 1, title: 'Execution', content: 'I have assumed duties as Commanding General, [Unit Designation], this date as directed by reference (b). All effective orders and directives issued by my predecessors remain in effect.' },
  ];
}

/**
 * Standard MCBul paragraph scaffold per MCO 5216.20B Ch3 Section 11.
 * Bulletins use their own paragraph structure (NOT SMEAC):
 *   Purpose, Cancellation, Background, Action, Reserve Applicability,
 *   and Cancellation Contingency (if contingent cancellation type).
 */
export function getMCBulParagraphs(): ParagraphData[] {
  return [
    { id: 1, level: 1, content: '', title: 'Purpose', isMandatory: true },
    { id: 2, level: 1, content: '', title: 'Cancellation' },
    { id: 3, level: 1, content: '', title: 'Background' },
    { id: 4, level: 1, content: '', title: 'Action' },
    { id: 5, level: 1, content: '', title: 'Reserve Applicability' },
  ];
}

/**
 * Standard MOA/MOU Paragraphs
 */
export function getMOAParagraphs(type: 'moa' | 'mou' = 'moa'): ParagraphData[] {
  return [
    { id: 1, level: 1, content: 'To define the inter-service support agreement between [Activity A] and [Activity B] regarding', title: 'Purpose' },
    { id: 2, level: 1, content: 'The [Activity A] requires support from [Activity B] to', title: 'Problem' },
    { id: 3, level: 1, content: 'This agreement applies to', title: 'Scope' },
    { id: 4, level: 1, content: '', title: type === 'moa' ? 'Agreement' : 'Understanding' },
    { id: 5, level: 2, content: 'The [Activity A] agrees to', title: '' },
    { id: 6, level: 2, content: 'The [Activity B] agrees to', title: '' },
    { id: 7, level: 1, content: 'This agreement is effective upon signature by both parties and will remain in effect until', title: 'Effective Date' },
  ];
}

/**
 * Standard Business Letter Paragraphs
 */
export function getBusinessLetterParagraphs(): ParagraphData[] {
  return [
    { id: 1, level: 1, content: '', title: '' },
  ];
}

/**
 * Generates a standardized filename for exports
 */
export function getExportFilename(formData: FormData, extension: 'pdf' | 'docx' | 'txt'): string {
  const sanitize = (str: string) => (str || '').replace(/[^a-zA-Z0-9\-_ ]/g, '').trim();
  const ssic = sanitize(formData.ssic) || 'Draft';
  const subject = sanitize(formData.subj) || 'Letter';

  // Order / Directive
  if (formData.documentType === 'mco') {
    const prefix = sanitize(formData.orderPrefix ?? '') || 'MCO';
    return `${prefix} ${ssic} - ${subject}.${extension}`;
  }

  // Bulletin
  if (formData.documentType === 'bulletin') {
    return `MCBul ${ssic} - ${subject}.${extension}`;
  }

  // Change Transmittal
  if (formData.documentType === 'change-transmittal') {
    const parent = sanitize(formData.parentDirectiveTitle ?? '') || 'Directive';
    const chNum = formData.changeNumber || 1;
    return `${parent} Ch ${chNum} - ${subject}.${extension}`;
  }

  // Endorsement
  if (formData.documentType === 'endorsement') {
    const level = formData.endorsementLevel || 'Endorsement';
    const ref = sanitize(formData.basicLetterReference) || 'Ref';
    return `${level} on ${ref}.${extension}`;
  }

  // AA Form
  if (formData.documentType === 'aa-form') {
    return `NAVMC 10274 - ${ssic}.${extension}`;
  }

  // Page 11
  if (formData.documentType === 'page11') {
    const name = sanitize(formData.name ?? '') || 'Marine';
    return `NAVMC 118(11) - ${name}.${extension}`;
  }

  // AMHS
  if (formData.documentType === 'amhs') {
    return `AMHS - ${subject}.${extension}`;
  }

  // MOA/MOU
  if (formData.documentType === 'moa' || formData.documentType === 'mou') {
    const type = formData.documentType.toUpperCase();
    return `${type} - ${subject}.${extension}`;
  }

  // Staffing Papers
  if (['position-paper', 'information-paper'].includes(formData.documentType)) {
    const type = formData.documentType.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return `${type} - ${subject}.${extension}`;
  }

  // Default Basic Letter
  return `Letter ${ssic} - ${subject}.${extension}`;
}

/**
 * Merges Admin Subsections (Records Management, Privacy Act, Reports Required)
 * into the main paragraphs array for export.
 */
export function mergeAdminSubsections(
  paragraphs: ParagraphData[],
  adminSubsections?: import('@/types').AdminSubsections
): ParagraphData[] {
  if (!adminSubsections) return paragraphs;

  // Find "Administration and Logistics" paragraph
  const adminParaIndex = paragraphs.findIndex(p => 
    p.title && p.title.toLowerCase().includes('administration and logistics')
  );

  if (adminParaIndex === -1) return paragraphs;

  const adminPara = paragraphs[adminParaIndex];
  const newParagraphs = [...paragraphs];
  
  // Prepare subsections to insert
  const subsectionsToInsert: ParagraphData[] = [];
  let nextId = Math.max(...paragraphs.map(p => p.id)) + 1;

  // Helper to create subsection
  const createSubsection = (content: string) => ({
    id: nextId++,
    level: adminPara.level + 1,
    content: content || ' ', // Ensure non-empty for rendering
    title: '' // Subsections usually don't have titles in the data structure, just content
  });

  // 1. Records Management
  if (adminSubsections.recordsManagement?.show) {
    const p = createSubsection(adminSubsections.recordsManagement.content);
    // Use markdown for bold header
    p.content = `**Records Management.** ${p.content}`;
    subsectionsToInsert.push(p);
  }

  // 2. Privacy Act
  if (adminSubsections.privacyAct?.show) {
    const p = createSubsection(adminSubsections.privacyAct.content);
    p.content = `**Privacy Act.** ${p.content}`;
    subsectionsToInsert.push(p);
  }

  // 3. Reports Required
  if (adminSubsections.reportsRequired?.show) {
    const p = createSubsection(adminSubsections.reportsRequired.content);
    p.content = `**Reports Required.** ${p.content}`;
    subsectionsToInsert.push(p);
  }

  // Insert after the admin paragraph
  newParagraphs.splice(adminParaIndex + 1, 0, ...subsectionsToInsert);

  return newParagraphs;
}

/**
 * Validates acronym first-use per MCO 5215.1K para 16.
 * Rules:
 * - On first use, spell out the term followed by the acronym in parentheses
 * - After first use, the acronym alone may be used
 *
 * @returns Map of paragraph ID to error message string
 */
export function validateAcronymFirstUse(paragraphs: ParagraphData[]): Map<number, string> {
  // Well-known abbreviations exempt from spell-out requirement
  const EXEMPT = new Set([
    // Government/Military organizations
    'USMC', 'DOD', 'DON', 'CMC', 'HQMC', 'MCO', 'NAVMC',
    'SECNAV', 'SECDEF', 'MARADMIN', 'ALMAR', 'GENADMIN',
    'NATO', 'TECOM', 'MCCDC', 'MARCENT', 'MARFOR',
    // Common correspondence terms
    'NLT', 'IAW', 'POC', 'IOT', 'IRT', 'DTG', 'SSIC', 'PCN',
    'SMEAC', 'FOUO', 'CUI', 'PII', 'OPSEC',
    // Ranks, grades, designations
    'SNCO', 'NCO', 'MOS', 'EDIPI', 'SSN',
    // Fiscal/Admin
    'USD', 'GAO', 'OMB', 'OPM',
    // Standard abbreviations
    'SOP', 'POA', 'PPE', 'TBD', 'TTP', 'MEF',
    'FBI', 'CIA', 'NSA', 'DHS', 'OSD',
    'USA', 'USN', 'USCG', 'USAF',
    // Common short forms
    'PDF', 'URL',
  ]);

  // Detect acronyms: 3+ consecutive uppercase letters at word boundaries
  const acronymRegex = /\b([A-Z]{3,})\b/g;

  // Detect definitions: "Words In Mixed Case (ACRONYM)" pattern
  const definitionRegex = /[A-Z][a-z]+(?:[\s\-\/]+[A-Za-z]+)*\s*\(([A-Z]{3,})\)/g;

  // Track where each acronym is first defined and all uses
  const definedAt: Map<string, number> = new Map();
  const firstUseAt: Map<string, number> = new Map();
  const useCount: Map<string, number> = new Map();

  paragraphs.forEach((paragraph, index) => {
    const text = paragraph.content || '';
    if (!text.trim()) return;

    // Find definitions
    let match;
    definitionRegex.lastIndex = 0;
    while ((match = definitionRegex.exec(text)) !== null) {
      const acronym = match[1];
      if (!definedAt.has(acronym)) {
        definedAt.set(acronym, index);
      }
    }

    // Find uses (only in content, not in brackets/placeholders)
    const cleanText = text.replace(/\[[^\]]*\]/g, ''); // Remove bracketed placeholders
    acronymRegex.lastIndex = 0;
    while ((match = acronymRegex.exec(cleanText)) !== null) {
      const acronym = match[1];
      if (EXEMPT.has(acronym)) continue;

      useCount.set(acronym, (useCount.get(acronym) || 0) + 1);
      if (!firstUseAt.has(acronym)) {
        firstUseAt.set(acronym, index);
      }
    }
  });

  // Generate errors
  const errorsByParagraph: Map<number, string[]> = new Map();

  for (const [acronym, firstIdx] of firstUseAt) {
    const defIdx = definedAt.get(acronym);
    const paraId = paragraphs[firstIdx].id;

    // Not defined anywhere
    if (defIdx === undefined) {
      const msgs = errorsByParagraph.get(paraId) || [];
      msgs.push(`"${acronym}" not spelled out on first use (para 16)`);
      errorsByParagraph.set(paraId, msgs);
    }
    // Defined, but after first use
    else if (defIdx > firstIdx) {
      const msgs = errorsByParagraph.get(paraId) || [];
      msgs.push(`"${acronym}" used before its definition (para 16)`);
      errorsByParagraph.set(paraId, msgs);
    }
  }

  // Convert to Map<number, string>
  const result: Map<number, string> = new Map();
  for (const [id, msgs] of errorsByParagraph) {
    result.set(id, msgs.join('; '));
  }

  return result;
}

/**
 * Validates gender-neutral language per MCO 5215.1K para 15.
 * Rules:
 * - Avoid gendered pronouns used alone ("he" should be "he or she")
 * - Avoid first-person pronouns in directives ("I", "me", "my")
 *
 * @param paragraphs  All paragraphs to validate
 * @param isDirective Whether the document is a directive (enables first-person check)
 * @returns Map of paragraph ID to warning message
 */
export function validateGenderNeutralLanguage(
  paragraphs: ParagraphData[],
  isDirective: boolean = false
): Map<number, string> {
  const result: Map<number, string> = new Map();

  for (const paragraph of paragraphs) {
    const text = paragraph.content || '';
    if (!text.trim()) continue;
    const warnings: string[] = [];

    // Check for gendered pronouns without paired form
    // Match standalone "he" not part of "he or she" / "he and she" / "the" / "them" etc.
    if (/\bhe\b/i.test(text) && !/\bhe\s+(?:or|and)\s+she\b/i.test(text) && !/\bshe\s+(?:or|and)\s+he\b/i.test(text)) {
      // Exclude "the", "them", "then", "there", "these", "they", "their" — only match standalone "he"
      const matches = text.match(/(?<!\w)(?:^|\s)he(?:\s|[.,;:!?]|$)/gi);
      if (matches && matches.length > 0) {
        warnings.push('Gendered pronoun "he" — use "he or she" or rewrite (para 15)');
      }
    }

    if (/\bhim\b/i.test(text) && !/\bhim\s+(?:or|and)\s+her\b/i.test(text)) {
      warnings.push('Gendered pronoun "him" — use "him or her" or rewrite (para 15)');
    }

    if (/\bhimself\b/i.test(text) && !/\bhimself\s+(?:or|and)\s+herself\b/i.test(text)) {
      warnings.push('Gendered pronoun "himself" — use "himself or herself" or rewrite (para 15)');
    }

    // First-person check for directives only
    if (isDirective) {
      // Match capital "I" as a word (not in Roman numerals context or mid-word)
      if (/(?:^|[\s(,"'])I(?:[\s.,;:!?)"']|$)/.test(text)) {
        warnings.push('First-person "I" — avoid in directives (para 15)');
      }
      if (/\bmy\b/i.test(text)) {
        warnings.push('First-person "my" — avoid in directives (para 15)');
      }
    }

    if (warnings.length > 0) {
      result.set(paragraph.id, warnings.join('; '));
    }
  }

  return result;
}

/**
 * Validates spacing conventions per MCO 5215.1K para 36.
 * Rules:
 * - One space after closing parenthesis
 * - Two spaces after end-of-sentence period
 *
 * @returns Map of paragraph ID to warning message
 */
export function validateSpacing(paragraphs: ParagraphData[]): Map<number, string> {
  const result: Map<number, string> = new Map();

  for (const paragraph of paragraphs) {
    const text = paragraph.content || '';
    if (!text.trim()) continue;
    const warnings: string[] = [];

    // Check: two+ spaces after closing parenthesis (should be one)
    if (/\)\s{2,}/.test(text)) {
      warnings.push('Use one space after closing parenthesis (para 36)');
    }

    // Check: single space after end-of-sentence period (should be two)
    // Match period followed by exactly one space then an uppercase letter (new sentence)
    // Exclude abbreviations like "U.S." / "e.g." / "i.e." and reference labels like "(a)."
    const sentenceEndPattern = /(?<![A-Z])\.(?!\w)\s(?=[A-Z])/g;
    const singleSpaceMatches = text.match(sentenceEndPattern);
    if (singleSpaceMatches && singleSpaceMatches.length > 0) {
      // Verify they're not already double-spaced
      const doubleSpacePattern = /(?<![A-Z])\.\s{2}(?=[A-Z])/g;
      const doubleSpaceMatches = text.match(doubleSpacePattern);
      const singleCount = singleSpaceMatches.length - (doubleSpaceMatches?.length || 0);
      if (singleCount > 0) {
        warnings.push('Use two spaces after end-of-sentence periods (para 36)');
      }
    }

    if (warnings.length > 0) {
      result.set(paragraph.id, warnings.join('; '));
    }
  }

  return result;
}

export function getStaffingPaperParagraphs(): ParagraphData[] {
  return [
    { id: 1, level: 1, content: '', title: 'Purpose', isMandatory: true },
    { id: 2, level: 1, content: '', title: 'Main Points', isMandatory: true },
    { id: 3, level: 1, content: '', title: 'Discussion', isMandatory: true },
    { id: 4, level: 1, content: '', title: 'Recommendation', isMandatory: true },
  ];
}

export function getInformationPaperParagraphs(): ParagraphData[] {
  return [
    { id: 1, level: 1, content: 'State the reason for the paper.', title: 'Purpose', isMandatory: true },
    { id: 2, level: 1, content: 'Present the main points in a logical sequence.', title: 'Key Points', isMandatory: true },
  ];
}

/**
 * Single source for the complimentary close (MCO 5216.20B Sec 12):
 * "Sincerely" standard; "Very respectfully" in VIP mode; always one
 * trailing comma. Feeds both emitters (Phase 2 item 7). DLA paths are
 * out of scope per user ruling 2026-06-10 and keep their own default.
 */
export function getComplimentaryClose(formData: {
  complimentaryClose?: string;
  isVipMode?: boolean;
  [key: string]: unknown;
}): string {
  const base = (
    formData.complimentaryClose?.trim() ||
    (formData.isVipMode ? 'Very respectfully' : 'Sincerely')
  ).replace(/,+$/, '');
  return base + ',';
}

/**
 * P3.3 (audit gap G5): blank lines between the last body line (or
 * complimentary close) and the typed signature name.
 *
 * Naval correspondence and SECNAV directives: signature on the 4th
 * line below = 3 blanks (SECNAV M-5216.5 7-2.16).
 * USMC directives (MCO, MCBul, change transmittal): signature on the
 * 5th line below = 4 blanks (MCO 5215.1K para 37, source line 1466).
 */
export function getSignatureBlankLines(documentType: string): number {
  return ['mco', 'bulletin', 'change-transmittal'].includes(documentType) ? 4 : 3;
}

/**
 * P3.4 — directive identification block designation line
 * (POLICY_COMPLIANCE_AUDIT.md line 138: "MCO + SSIC.point + revision";
 * MCO 5215.1K para 38). First line of the upper-right ID stack and of
 * the continuation-page header. Bulletins carry the MCBul abbreviation
 * (no point number). The SSIC field is used as entered.
 */
export function getDirectiveDesignation(formData: FormData): string {
  const prefix = formData.orderPrefix
    || (formData.documentType === 'bulletin' ? 'MCBul' : 'MCO');
  return formData.ssic ? `${prefix} ${formData.ssic}` : '';
}

/**
 * P3.6 — distribution statement text with fill-ins resolved.
 * Verbatim base text lives in DISTRIBUTION_STATEMENTS (constants.ts),
 * verified character-for-character against MCO 5215.1K W/ ADMIN CH-2
 * encl (1) pages 1-8/1-9 (10 May 2007), fetched 2026-06-10 from
 * mcieast.marines.mil. Shared by both emitters so the resolved text
 * can never diverge.
 */
import { DISTRIBUTION_STATEMENTS } from './constants';

export function resolveDistributionStatement(formData: FormData): string {
  const dist = (formData as { distribution?: {
    statementCode?: string;
    statementReason?: string;
    statementDate?: string;
    statementAuthority?: string;
  } }).distribution;
  const code = dist?.statementCode as keyof typeof DISTRIBUTION_STATEMENTS | undefined;
  if (!code || !DISTRIBUTION_STATEMENTS[code]) return '';
  const stmt = DISTRIBUTION_STATEMENTS[code];
  let text: string = stmt.text;
  if (stmt.requiresFillIns) {
    if (dist!.statementReason) text = text.replace('(fill in reason)', dist!.statementReason);
    if (dist!.statementDate) text = text.replace('(date of determination)', formatCancellationDate(dist!.statementDate));
    if (dist!.statementAuthority) {
      text = text.replace('(insert originating command)', dist!.statementAuthority);
      text = text.replace('(originating command)', dist!.statementAuthority);
    }
  }
  return text;
}
