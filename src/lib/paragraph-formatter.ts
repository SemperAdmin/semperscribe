import { Paragraph, TextRun, TabStopType, AlignmentType, UnderlineType } from 'docx';
import { ParagraphData } from '@/types';
import type { ParagraphIndentSpec } from './indent-engine';

// Helper to parse markdown-like formatting to TextRuns
// Supports nested formatting: ***bold italic***, **<u>bold underline</u>**, *<u>italic underline</u>*, etc.
export const parseContentToRuns = (text: string, font: string, size: number, color: string = "000000"): TextRun[] => {
  return parseContentToRunsWithFormat(text, font, size, color, {});
};

interface FormatFlags {
  bold?: boolean;
  italics?: boolean;
  underline?: { type: typeof UnderlineType.SINGLE; color: string };
}

const parseContentToRunsWithFormat = (text: string, font: string, size: number, color: string, format: FormatFlags): TextRun[] => {
  if (!text) return [];

  const parts = text.split(/(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|<u>.*?<\/u>)/g);

  return parts.flatMap(part => {
    if (part.startsWith('***') && part.endsWith('***') && part.length >= 6) {
      return parseContentToRunsWithFormat(part.slice(3, -3), font, size, color, { ...format, bold: true, italics: true });
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return parseContentToRunsWithFormat(part.slice(2, -2), font, size, color, { ...format, bold: true });
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return parseContentToRunsWithFormat(part.slice(1, -1), font, size, color, { ...format, italics: true });
    }
    if (part.startsWith('<u>') && part.endsWith('</u>') && part.length >= 7) {
      return parseContentToRunsWithFormat(part.slice(3, -4), font, size, color, { ...format, underline: { type: UnderlineType.SINGLE, color } });
    }
    return [new TextRun({ text: part, font, size, color, ...format })];
  });
};

/**
 * Converts a number to Excel-style letters (1=a, 2=b... 26=z, 27=aa, 28=ab)
 * Handles counts >26 which String.fromCharCode(96 + count) cannot.
 */
function numberToLetter(num: number): string {
  let result = '';
  while (num > 0) {
    const remainder = (num - 1) % 26;
    result = String.fromCharCode(97 + remainder) + result;
    num = Math.floor((num - 1) / 26);
  }
  return result;
}

// 1 inch = 1440 TWIPs. All values are in TWIPs.
// PRE-PHASE-1 fixed cascade, retained only as the fallback when no
// ParagraphIndentSpec is supplied (legacy/directive call sites).
// Correspondence paths receive engine-computed specs instead.
// No longer exported: the shared constant moved into indent-engine.ts
// (FIXED_LADDER) per the Phase 1 plan, item 1.
const NAVAL_TAB_STOPS = {
    // Level 1: "1." at 0", text at 0.25"
    1: { citation: 0, text: 360 },
    // Level 2: "a." at 0.25", text at 0.5"
    2: { citation: 360, text: 720 },
    // Level 3: "(1)" at 0.5", text at 0.75"
    3: { citation: 720, text: 1080 },
    // Level 4: "(a)" at 0.75", text at 1.0"
    4: { citation: 1080, text: 1440 },
    // Levels 5-8 continue the pattern
    5: { citation: 1440, text: 1800 },
    6: { citation: 1800, text: 2160 },
    7: { citation: 2160, text: 2520 },
    8: { citation: 2520, text: 2880 },
};


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


