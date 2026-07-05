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
 * Generates the correct citation string (e.g., "1.", "a.", "(1)") for a given paragraph.
 * This function calculates the count based on preceding sibling paragraphs at the same level.
 */
export function generateCitation(
  paragraph: ParagraphData,
  index: number,
  allParagraphs: ParagraphData[]
): { citation: string } {
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

    if (count === 0) count = 1;

    let citation = '';
    switch (level) {
        case 1: citation = `${count}.`; break;
        case 2: citation = `${numberToLetter(count)}.`; break;
        case 3: citation = `(${count})`; break;
        case 4: citation = `(${numberToLetter(count)})`; break;
        // Per SECNAV M-5216.5, levels 5-8 have underlined numbers/letters (not punctuation)
        case 5: citation = `${count}.`; break;
        case 6: citation = `${numberToLetter(count)}.`; break;
        case 7: citation = `(${count})`; break;
        case 8: citation = `(${numberToLetter(count)})`; break;
        default: citation = '';
    }

    return { citation };
}
