/**
 * Paragraph designator (citation) generation — a leaf module with no
 * imports from the formatter/engine layer, so paragraph-formatter and
 * indent-engine can both depend on it without forming a cycle.
 */
import { ParagraphData } from '@/types';

function numberToLetter(num: number): string {
  let result = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

/**
 * Position of a paragraph among its same-level siblings under the same
 * parent (1-based).
 */
function countSiblingPosition(
  paragraph: ParagraphData,
  index: number,
  allParagraphs: ParagraphData[]
): number {
    const { level } = paragraph;

    // Find the list of siblings at the same level that belong to the same parent.
    let listStartIndex = 0;
    if (level > 1) {
        // Search backwards from the current paragraph to find the parent.
        for (let i = index - 1; i >= 0; i--) {
            if (allParagraphs[i].level < level) {
                listStartIndex = i + 1;
                break;
            }
        }
    }

    // Count position within that list of siblings.
    let count = 0;
    for (let i = listStartIndex; i <= index; i++) {
        const p = allParagraphs[i];
        // Only count paragraphs at the same level within the same sibling group.
        if (p.level === level) {
             // Count title-only structural paragraphs too (Execution,
             // Tasks, ...). The PDF's generateCitation already did;
             // this copy lagged and numbered siblings after a
             // title-only paragraph one designator short.
             if (p.content.trim() || (p.title && p.title.trim()) || p.id === paragraph.id) {
                count++;
            }
        }
    }

    return count === 0 ? 1 : count;
}

/** Options that alter the citation scheme for specific document types. */
export interface CitationOptions {
  documentType?: string;
  /** MCO 5215.1K para 34: level 1 renders as {chapter}001., {chapter}002., ... */
  fourDigitNumbering?: boolean;
  chapterNumber?: number;
}

/**
 * Full display ruleset shared by the PDF and DOCX renderers: the
 * standard SECNAV M-5216.5 scheme, information-paper bullets, and MCO
 * 5215.1K four-digit numbering.
 */
export function generateDisplayCitation(
  paragraph: ParagraphData,
  index: number,
  allParagraphs: ParagraphData[],
  options: CitationOptions = {}
): string {
    const { level } = paragraph;
    const { documentType, fourDigitNumbering, chapterNumber } = options;

    if (documentType === 'information-paper' && level > 1) {
        switch (level) {
            case 2: return '•';
            case 3: return '◦';
            case 4: return '▪';
            default: return '•';
        }
    }

    const count = countSiblingPosition(paragraph, index, allParagraphs);

    // 4-digit numbering per MCO 5215.1K para 34
    // Level 1: {chapter}001, {chapter}002, etc.
    // Level 2: .1, .2, .3 (displayed as part of parent e.g., 1001.1)
    // Level 3+: standard sub-paragraph scheme (a, (1), (a), etc.)
    if (fourDigitNumbering) {
        const ch = chapterNumber || 1;
        switch (level) {
            case 1: return `${ch}${String(count).padStart(3, '0')}.`;
            case 2: return `${count}.`;
            case 3: return `${numberToLetter(count)}`;
            case 4: return `(${count})`;
            case 5: return `(${numberToLetter(count)})`;
            case 6: return `${count}.`;
            case 7: return `${numberToLetter(count)}.`;
            case 8: return `(${count})`;
            default: return '';
        }
    }

    switch (level) {
        case 1: return `${count}.`;
        case 2: return `${numberToLetter(count)}.`;
        case 3: return `(${count})`;
        case 4: return `(${numberToLetter(count)})`;
        // Per SECNAV M-5216.5, levels 5-8 have underlined numbers/letters (not punctuation)
        case 5: return `${count}.`;
        case 6: return `${numberToLetter(count)}.`;
        case 7: return `(${count})`;
        case 8: return `(${numberToLetter(count)})`;
        default: return '';
    }
}

/**
 * Generates the correct citation string (e.g., "1.", "a.", "(1)") for a given paragraph.
 * This function calculates the count based on preceding sibling paragraphs at the same level.
 * Base scheme only — renderers that need bullets/four-digit numbering
 * call generateDisplayCitation with options.
 */
export function generateCitation(
  paragraph: ParagraphData,
  index: number,
  allParagraphs: ParagraphData[]
): { citation: string } {
    return { citation: generateDisplayCitation(paragraph, index, allParagraphs) };
}