export function createFormattedParagraph(
  paragraph: ParagraphData,
  index: number,
  allParagraphs: ParagraphData[],
  font: string = "Times New Roman",
  color: string = "000000",
  isDirective: boolean = false,
  shouldBoldTitle: boolean = true,
  shouldUppercaseTitle: boolean = true,
  isBusinessLetter: boolean = false,
  isShortLetter: boolean = false,
  relativeSpec?: ParagraphIndentSpec,
  keepWithNext: boolean = false
): Paragraph {
    const { content, level } = paragraph;
    const { citation } = generateCitation(paragraph, index, allParagraphs);

    // Helper to process title
    const processTitle = (title: string) => {
        return shouldUppercaseTitle ? title.toUpperCase() : title;
    };

    // BUSINESS LETTER MODE
    if (isBusinessLetter) {
       // Level 1: No citation, 0.5" first line indent (or 1" for Short Letter)
       if (level === 1) {
           const children: TextRun[] = [];
           if (paragraph.title) {
                const suffix = content ? '.' : '';
                children.push(new TextRun({
                    text: processTitle(paragraph.title) + suffix,
                    font: font,
                    size: 24,
                    bold: shouldBoldTitle,
                    color
                }));
                if (content) children.push(new TextRun({ text: '\u00A0\u00A0', font: font, size: 24, color }));
           }
           children.push(...parseContentToRuns(content, font, 24, color));

           // Use 0.25" (360 twips) for standard Business Letter indent to match "8 spaces" policy
           const indentSize = isShortLetter ? 1440 : 360;

           return new Paragraph({
               children,
               alignment: AlignmentType.LEFT,
               indent: { firstLine: indentSize },
               spacing: isShortLetter ? { line: 480 } : undefined, // Double space for short letter
               // S6/P2 keep rules apply to business paragraphs too.
               widowControl: true,
               keepNext: keepWithNext || undefined,
           });
       }

       // Level 2+: Standard Naval Letter logic
    }

    // Directive (Block Style) logic:
    // Level 1: Citation at 0", Text at 1.0" (1440 twips)
    // Level 2: Citation at 0.5" (720 twips), Text at 1.0" (1440 twips)
    // For Directives, hanging indent is always aligned with text start (1440)

    // Naval Letter logic (SECNAV M-5216.5):
    // Defined in NAVAL_TAB_STOPS (cascading indent)
    const spec = NAVAL_TAB_STOPS[level as keyof typeof NAVAL_TAB_STOPS];

    // Calculate hanging indent to ensure wrapped text aligns with the start of the first line text
    const indentConfig = {
        left: spec.text,
        hanging: spec.text - spec.citation
    };

    const isCourier = font === "Courier New";

    // Build citation runs with proper formatting
    let citationRuns: TextRun[];

    // Per SECNAV M-5216.5: Only levels 5-8 have underlined numbers/letters (not punctuation)
    if (level >= 5 && level <= 8) {
        if (citation.includes('(')) {
            // Levels 7 and 8: "(1)" or "(a)" - only underline the number/letter
            const innerText = citation.replace(/[()]/g, '');
            citationRuns = [
                new TextRun({ text: "(", font: font, size: 24, color }),
                new TextRun({ text: innerText, font: font, size: 24, color, underline: { color } }),
                new TextRun({ text: ")", font: font, size: 24, color }),
            ];
        } else {
            // Levels 5 and 6: "1." or "a." - only underline the number/letter, not the period
            const numberOrLetter = citation.slice(0, -1); // Remove the period
            citationRuns = [
                new TextRun({ text: numberOrLetter, font: font, size: 24, color, underline: { color } }),
                new TextRun({ text: ".", font: font, size: 24, color }),
            ];
        }
    } else {
        // Levels 1-4: No underline
        citationRuns = [new TextRun({ text: citation, font: font, size: 24, color })];
    }

    // For Courier New, use non-breaking spaces instead of tabs
    if (isCourier) {
        // With an engine spec (correspondence): designator column comes from
        // measured character positions per M-5216.5 Fig 7-8: content-relative,
        // so "10." shifts children one column further than "1.".
        // Without a spec (legacy/directive): pre-Phase-1 fixed 4-char ladder.
        const indentSpaces = '\u00A0'.repeat(relativeSpec ? relativeSpec.prefixChars : (level - 1) * 4);

        // Spacing after citation: 2 spaces for periods, 1 for parentheses
        const spacesAfterCitation = relativeSpec
            ? '\u00A0'.repeat(relativeSpec.spacesAfter)
            : (citation.endsWith('.') ? '\u00A0\u00A0' : '\u00A0');

        const children = [
            new TextRun({ text: indentSpaces, font: font, size: 24, color }),
            ...citationRuns,
            new TextRun({ text: spacesAfterCitation, font: font, size: 24, color })
        ];

        if (paragraph.title) {
        // Only add period if content exists (standard naval letter)
        const suffix = content ? '.' : '';

        children.push(new TextRun({
            text: processTitle(paragraph.title) + suffix,
            font: font,
            size: 24,
            bold: shouldBoldTitle,
            color,
            underline: undefined // Explicitly undefined to ensure no underline
        }));
        if (content) children.push(new TextRun({ text: '\u00A0\u00A0', font: font, size: 24, color }));
    }
        children.push(...parseContentToRuns(content, font, 24, color));

        return new Paragraph({
            children,
            alignment: AlignmentType.LEFT,
        });
    }

    // DIRECTIVE MODE (Block Style)
    if (isDirective) {
        const children: any[] = [];

        // Level 1: "1." at margin
        if (level === 1) {
             children.push(...citationRuns);
             children.push(new TextRun({ text: '\t', font: font, size: 24, color }));
        }
        // Level 2+: Indented 0.5" then tab to 1.0"
        else {
             children.push(new TextRun({ text: '\t', font: font, size: 24, color })); // Tab to 0.5"
             children.push(...citationRuns);
             children.push(new TextRun({ text: '\t', font: font, size: 24, color })); // Tab to 1.0"
        }

        if (paragraph.title) {
        // Only add period if content exists (standard naval letter)
        const suffix = content ? '.' : '';

        children.push(new TextRun({
            text: processTitle(paragraph.title) + suffix,
            font: font,
            size: 24,
            bold: shouldBoldTitle,
            color,
            underline: undefined
        }));
        if (content) children.push(new TextRun({ text: '\u00A0\u00A0', font: font, size: 24, color }));
    }
        children.push(...parseContentToRuns(content, font, 24, color));

        return new Paragraph({
            children,
            tabStops: [
                { type: TabStopType.LEFT, position: 720 },  // 0.5" for citation indent
                { type: TabStopType.LEFT, position: 1440 }, // 1.0" for text start
            ],
            alignment: AlignmentType.LEFT,
            indent: { left: 1440, hanging: level === 1 ? 1440 : 720 }, // Wrap aligns with text at 1.0"
        });
    }

    // CORRESPONDENCE MODE (relative indent engine).
    // SECNAV M-5216.5 Fig 7-8: designator starts under the first letter of
    // the parent paragraph's text, at a measured (content-relative) position
    // implemented as a first-line indent. Runover lines return to the left
    // margin, never indented (M-5216.5 7-2.13; POLICY_COMPLIANCE_AUDIT.md
    // line 43). Replaces the fixed 0.25-inch cascade for correspondence.
    if (relativeSpec) {
        const children = [...citationRuns];
        children.push(new TextRun({ text: '\u00A0'.repeat(relativeSpec.spacesAfter), font, size: 24, color }));
        if (paragraph.title) {
            const suffix = content ? '.' : '';
            children.push(new TextRun({ text: processTitle(paragraph.title) + suffix, font: font, size: 24, bold: shouldBoldTitle, color }));
            if (content) children.push(new TextRun({ text: '\u00A0\u00A0', font, size: 24, color }));
        }
        children.push(...parseContentToRuns(content, font, 24, color));

        return new Paragraph({
            children,
            alignment: AlignmentType.LEFT,
            indent: { firstLine: relativeSpec.firstLineTwips },
            // S6: no paragraph orphaned at a page bottom; with keepNext
            // (last paragraph before the signature) Word carries at
            // least two lines onto the signature page (M-5216.5 7-2.16
            // two-line rule; widow/orphan minimum is two lines).
            widowControl: true,
            keepNext: keepWithNext || undefined,
        });
    }

    // STANDARD NAVAL LETTER MODE (Original behavior)
    // Handle Level 1 separately: no initial tab, citation starts at 0"
    if (level === 1) {
        const children = [...citationRuns];
        children.push(new TextRun({ text: '\t', font: font, size: 24, color }));

        if (paragraph.title) {
            // Only add period if content exists (standard naval letter)
            const suffix = content ? '.' : '';
            children.push(new TextRun({ text: processTitle(paragraph.title) + suffix, font: font, size: 24, bold: shouldBoldTitle, color }));
            if (content) children.push(new TextRun({ text: '\u00A0\u00A0', font: font, size: 24, color }));
        }
        children.push(...parseContentToRuns(content, font, 24, color));

        return new Paragraph({
            children,
            tabStops: [
                { type: TabStopType.LEFT, position: spec.text },
            ],
            alignment: AlignmentType.LEFT,
            indent: indentConfig, // Added hanging indent
        });
    }

    // Levels 2-8
    const children = [
        // REMOVED leading tab because indent: { left: ..., hanging: ... } already places the cursor at the citation start position.
        // Adding a tab here would push the citation to the NEXT tab stop (the text position), which is incorrect.
        ...citationRuns,
        new TextRun({ text: '\t', font: font, size: 24, color }), // Tab to start text
    ];

    if (paragraph.title) {
        children.push(new TextRun({ text: processTitle(paragraph.title) + '.', font: font, size: 24, bold: shouldBoldTitle, color }));
        if (content) children.push(new TextRun({ text: '\u00A0\u00A0', font: font, size: 24, color }));
    }
    children.push(...parseContentToRuns(content, font, 24, color));

    return new Paragraph({
        children,
        tabStops: [
            { type: TabStopType.LEFT, position: spec.citation },
            { type: TabStopType.LEFT, position: spec.text },
        ],
        alignment: AlignmentType.LEFT,
        indent: indentConfig, // Added hanging indent
    });
}
