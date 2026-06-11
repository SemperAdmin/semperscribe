import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  TabStopType,
  AlignmentType,
  ImageRun,
  Header,
  Footer,
  PageNumber,
  UnderlineType,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  VerticalAlign,
  HorizontalPositionAlign,
  VerticalPositionAlign,
  FrameAnchorType,
  FrameWrap,
  HeightRule
} from "docx";
import { FormData, ParagraphData } from "@/types";
import { getDoDSealBuffer } from "./dod-seal";
import { 
  splitSubject, 
  formatCancellationDate, 
  getFromToSpacing, 
  getViaSpacing, 
  getSubjSpacing, 
  getRefSpacing, 
  getEnclSpacing, 
  getCopyToSpacing, 
  getComplimentaryClose, getSignatureBlankLines, getDirectiveDesignation, buildDirectiveTitle, resolveDistributionStatement } from './naval-format-utils';
import { createFormattedParagraph, generateCitation } from "./paragraph-formatter";
import { relativeIndentEngine, fixedLadderEngine, isCorrespondenceType, isDirectiveType } from "./indent-engine";
import { resolveBodyFont, resolveHeaderType, isSecnavDirective } from "./font-policy";
import { parseAndFormatDate, formatBusinessDate } from "./date-utils";
import { DISTRIBUTION_STATEMENTS } from "@/lib/constants";
import { DOC_SETTINGS, TAB_STOPS, INDENTS } from "./doc-settings";

// Constants for layout (in twips)
// 1 inch = 1440 twips
const MARGIN_TOP = 720; // 0.5" top margin per reference app
const MARGIN_BOTTOM = 1440;
const MARGIN_LEFT = 1440;
const MARGIN_RIGHT = 1440;

const FONT_SIZE_BODY = 24; // 12pt (docx uses half-points)

// Helper to get font name
const getFont = (font: 'times' | 'courier') => {
  return font === 'courier' ? 'Courier New' : 'Times New Roman';
};

// Get header color based on user selection (black or blue only)
const getHeaderColor = (colorName?: string) => {
  return colorName === 'blue' ? "000080" : "000000"; // Navy blue (#000080 per reference) or black
};

// Empty line = one full blank line at body type size.
// SECNAV M-5216.5 7-2.13: the next paragraph "begins on the second line
// below" - the blank line must be a 12pt line, so the paragraph mark
// carries an explicit run with the body font and size. The previous
// implementation ignored both arguments, leaving blank-line height to
// Word's default style (audit gap G2).
const createEmptyLine = (font?: string, size?: number) => {
  return new Paragraph({
    children: [new TextRun({ text: "", font: font ?? DOC_SETTINGS.font, size: size ?? FONT_SIZE_BODY })],
  });
};

export async function generateDocxBlob(
  formData: FormData,
  vias: string[],
  references: string[],
  enclosures: string[],
  copyTos: string[],
  paragraphs: ParagraphData[],
  distList: string[] = []
): Promise<Blob> {
  // P3.1 (G7): archetype font policy. Directives coerce to Courier at
  // generation time; correspondence passes through unchanged. Same
  // guard for letterhead: directives never carry DLA letterhead.
  formData = {
    ...formData,
    bodyFont: resolveBodyFont(formData.documentType, formData.bodyFont),
    headerType: resolveHeaderType(formData.documentType, formData.headerType) as FormData['headerType'],
  };
  const font = getFont(formData.bodyFont);
  const headerColor = getHeaderColor(formData.accentColor);
  const sealBuffer = await getDoDSealBuffer(formData.headerType === 'DON' ? 'navy' : 'marine-corps'); // DLA uses marine-corps (DoD) seal
  // P4.3: SECNAV instruction/notice join the directive path (SECNAV
  // M-5215.1 delegates margins/letter geometry like MCO 5215.1K does).
  const isSecnav = isSecnavDirective(formData.documentType);
  const isDirective = formData.documentType === 'mco' || formData.documentType === 'bulletin' || isSecnav;
  const isStaffingPaper = ['position-paper', 'information-paper', 'decision-paper'].includes(formData.documentType);
  const isPositionPaper = formData.documentType === 'position-paper';
  const isDecisionPaper = formData.documentType === 'decision-paper';
  const isFromToMemo = formData.documentType === 'from-to-memo';
  const isMfr = formData.documentType === 'mfr';
  const isMoaOrMou = formData.documentType === 'moa' || formData.documentType === 'mou';
  const isBusinessLetter = formData.documentType === 'business-letter';
  const isExecCorr = formData.documentType === 'executive-correspondence';
  const isExecLetter = isExecCorr && (formData.execFormat === 'letter' || !formData.execFormat);
  const isDLAType = formData.documentType?.startsWith('dla-') || false;
  const isDLAMemo = formData.documentType === 'dla-memorandum';
  const isDLABusinessLetter = formData.documentType === 'dla-business-letter';
  const isCivilianStyle = isBusinessLetter || isExecLetter || isDLAType;

  const moaData = formData.moaData || {
    activityA: '',
    activityB: '',
    seniorSigner: { name: '', title: '', activity: '' },
    juniorSigner: { name: '', title: '', activity: '' }
  };

  // Layout settings based on document type
  // Letters use 0.5" tabs/indent, Directives use 1.0"
  const tabPosition = isDirective ? 1440 : TAB_STOPS.first; 
  
  // Indentation logic
  // For Directives: Block style (1440 left, 1440 hanging to align wrapped text)
  // For Letters: No indent, just tabs (Legacy behavior)
  const addressIndent = isDirective 
    ? { left: 1440, hanging: 1440 }
    : undefined;
    
  const subjectIndent = isDirective
    ? { left: 1440, hanging: 1440 }
    : undefined;

  const addressSpacing = 0; // Single spacing for address block
  const signatureIndent = INDENTS.signature; // 3.25" from left

  // --- Header Section (Letterhead) ---
  // Note: Seal is placed in the Section Header (headers.first), text is in the Body
  const letterheadParagraphs: Paragraph[] = [];

  if (!isFromToMemo && !isMfr && !isStaffingPaper) {
      // Department Header Text
      const headerText = formData.headerType === 'USMC'
        ? 'UNITED STATES MARINE CORPS'
        : formData.headerType === 'DLA'
        ? 'DEFENSE LOGISTICS AGENCY'
        : 'DEPARTMENT OF THE NAVY';
        
      letterheadParagraphs.push(new Paragraph({
        children: [new TextRun({ text: headerText, font: 'Arial', bold: true, size: isDLAType ? 24 : 20, color: headerColor })], // DLA: 12pt bold; Navy/USMC: 10pt
        alignment: AlignmentType.CENTER,
        spacing: { after: 0 },
      }));

      // Address Lines
      [formData.line1, formData.line2, formData.line3].forEach(line => {
        if (line) {
          letterheadParagraphs.push(new Paragraph({
            children: [new TextRun({ text: line, font: 'Arial', size: isDLAType ? 20 : 16, color: headerColor })], // DLA: 10pt; Navy/USMC: 8pt
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
          }));
        }
      });

      letterheadParagraphs.push(createEmptyLine(font));
  }

  // --- SSIC Block ---
  const ssicParagraphs: (Paragraph | Table)[] = [];
  
  const formattedDate = isCivilianStyle
    ? formatBusinessDate(formData.date || '')
    : parseAndFormatDate(formData.date || '');

  if (isFromToMemo || isMfr) {
       // From-To Memo & MFR: Date Flush Right, Top of page (simulated 1 inch margin)
       ssicParagraphs.push(new Paragraph({
          children: [new TextRun({ text: formattedDate || 'Date Placeholder', font, size: FONT_SIZE_BODY })],
          alignment: AlignmentType.RIGHT,
          spacing: { before: 1440, after: 0 } // 1 inch top spacing
       }));
  } else if (isDLAType) {
      // DLA: Suspense date (if present) two lines above document date, then date flush right
      if (formData.suspenseDate) {
          ssicParagraphs.push(new Paragraph({
              children: [new TextRun({ text: `S: ${formatBusinessDate(formData.suspenseDate)}`, font, size: FONT_SIZE_BODY })],
              alignment: AlignmentType.RIGHT,
              spacing: { after: 0 }
          }));
      }
      ssicParagraphs.push(new Paragraph({
          children: [new TextRun({ text: formattedDate || 'Date Placeholder', font, size: FONT_SIZE_BODY })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 240 }
      }));
  } else if (!isMoaOrMou && !isStaffingPaper) {
      // Bulletin / SECNAV-notice cancellation date, above SSIC block.
      // P4.3: notice Canc on the 2nd line above the ID symbols (SECNAV
      // M-5215.1; audit line 86) — same geometry the bulletin already
      // uses; notices have no contingent variant, prefix is "Canc:".
      if ((formData.documentType === 'bulletin' || formData.documentType === 'secnav-notice') && formData.cancellationDate) {
        const cancPrefix = formData.documentType === 'bulletin' && formData.cancellationType === 'contingent' ? 'Canc frp:' : 'Canc:';
        // P3.4: right-aligned, 2nd line above the SSIC position (one
        // blank between) — audit lines 144/170; MCO 5215.1K.
        ssicParagraphs.push(new Paragraph({
          children: [new TextRun({ text: `${cancPrefix} ${formatCancellationDate(formData.cancellationDate)}`, font, size: FONT_SIZE_BODY })],
          alignment: AlignmentType.RIGHT,
          spacing: { after: 240 } // blank line before SSIC
        }));
      }

      const ssicBlock = [];
      if (isDirective) {
        // P3.4: designation line = abbreviation + SSIC (audit line 138;
        // MCO 5215.1K para 38) — "MCO 5215.1K" / "MCBul 1500", never
        // the bare SSIC.
        const designation = getDirectiveDesignation(formData);
        if (designation) ssicBlock.push(designation);
      } else {
        if (formData.ssic) ssicBlock.push(formData.ssic);
      }

      if (formData.originatorCode) ssicBlock.push(formData.originatorCode);
      ssicBlock.push(formattedDate || 'Date Placeholder');

      // SSIC Block: right-aligned table so the longest line's right edge
      // touches the right margin, with all lines left-aligned within the block.
      const ssicTable = new Table({
          width: { size: 0, type: WidthType.AUTO },
          alignment: AlignmentType.RIGHT,
          borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "auto" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
              left: { style: BorderStyle.NONE, size: 0, color: "auto" },
              right: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
          },
          rows: [
              new TableRow({
                  children: [
                      new TableCell({
                          width: { size: 0, type: WidthType.AUTO },
                          borders: {
                              top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                              bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                              left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                              right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                          },
                          children: ssicBlock.map(line => new Paragraph({
                              children: [new TextRun({ text: line, font, size: FONT_SIZE_BODY })],
                              alignment: AlignmentType.LEFT,
                              spacing: { after: 0 }
                          })),
                      }),
                  ],
              }),
          ],
      });
      ssicParagraphs.push(ssicTable);
  }

  // --- MOA/MOU Header ---
  const moaHeaderParagraphs: (Paragraph | Table)[] = [];
  if (isMoaOrMou) {
    // Side-by-Side Activity Header
    const headerTable = new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
            top: { style: BorderStyle.NONE, size: 0, color: "auto" },
            bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
            left: { style: BorderStyle.NONE, size: 0, color: "auto" },
            right: { style: BorderStyle.NONE, size: 0, color: "auto" },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
            insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
        },
        rows: [
            new TableRow({
                children: [
                    // Left Column (Activity B / Junior)
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: [
                            new Paragraph({ children: [new TextRun({ text: (moaData.juniorSigner?.activitySymbol || moaData.activityB || '').toUpperCase(), font, size: FONT_SIZE_BODY })], spacing: { after: 0 } }),
                            ...(moaData.activityBHeader?.ssic ? [new Paragraph({ children: [new TextRun({ text: moaData.activityBHeader.ssic, font, size: FONT_SIZE_BODY })], spacing: { after: 0 } })] : []),
                            ...(moaData.activityBHeader?.serial ? [new Paragraph({ children: [new TextRun({ text: moaData.activityBHeader.serial, font, size: FONT_SIZE_BODY })], spacing: { after: 0 } })] : []),
                            ...(moaData.activityBHeader?.date ? [new Paragraph({ children: [new TextRun({ text: moaData.activityBHeader.date, font, size: FONT_SIZE_BODY })], spacing: { after: 0 } })] : []),
                        ],
                    }),
                    // Right Column (Activity A / Senior) - Nested table for Flush Right alignment
                    new TableCell({
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        children: [
                            new Table({
                                width: { size: 0, type: WidthType.AUTO },
                                alignment: AlignmentType.RIGHT,
                                borders: {
                                    top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                    insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                },
                                rows: [
                                    new TableRow({
                                        children: [
                                            new TableCell({
                                                width: { size: 0, type: WidthType.AUTO },
                                                borders: {
                                                    top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                                    bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                                    left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                                    right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                                                },
                                                children: [
                                                    new Paragraph({ children: [new TextRun({ text: (moaData.seniorSigner?.activitySymbol || moaData.activityA || '').toUpperCase(), font, size: FONT_SIZE_BODY })], spacing: { after: 0 } }),
                                                    ...(moaData.activityAHeader?.ssic ? [new Paragraph({ children: [new TextRun({ text: moaData.activityAHeader.ssic, font, size: FONT_SIZE_BODY })], spacing: { after: 0 } })] : []),
                                                    ...(moaData.activityAHeader?.serial ? [new Paragraph({ children: [new TextRun({ text: moaData.activityAHeader.serial, font, size: FONT_SIZE_BODY })], spacing: { after: 0 } })] : []),
                                                    ...(moaData.activityAHeader?.date ? [new Paragraph({ children: [new TextRun({ text: moaData.activityAHeader.date, font, size: FONT_SIZE_BODY })], spacing: { after: 0 } })] : []),
                                                ],
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
    
    moaHeaderParagraphs.push(headerTable);
    moaHeaderParagraphs.push(createEmptyLine(font));

    moaHeaderParagraphs.push(new Paragraph({
      children: [new TextRun({ text: formData.documentType === 'moa' ? 'MEMORANDUM OF AGREEMENT' : 'MEMORANDUM OF UNDERSTANDING', font, size: FONT_SIZE_BODY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120, before: 0 }
    }));
    moaHeaderParagraphs.push(new Paragraph({
      children: [new TextRun({ text: 'BETWEEN', font, size: FONT_SIZE_BODY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 }
    }));
    moaHeaderParagraphs.push(new Paragraph({
      children: [new TextRun({ text: (moaData.activityA || '').toUpperCase(), font, size: FONT_SIZE_BODY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 }
    }));
    moaHeaderParagraphs.push(new Paragraph({
      children: [new TextRun({ text: 'AND', font, size: FONT_SIZE_BODY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 }
    }));
    moaHeaderParagraphs.push(new Paragraph({
      children: [new TextRun({ text: (moaData.activityB || '').toUpperCase(), font, size: FONT_SIZE_BODY })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 0 }
    }));
    
    // Add Subj line using standard formatting
    const subjLabel = getSubjSpacing(formData.bodyFont);
    const subjLines = splitSubject((formData.subj || '').toUpperCase(), 57);
    
    subjLines.forEach((line, index) => {
      let children: TextRun[] = [];
      if (index === 0) {
          children = [
              new TextRun({ text: subjLabel, font, size: FONT_SIZE_BODY }),
              new TextRun({ text: line, font, size: FONT_SIZE_BODY }),
          ];
      } else {
          if (formData.bodyFont === 'courier') {
              children = [
                  new TextRun({ text: '       ' + line, font, size: FONT_SIZE_BODY }),
              ];
          } else {
              children = [
                  new TextRun({ text: "\t" + line, font, size: FONT_SIZE_BODY }),
              ];
          }
      }

      moaHeaderParagraphs.push(new Paragraph({
        children,
        tabStops: [{ type: TabStopType.LEFT, position: tabPosition }],
        indent: isDirective ? subjectIndent : undefined,
        spacing: { before: index === 0 ? 240 : 0 } // Add space before first line
      }));
    });
    
    // Empty line after subject - same as standard letter
    moaHeaderParagraphs.push(createEmptyLine(font));
  }

  // --- Staffing Paper Header ---
  const staffingHeaderParagraphs: Paragraph[] = [];
  if (isStaffingPaper) {
      const title = isPositionPaper ? 'POSITION PAPER'
        : isDecisionPaper ? 'DECISION PAPER'
        : 'INFORMATION PAPER';

      staffingHeaderParagraphs.push(new Paragraph({
          children: [new TextRun({
              text: title,
              font,
              bold: !isPositionPaper,
              size: FONT_SIZE_BODY,
              underline: { type: UnderlineType.SINGLE }
          })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 120 }
      }));
      
      // Removed "ON" paragraph to match MCO 5216.20A and PDF preview
      
      // Removed Duplicate Bold Subject Line
      // Standard Subject is handled below via logic or manually added if needed.
      // However, for staffing papers, we usually want "Subj: ..." (regular).
      // If we remove the bold one, we should ensure the regular one is present.
      // The code below adds "Subj:" for !isStaffingPaper. 
      // We need to add a non-bold "Subj:" for Staffing Paper if it's not handled elsewhere.
      
      // If it's a Position Paper, we typically don't center "Subj:".
      // Position Paper Format:
      // TITLE (Underlined)
      // Subj: TITLE (Regular, Left Aligned or Block)
      // Wait, MCO 5216.20B Figure 13-3 shows "Subj:" left aligned (tabbed) if it's part of the standard block?
      // Actually, looking at the user image, "Subj:" is left-aligned.
      // My previous code was CENTER aligning it.
      
      if (isPositionPaper || isDecisionPaper) {
         staffingHeaderParagraphs.push(new Paragraph({
            children: [
                new TextRun({ text: "Subj: ", font, size: FONT_SIZE_BODY }),
                new TextRun({ text: (formData.subj || '').toUpperCase(), font, size: FONT_SIZE_BODY })
            ],
            // Use standard subject indentation (usually hanging or tabbed)
            // But for now, simple left alignment to match "1. Purpose"
            indent: { left: 0 }, 
            alignment: AlignmentType.LEFT,
            spacing: { after: 480 } 
         }));
      } else {
         // Information Paper Subject (Centered)
         staffingHeaderParagraphs.push(new Paragraph({
             children: [new TextRun({ 
                text: `Subj: ${formData.subj ? formData.subj.toUpperCase() : ''}`, 
                font, 
                size: FONT_SIZE_BODY,
                bold: false 
             })],
             alignment: AlignmentType.CENTER,
             spacing: { after: 480 } 
         }));
      }
  }

  // --- Business Letter Header (Inside Address, Salutation) ---
  const businessHeaderParagraphs: Paragraph[] = [];
  if (isBusinessLetter) {
      // 1. Inside Address (Flush Left, after SSIC/Date)
      // Spacing for Window Envelope (approx 2" from top vs 1" standard)
      // We add extra spacing before the address block if window envelope.
      if (formData.isWindowEnvelope) {
          businessHeaderParagraphs.push(new Paragraph({
              text: "",
              spacing: { before: 1600, after: 0 } // ~1.1 inches extra spacing
          }));
      } else {
           // Standard spacing
           businessHeaderParagraphs.push(createEmptyLine(font)); 
      }
      
      if (formData.recipientName) {
          businessHeaderParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.recipientName, font, size: FONT_SIZE_BODY })],
              alignment: AlignmentType.LEFT,
              spacing: { after: 0 }
          }));
      }

      if (formData.recipientTitle) {
          businessHeaderParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.recipientTitle, font, size: FONT_SIZE_BODY })],
              alignment: AlignmentType.LEFT,
              spacing: { after: 0 }
          }));
      }

      if (formData.businessName) {
          businessHeaderParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.businessName, font, size: FONT_SIZE_BODY })],
              alignment: AlignmentType.LEFT,
              spacing: { after: 0 }
          }));
      }
      
      if (formData.recipientAddress) {
          const addressLines = formData.recipientAddress.split('\n');
          addressLines.forEach((line: string) => {
              businessHeaderParagraphs.push(new Paragraph({
                  children: [new TextRun({ text: line, font, size: FONT_SIZE_BODY })],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0 }
          }));
          });
      }

      // Attention Line
      if (formData.attentionLine) {
           businessHeaderParagraphs.push(createEmptyLine(font));
           businessHeaderParagraphs.push(new Paragraph({
               children: [new TextRun({ text: `Attention: ${formData.attentionLine}`, font, size: FONT_SIZE_BODY })],
               alignment: AlignmentType.LEFT,
               spacing: { after: 0 }
           }));
      }
      
      // 2. Salutation (Flush Left, after Inside Address)
      // Add space after Address
      businessHeaderParagraphs.push(createEmptyLine(font));
      
      if (formData.salutation) {
          businessHeaderParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.salutation, font, size: FONT_SIZE_BODY })],
              alignment: AlignmentType.LEFT,
              spacing: { after: 0 }
          }));
      }

      // 3. Subject Line (Optional for Business Letters, appears after Salutation)
      if (formData.subj) {
          businessHeaderParagraphs.push(createEmptyLine(font));
          // Use smaller indent/tab for Business Letters (approx 0.86 inch / 1240 twips)
          const subjIndent = 1240; 
          businessHeaderParagraphs.push(new Paragraph({
              children: [
                  new TextRun({ text: "SUBJECT:\t", font, size: FONT_SIZE_BODY }),
                  new TextRun({ text: formData.subj.toUpperCase(), font, size: FONT_SIZE_BODY })
              ],
              alignment: AlignmentType.LEFT,
              tabStops: [
                  { type: TabStopType.LEFT, position: subjIndent } 
              ],
              indent: {
                  left: subjIndent,   
                  hanging: subjIndent 
              },
              spacing: { after: 0 }
          }));
      }
      
      // Add space after Salutation/Subject before body
      businessHeaderParagraphs.push(createEmptyLine(font));
  }

  // --- Executive Letter Header (Inside Address, Salutation) ---
  if (isExecLetter) {
      businessHeaderParagraphs.push(createEmptyLine(font));

      if (formData.recipientName) {
          businessHeaderParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.recipientName, font, size: FONT_SIZE_BODY })],
              alignment: AlignmentType.LEFT,
              spacing: { after: 0 }
          }));
      }
      if (formData.recipientTitle) {
          businessHeaderParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.recipientTitle, font, size: FONT_SIZE_BODY })],
              alignment: AlignmentType.LEFT,
              spacing: { after: 0 }
          }));
      }
      if (formData.organizationName) {
          businessHeaderParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.organizationName, font, size: FONT_SIZE_BODY })],
              alignment: AlignmentType.LEFT,
              spacing: { after: 0 }
          }));
      }
      if (formData.recipientAddress) {
          formData.recipientAddress.split('\n').forEach((line: string) => {
              businessHeaderParagraphs.push(new Paragraph({
                  children: [new TextRun({ text: line, font, size: FONT_SIZE_BODY })],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0 }
              }));
          });
      }
      businessHeaderParagraphs.push(createEmptyLine(font));
      if (formData.salutation) {
          businessHeaderParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.salutation, font, size: FONT_SIZE_BODY })],
              alignment: AlignmentType.LEFT,
              spacing: { after: 0 }
          }));
      }
      if (formData.subj) {
          businessHeaderParagraphs.push(createEmptyLine(font));
          businessHeaderParagraphs.push(new Paragraph({
              children: [
                  new TextRun({ text: "SUBJECT:\t", font, size: FONT_SIZE_BODY }),
                  new TextRun({ text: formData.subj, font, size: FONT_SIZE_BODY })
              ],
              alignment: AlignmentType.LEFT,
              spacing: { after: 0 }
          }));
      }
      businessHeaderParagraphs.push(createEmptyLine(font));
  }

  // --- Endorsement Identification Line (between date and From) ---
  const endorsementParagraphs: Paragraph[] = [];
  if (formData.documentType === 'endorsement' && formData.endorsementLevel && formData.basicLetterReference) {
    const endorsementText = `${formData.endorsementLevel} ENDORSEMENT on ${formData.basicLetterReference}`;
    endorsementParagraphs.push(new Paragraph({
      children: [new TextRun({ text: endorsementText, font, size: FONT_SIZE_BODY })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 0 }
    }));
    // Add hard return/space after endorsement line before "From:"
    endorsementParagraphs.push(createEmptyLine(font));
  }

  // --- Directive Title Line (between date and From for MCO/Bulletin) ---
  const directiveTitleParagraphs: Paragraph[] = [];
  if (isDirective && (formData.directiveTitle || formData.ssic)) {
    directiveTitleParagraphs.push(new Paragraph({
      children: [new TextRun({
        text: (formData.directiveTitle || buildDirectiveTitle(formData)).toUpperCase(),
        font,
        size: FONT_SIZE_BODY,
        underline: { type: UnderlineType.SINGLE }
      })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 240 }
    }));
  }

  // --- From/To/Via ---
  const addressParagraphs: Paragraph[] = [];
  
  if (formData.documentType === 'mfr') {
    // MFR: No From/To/Via, just the title
    addressParagraphs.push(createEmptyLine(font)); // One blank line so Title is 2 lines below Date
    addressParagraphs.push(new Paragraph({
      children: [new TextRun({ 
        text: "MEMORANDUM FOR THE RECORD", 
        font, 
        size: FONT_SIZE_BODY
      })],
      alignment: AlignmentType.LEFT,
      spacing: { after: 240 } // Double space after title
    }));
  } else if (isDLAMemo) {
    // DLA Memorandum: MEMORANDUM FOR / THROUGH / SUBJECT
    addressParagraphs.push(new Paragraph({
      children: [
        new TextRun({ text: 'MEMORANDUM FOR', font, size: FONT_SIZE_BODY }),
        new TextRun({ text: '\t' + (formData.memorandumFor || ''), font, size: FONT_SIZE_BODY }),
      ],
      tabStops: [{ type: TabStopType.LEFT, position: tabPosition }],
      spacing: { after: addressSpacing },
    }));

    if (formData.through) {
      addressParagraphs.push(new Paragraph({
        children: [
          new TextRun({ text: 'THROUGH', font, size: FONT_SIZE_BODY }),
          new TextRun({ text: '\t' + formData.through, font, size: FONT_SIZE_BODY }),
        ],
        tabStops: [{ type: TabStopType.LEFT, position: tabPosition }],
        spacing: { after: addressSpacing },
      }));
    }

    // Subject for DLA Memo — Title Case per DLA Corr Manual Ch.3 Para 8
    addressParagraphs.push(createEmptyLine(font));
    addressParagraphs.push(new Paragraph({
      children: [
        new TextRun({ text: 'SUBJECT:', font, size: FONT_SIZE_BODY }),
        new TextRun({ text: '\t' + (formData.subj || ''), font, size: FONT_SIZE_BODY }),
      ],
      tabStops: [{ type: TabStopType.LEFT, position: tabPosition }],
      spacing: { after: 240 },
    }));
  } else if (isDLABusinessLetter) {
    // DLA Business Letter: Inside Address + Salutation + Subject
    if (formData.recipientName) {
      addressParagraphs.push(new Paragraph({
        children: [new TextRun({ text: formData.recipientName, font, size: FONT_SIZE_BODY })],
        spacing: { after: 0 },
      }));
    }
    if (formData.recipientTitle) {
      addressParagraphs.push(new Paragraph({
        children: [new TextRun({ text: formData.recipientTitle, font, size: FONT_SIZE_BODY })],
        spacing: { after: 0 },
      }));
    }
    if (formData.businessName) {
      addressParagraphs.push(new Paragraph({
        children: [new TextRun({ text: formData.businessName, font, size: FONT_SIZE_BODY })],
        spacing: { after: 0 },
      }));
    }
    if (formData.recipientAddress) {
      (formData.recipientAddress as string).split('\n').forEach((line: string) => {
        addressParagraphs.push(new Paragraph({
          children: [new TextRun({ text: line, font, size: FONT_SIZE_BODY })],
          spacing: { after: 0 },
        }));
      });
    }
    addressParagraphs.push(createEmptyLine(font));
    addressParagraphs.push(new Paragraph({
      children: [new TextRun({ text: formData.salutation || 'Dear Sir or Madam:', font, size: FONT_SIZE_BODY })],
      spacing: { after: 240 },
    }));

    if (formData.subj) {
      addressParagraphs.push(new Paragraph({
        children: [
          new TextRun({ text: 'SUBJECT:', font, size: FONT_SIZE_BODY }),
          new TextRun({ text: '\t' + (formData.subj || '').toUpperCase(), font, size: FONT_SIZE_BODY }),
        ],
        tabStops: [{ type: TabStopType.LEFT, position: tabPosition }],
        spacing: { after: 240 },
      }));
    }
  } else if (!isMoaOrMou && !isStaffingPaper && !isCivilianStyle) {
    // Standard Letter / Directive: From/To/Via

    // Letterhead Memorandum Title
     if (formData.documentType === 'letterhead-memo') {
        addressParagraphs.push(new Paragraph({
           children: [new TextRun({ 
             text: "MEMORANDUM", 
             font, 
             size: FONT_SIZE_BODY
           })],
           alignment: AlignmentType.LEFT,
           spacing: { after: 240 } // Double space
        }));
     }
    
    // From-To Memorandum Title
    if (formData.documentType === 'from-to-memo') {
      addressParagraphs.push(createEmptyLine(font));
      addressParagraphs.push(createEmptyLine(font));
      addressParagraphs.push(new Paragraph({
        children: [new TextRun({ 
          text: "MEMORANDUM", 
          font, 
          size: FONT_SIZE_BODY
        })],
        alignment: AlignmentType.LEFT,
        spacing: { after: 240 }
      }));
    }

    // Standard Letter / Directive: From/To/Via
    
    // From
    const fromLabel = getFromToSpacing('From', formData.bodyFont);
    addressParagraphs.push(new Paragraph({
      children: [
        new TextRun({ text: fromLabel, font, size: FONT_SIZE_BODY }),
        new TextRun({ text: formData.from || "Commanding Officer", font, size: FONT_SIZE_BODY }),
      ],
      tabStops: [{ type: TabStopType.LEFT, position: tabPosition }],
      indent: isDirective ? addressIndent : undefined,
      spacing: { after: addressSpacing },
    }));

    // To & Via Logic (Handles Multiple-Address and From-To Memo vs Standard)
    const hasMultipleTo = formData.documentType === 'multiple-address' || formData.documentType === 'from-to-memo';
    const isToDistribution = hasMultipleTo && !!formData.distribution?.toDistribution;
    if (hasMultipleTo) {
       const recipients = formData.distribution?.recipients || (formData.to ? [formData.to] : ["Addressee"]);
       const recipientsWithContent = recipients.filter((r: string) => r && r.trim());

       if (recipientsWithContent.length === 0) recipientsWithContent.push("Addressee");

       if (isToDistribution) {
          // "To Distribution" toggle ON: To line says "Distribution"
          const toLabel = getFromToSpacing('To', formData.bodyFont as 'times' | 'courier');
          addressParagraphs.push(new Paragraph({
             children: [
                new TextRun({ text: toLabel, font, size: FONT_SIZE_BODY }),
                new TextRun({ text: "Distribution", font, size: FONT_SIZE_BODY }),
             ],
             tabStops: [{ type: TabStopType.LEFT, position: tabPosition }],
             indent: isDirective ? addressIndent : undefined,
             spacing: { after: addressSpacing },
          }));
       } else {
          // Toggle OFF: list recipients directly under To
          recipientsWithContent.forEach((recipient: string, index: number) => {
              let children: TextRun[] = [];

              if (index === 0) {
                 const toLabel = getFromToSpacing('To', formData.bodyFont as 'times' | 'courier');
                 children = [
                    new TextRun({ text: toLabel, font, size: FONT_SIZE_BODY }),
                    new TextRun({ text: recipient, font, size: FONT_SIZE_BODY }),
                 ];
              } else {
                 // Subsequent lines align with the first recipient
                 // For Courier, align with spaces. For Times, use tab.
                 const prefix = formData.bodyFont === 'courier' ? '       ' : '\t';
                 children = [
                    new TextRun({ text: prefix + recipient, font, size: FONT_SIZE_BODY }),
                 ];
              }

              addressParagraphs.push(new Paragraph({
                  children,
                  tabStops: [{ type: TabStopType.LEFT, position: tabPosition }],
                  indent: isDirective ? addressIndent : undefined,
                  spacing: { after: index === recipientsWithContent.length - 1 ? addressSpacing : 0 },
              }));
          });
       }

    } else if (!isSecnav) {
        // Standard To. P4.3: SECNAV directives carry no To line —
        // mandatory fields are From/Subj only (SECNAV M-5215.1;
        // audit line 82).
        const toLabel = getFromToSpacing('To', formData.bodyFont);
        addressParagraphs.push(new Paragraph({
          children: [
            new TextRun({ text: toLabel, font, size: FONT_SIZE_BODY }),
            new TextRun({ text: formData.to || "Addressee", font, size: FONT_SIZE_BODY }),
          ],
          tabStops: [{ type: TabStopType.LEFT, position: tabPosition }],
          indent: isDirective ? addressIndent : undefined,
          spacing: { after: addressSpacing },
        }));
    }

    // Via
    {
        const viasWithContent = vias.filter(v => v.trim());
        if (viasWithContent.length > 0) {
          viasWithContent.forEach((via, index) => {
              const viaLabel = getViaSpacing(index, formData.bodyFont, viasWithContent.length);
              const children = [
                  new TextRun({ text: viaLabel, font, size: FONT_SIZE_BODY }),
                  new TextRun({ text: via, font, size: FONT_SIZE_BODY }),
              ];

              let tabs: any[] = [];
              if (formData.bodyFont === 'courier') {
                   // Courier doesn't use tabs for alignment in the same way, but let's keep it consistent with legacy if needed
              } else {
                   // Times
                   if (viasWithContent.length > 1) {
                       tabs = [
                          { type: TabStopType.LEFT, position: 720 },
                          { type: TabStopType.LEFT, position: 1046 }
                       ];
                   } else {
                       tabs = [{ type: TabStopType.LEFT, position: 720 }];
                   }
              }

              addressParagraphs.push(new Paragraph({
                  children,
                  tabStops: tabs.length > 0 ? tabs : [{ type: TabStopType.LEFT, position: tabPosition }],
                  indent: isDirective ? addressIndent : undefined,
                  spacing: { after: addressSpacing },
              }));
          });
        }
    }
  }

  // --- Subject ---
  if (!isMoaOrMou && !isStaffingPaper && !isCivilianStyle) {
    addressParagraphs.push(createEmptyLine(font));
    
    const subjLabel = getSubjSpacing(formData.bodyFont);
    const subjLines = splitSubject((formData.subj || '').toUpperCase(), 57);
    
    subjLines.forEach((line, index) => {
      let children: TextRun[] = [];
      if (index === 0) {
          children = [
              new TextRun({ text: subjLabel, font, size: FONT_SIZE_BODY }),
              new TextRun({ text: line, font, size: FONT_SIZE_BODY }),
          ];
      } else {
          if (formData.bodyFont === 'courier') {
              children = [
                  new TextRun({ text: '       ' + line, font, size: FONT_SIZE_BODY }),
              ];
          } else {
              children = [
                  new TextRun({ text: "\t" + line, font, size: FONT_SIZE_BODY }),
              ];
          }
      }

      addressParagraphs.push(new Paragraph({
        children,
        tabStops: [{ type: TabStopType.LEFT, position: tabPosition }],
        indent: isDirective ? subjectIndent : undefined,
      }));
    });

    addressParagraphs.push(createEmptyLine(font));
  }

  // --- References ---
  const refParagraphs: Paragraph[] = [];
  const refs = references.filter(r => r.trim());
  if (refs.length > 0 && !isStaffingPaper) {
    const startCharCode = (formData.startingReferenceLevel || 'a').charCodeAt(0);
    
    refs.forEach((ref, index) => {
      const letter = String.fromCharCode(startCharCode + index);
      const refLabel = getRefSpacing(letter, index, formData.bodyFont);
      
      let refIndent;
      if (isDirective) {
          refIndent = addressIndent;
      } else if (formData.bodyFont === 'courier') {
          refIndent = { left: 1584, hanging: 1584 };
      } else {
          refIndent = { left: 1080, hanging: 1080 };
      }

      refParagraphs.push(new Paragraph({
        children: [
          new TextRun({ text: refLabel, font, size: FONT_SIZE_BODY }),
          new TextRun({ text: ref, font, size: FONT_SIZE_BODY }),
        ],
        tabStops: [{ type: TabStopType.LEFT, position: tabPosition }],
        indent: refIndent,
      }));
    });
    refParagraphs.push(createEmptyLine(font));
  }

  // --- Enclosures ---
  const enclParagraphs: Paragraph[] = [];
  const encls = enclosures.filter(e => e.trim());
  if (encls.length > 0 && !isStaffingPaper) {
    if (isDLAType) {
        // DLA uses "Attachments" (not "Enclosures") per DLA Corr Manual Ch.3 Para 19
        const label = encls.length > 1 ? "Attachments:" : "Attachment:";
        enclParagraphs.push(new Paragraph({
            children: [new TextRun({ text: label, font, size: FONT_SIZE_BODY })],
            alignment: AlignmentType.LEFT,
            spacing: { after: 0 }
        }));

        encls.forEach((encl, index) => {
            const text = encls.length > 1 ? `${index + 1}.  ${encl}` : encl;
            enclParagraphs.push(new Paragraph({
                children: [new TextRun({ text, font, size: FONT_SIZE_BODY })],
                alignment: AlignmentType.LEFT,
                spacing: { after: 0 }
            }));
        });
        enclParagraphs.push(createEmptyLine(font));
    } else if (isCivilianStyle) {
        // Business/Executive Letter Enclosures (Flush Left)
        const label = encls.length > 1 ? "Enclosures" : "Enclosure";
        enclParagraphs.push(new Paragraph({
            children: [new TextRun({ text: label, font, size: FONT_SIZE_BODY })],
            alignment: AlignmentType.LEFT,
            spacing: { after: 0 }
        }));

        encls.forEach(encl => {
            enclParagraphs.push(new Paragraph({
                children: [new TextRun({ text: encl, font, size: FONT_SIZE_BODY })],
                alignment: AlignmentType.LEFT,
                spacing: { after: 0 }
            }));
        });
        enclParagraphs.push(createEmptyLine(font));
    } else {
        // Standard Naval Enclosures
        const startNum = parseInt(formData.startingEnclosureNumber || '1', 10);
        
        encls.forEach((encl, index) => {
            const num = startNum + index;
            const enclLabel = getEnclSpacing(num, index, formData.bodyFont);
            
            let enclIndent;
            if (isDirective) {
                enclIndent = addressIndent;
            } else if (formData.bodyFont === 'courier') {
                enclIndent = { left: 1584, hanging: 1584 };
            } else {
                enclIndent = { left: 1080, hanging: 1080 };
            }

            enclParagraphs.push(new Paragraph({
                children: [
                new TextRun({ text: enclLabel, font, size: FONT_SIZE_BODY }),
                new TextRun({ text: encl, font, size: FONT_SIZE_BODY }),
                ],
                tabStops: [{ type: TabStopType.LEFT, position: tabPosition }],
                indent: enclIndent,
            }));
        });
        enclParagraphs.push(createEmptyLine(font));
    }
  }

  // --- Body Paragraphs ---
  const bodyParagraphs: (Paragraph | Table)[] = [];
  const paragraphsWithContent = paragraphs.filter(p => p.content.trim() || p.title);

  // Correspondence: paragraph indents come from the relative engine
  // (SECNAV M-5216.5 Fig 7-8, content-relative). Directives (P3.2):
  // fixed 4-space Courier ladder from FixedLadderEngine (MCO 5215.1K
  // para 33) — same character columns the Courier render path emits,
  // now sourced from the engine. Message formats keep dedicated paths.
  const relativeSpecs = isCorrespondenceType(formData.documentType)
    ? relativeIndentEngine.computeSpecs(
        paragraphsWithContent,
        formData.bodyFont === 'courier' ? 'courier' : 'times'
      )
    : isDirectiveType(formData.documentType)
      ? fixedLadderEngine.computeSpecs(paragraphsWithContent, 'courier')
      : undefined;

  paragraphsWithContent.forEach((p, index) => {
    // Custom handling for Position/Decision Paper Multiple Recs - Paragraph 4
    if ((isPositionPaper || isDecisionPaper) &&
        formData.decisionMode === 'MULTIPLE_RECS' &&
        (index === 3 || (p.title && p.title.toLowerCase().includes('recommendation')))) {

        // 1. Header: 4. Recommendation.
        const { citation } = generateCitation(p, index, paragraphsWithContent);
        bodyParagraphs.push(new Paragraph({
             children: [
                 new TextRun({ text: citation + "\t", font, size: FONT_SIZE_BODY }),
                 new TextRun({ text: (p.title || 'Recommendation') + ".", font, size: FONT_SIZE_BODY })
             ],
             tabStops: [{ type: TabStopType.LEFT, position: 720 }],
             spacing: { after: 120 }
        }));

        // 2. Iterate Recommendation Items
        formData.decisionGrid?.recommendationItems?.forEach((item: { id: string; text: string }, itemIdx: number) => {
             // a. Text
             const itemLetter = String.fromCharCode(97 + itemIdx);
             bodyParagraphs.push(new Paragraph({
                 children: [
                     new TextRun({ text: itemLetter + ".\t", font, size: FONT_SIZE_BODY }),
                     new TextRun({ text: item.text, font, size: FONT_SIZE_BODY })
                 ],
                 indent: { left: 1080, hanging: 360 }, 
                 tabStops: [{ type: TabStopType.LEFT, position: 1440 }],
                 spacing: { after: 120 }
             }));

             // 3. Grid Table (Embedded)
             const tableRows: TableRow[] = [];
             
             // Recommenders - signature line format per MCO 5216.20B
             formData.decisionGrid?.recommenders.forEach((rec: { id: string; role: string; options: string[] }) => {
                 const optsText = rec.options.map((opt: string) => {
                     let display = opt;
                     if (opt === 'Approve') display = 'Approval';
                     if (opt === 'Disapprove') display = 'Disapproval';
                     return `${display} _______`;
                 }).join("    ");
                 tableRows.push(new TableRow({
                     children: [
                         new TableCell({
                             children: [new Paragraph({ children: [new TextRun({ text: rec.role + " recommends:", font, size: FONT_SIZE_BODY })] })],
                             width: { size: 35, type: WidthType.PERCENTAGE },
                             borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                         }),
                         new TableCell({
                             children: [new Paragraph({ children: [new TextRun({ text: optsText, font, size: FONT_SIZE_BODY })] })],
                             width: { size: 65, type: WidthType.PERCENTAGE },
                             borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                         })
                     ]
                 }));
             });

             // Final Decision - signature line format
             if (formData.decisionGrid?.finalDecision) {
                const finalOptsText = formData.decisionGrid.finalDecision.options.map((opt: string) => {
                    return `${opt} _______`;
                }).join("    ");
                tableRows.push(new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: formData.decisionGrid.finalDecision.role + " decision:", font, size: FONT_SIZE_BODY, bold: true })] })],
                            width: { size: 35, type: WidthType.PERCENTAGE },
                            borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: finalOptsText, font, size: FONT_SIZE_BODY })] })],
                            width: { size: 65, type: WidthType.PERCENTAGE },
                            borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                        })
                    ]
                }));
             }

             bodyParagraphs.push(new Table({
                 rows: tableRows,
                 width: { size: 80, type: WidthType.PERCENTAGE },
                 indent: { size: 1440, type: WidthType.DXA }, 
                 borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" } }
             }));
             bodyParagraphs.push(createEmptyLine(font));
        });

        return; // Skip standard processing for this paragraph
    }

    // DLA paragraph rendering per DLA Corr Manual Ch.3:
    // Level 1: unnumbered, one tab indent; Levels 2-4: a., (1), (a)
    if (isDLAType) {
        const { citation } = generateCitation(p, index, paragraphsWithContent);
        const effectiveLevel = Math.min(p.level, 4); // Max 4 levels (unnumbered + 3 subdivisions)
        const dlaIndentTwips = 720; // ½ inch = 720 twips

        if (effectiveLevel === 1) {
            // Level 1: No number, first-line indent of one tab, text wraps to left margin
            const children: TextRun[] = [];
            if (p.title) {
                children.push(new TextRun({ text: p.title.toUpperCase() + '.  ', font, size: FONT_SIZE_BODY, bold: true }));
            }
            children.push(new TextRun({ text: p.content || '', font, size: FONT_SIZE_BODY }));

            bodyParagraphs.push(new Paragraph({
                children,
                indent: { firstLine: dlaIndentTwips },
                spacing: { after: 240 },
            }));
        } else {
            // Sub-levels (2-4): citation + text at indent position
            const leftIndent = (effectiveLevel - 1) * dlaIndentTwips;
            const children: TextRun[] = [];

            children.push(new TextRun({ text: citation + '\t', font, size: FONT_SIZE_BODY }));
            if (p.title) {
                children.push(new TextRun({ text: p.title.toUpperCase() + '.  ', font, size: FONT_SIZE_BODY, bold: true }));
            }
            children.push(new TextRun({ text: p.content || '', font, size: FONT_SIZE_BODY }));

            bodyParagraphs.push(new Paragraph({
                children,
                indent: { left: leftIndent, hanging: 360 },
                tabStops: [{ type: TabStopType.LEFT, position: leftIndent }],
                spacing: { after: 240 },
            }));
        }

        // Same last-paragraph suppression as the standard branch below.
        if (index !== paragraphsWithContent.length - 1) {
            bodyParagraphs.push(createEmptyLine(font));
        }
    } else {
    // Use the shared formatter logic which correctly handles:
    // 1. Citation generation (1., a., (1), etc.)
    // 2. Tab stops and indentation per SECNAV M-5216.5
    // 3. Bold/Italic parsing
    const shouldBoldTitle = !['mco', 'moa', 'mou', 'information-paper', 'position-paper'].includes(formData.documentType);
    const shouldUppercaseTitle = !['moa', 'mou', 'information-paper', 'position-paper'].includes(formData.documentType);
    const hasNavalSignature = !!formData.sig && !isStaffingPaper &&
        !isDLAMemo && !isDLABusinessLetter && !isCivilianStyle;
    // Business/exec closings also bind to the last body paragraph so
    // the signature page carries text (DLA out of scope per ruling).
    const hasCivilianClosing = isCivilianStyle && !isDLAMemo && !isDLABusinessLetter;
    const keepWithSignature = (hasNavalSignature || hasCivilianClosing) && !!relativeSpecs &&
        index === paragraphsWithContent.length - 1;
    bodyParagraphs.push(createFormattedParagraph(p, index, paragraphsWithContent, font, "000000", isDirective, shouldBoldTitle, shouldUppercaseTitle, isCivilianStyle, formData.isShortLetter, relativeSpecs?.[index], keepWithSignature));

    // Full blank line between body paragraphs (M-5216.5 7-2.13).
    // Suppressed after the LAST paragraph for correspondence: the
    // signature block owns its own three blank lines, so a trailing
    // spacer here would push the signature to the 5th line below the
    // text instead of the 4th (M-5216.5 7-2.16). Directives keep it
    // (5th-line signature, MCO 5215.1K para 37) until Phase 3.
    const isLastParagraph = index === paragraphsWithContent.length - 1;
    if (!(relativeSpecs && isLastParagraph)) {
        bodyParagraphs.push(createEmptyLine(font));
    }
    }
  });

  // Position/Decision Paper Decision Grid (Single & Multiple Choice) - Bottom
  if ((isPositionPaper || isDecisionPaper) && formData.decisionGrid && formData.decisionMode !== 'MULTIPLE_RECS') {
      bodyParagraphs.push(createEmptyLine(font));
      
      if (formData.decisionMode === 'MULTIPLE_CHOICE') {
          // Mode B: Stacked COAs (Vertical)
          formData.decisionGrid.recommenders.forEach((rec: { id: string; role: string; options: string[] }) => {
              const coaRows = rec.options.map((opt: string) =>
                  new Paragraph({
                      children: [
                          new TextRun({ text: opt, font, size: FONT_SIZE_BODY }),
                          new TextRun({ text: "\t", font, size: FONT_SIZE_BODY }),
                          new TextRun({ text: "_______", font, size: FONT_SIZE_BODY }) // Underscore for signature
                      ],
                      tabStops: [{ type: TabStopType.LEFT, position: 1440 }],
                      spacing: { after: 120 }
                  })
              );

              const row = new TableRow({
                  children: [
                      new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: rec.role + " recommends:", font, size: FONT_SIZE_BODY })] })],
                          width: { size: 40, type: WidthType.PERCENTAGE },
                          verticalAlign: VerticalAlign.TOP,
                          borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                      }),
                      new TableCell({
                          children: coaRows,
                          width: { size: 60, type: WidthType.PERCENTAGE },
                          borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                      })
                  ]
              });
              
              bodyParagraphs.push(new Table({
                  rows: [row],
                  width: { size: 90, type: WidthType.PERCENTAGE },
                  indent: { size: 720, type: WidthType.DXA },
                  borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" } }
              }));
              bodyParagraphs.push(createEmptyLine(font));
          });

          // Final Decision - use finalDecision.options directly (includes COAs + Disapprove per policy)
          if (formData.decisionGrid.finalDecision) {
              const final = formData.decisionGrid.finalDecision;

              const coaRows = final.options.map((opt: string) =>
                  new Paragraph({
                      children: [
                          new TextRun({ text: opt, font, size: FONT_SIZE_BODY }),
                          new TextRun({ text: "\t", font, size: FONT_SIZE_BODY }),
                          new TextRun({ text: "_______", font, size: FONT_SIZE_BODY })
                      ],
                      tabStops: [{ type: TabStopType.LEFT, position: 1440 }],
                      spacing: { after: 120 }
                  })
              );

              const row = new TableRow({
                  children: [
                      new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: final.role + " decision:", font, size: FONT_SIZE_BODY, bold: true })] })],
                          width: { size: 40, type: WidthType.PERCENTAGE },
                          verticalAlign: VerticalAlign.TOP,
                          borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                      }),
                      new TableCell({
                          children: coaRows,
                          width: { size: 60, type: WidthType.PERCENTAGE },
                          borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                      })
                  ]
              });

              bodyParagraphs.push(new Table({
                  rows: [row],
                  width: { size: 90, type: WidthType.PERCENTAGE },
                  indent: { size: 720, type: WidthType.DXA },
                  borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" } }
              }));
          }

      } else {
          // Mode A: Single Recommendation - signature line format per MCO 5216.20B
          // Recommenders: "Role recommends:   Approval _______ Disapproval _______"
          formData.decisionGrid.recommenders.forEach((rec: { id: string; role: string; options: string[] }) => {
              const optionsText = rec.options.map((opt: string) => {
                  let display = opt;
                  if (opt === 'Approve') display = 'Approval';
                  if (opt === 'Disapprove') display = 'Disapproval';
                  return `${display} _______`;
              }).join("    ");

              bodyParagraphs.push(new Paragraph({
                  children: [
                      new TextRun({ text: rec.role + " recommends:\t", font, size: FONT_SIZE_BODY }),
                      new TextRun({ text: optionsText, font, size: FONT_SIZE_BODY })
                  ],
                  tabStops: [{ type: TabStopType.LEFT, position: 2880 }],
                  spacing: { after: 120 },
                  indent: { left: 720 }
              }));
          });

          // Final Decision: "Role decision:   Approved _______ Disapproved _______"
          if (formData.decisionGrid.finalDecision) {
              const finalOptsText = formData.decisionGrid.finalDecision.options.map((opt: string) => {
                  return `${opt} _______`;
              }).join("    ");
              bodyParagraphs.push(new Paragraph({
                  children: [
                      new TextRun({ text: formData.decisionGrid.finalDecision.role + " decision:\t", font, size: FONT_SIZE_BODY }),
                      new TextRun({ text: finalOptsText, font, size: FONT_SIZE_BODY })
                  ],
                  tabStops: [{ type: TabStopType.LEFT, position: 2880 }],
                  spacing: { before: 240, after: 120 },
                  indent: { left: 720 }
              }));
          }
      }
      
      bodyParagraphs.push(createEmptyLine(font));
  }

  // --- Reports Required (Directives) ---
  // P3.7 — Reports Required (MCO 5216.20B par. 29b/29c; audit line
  // 142): up to 4 reports list in the heading block on the
  // promulgation page; 5 or more move to a dedicated Reports Required
  // page immediately after the signature page, with a referral line
  // in the heading block. Mirrors the PDF implementation verbatim.
  const toRomanNumeral = (n: number): string => {
    const map: [number, string][] = [[10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
    let result = '';
    for (const [value, numeral] of map) {
      while (n >= value) { result += numeral; n -= value; }
    }
    return result;
  };

  const reportsParagraphs: Paragraph[] = [];
  const reportsPageParagraphs: Paragraph[] = [];
  const hasReportsParagraph = paragraphs.some(p => p.content.includes('Reports Required'));
  const validReports = (formData.reports ?? []).filter((r: { title: string }) => r.title);

  if (isDirective && validReports.length > 0 && !hasReportsParagraph) {
    const plural = validReports.length > 1;
    const label = `Report${plural ? 's' : ''} Required:`;

    if (validReports.length <= 4) {
      validReports.forEach((report: { title: string; controlSymbol?: string; paragraphRef?: string; exempt?: boolean }, idx: number) => {
        const numeral = plural ? `${toRomanNumeral(idx + 1).toUpperCase()}. ` : '';
        const controlText = report.exempt ? 'EXEMPT' : (report.controlSymbol ? `Report Control Symbol ${report.controlSymbol}` : '');
        const parRef = report.paragraphRef ? `, par. ${report.paragraphRef}` : '';
        const reportText = `${report.title}${controlText ? ` (${controlText})` : ''}${parRef}`;
        reportsParagraphs.push(new Paragraph({
          children: [
            new TextRun({ text: idx === 0 ? `${label} ` : '', font, size: FONT_SIZE_BODY }),
            new TextRun({ text: `${numeral}${reportText}`, font, size: FONT_SIZE_BODY }),
          ],
          indent: idx === 0 ? undefined : { left: 1440 },
          spacing: { after: 0 },
        }));
      });
      reportsParagraphs.push(createEmptyLine(font));
    } else {
      // Referral in the heading block.
      reportsParagraphs.push(new Paragraph({
        children: [new TextRun({ text: 'Reports Required: See page following signature page.', font, size: FONT_SIZE_BODY })],
        spacing: { after: 0 },
      }));
      reportsParagraphs.push(createEmptyLine(font));

      // Dedicated page after the signature page.
      reportsPageParagraphs.push(new Paragraph({
        children: [new TextRun({ text: 'Reports Required', font, size: FONT_SIZE_BODY })],
        alignment: AlignmentType.CENTER,
        pageBreakBefore: true,
        spacing: { after: 480 },
      }));
      reportsPageParagraphs.push(new Paragraph({
        children: [new TextRun({ text: 'REPORT TITLE\tREPORT CONTROL SYMBOL\tPARAGRAPH', font, size: FONT_SIZE_BODY })],
        tabStops: [
          { type: TabStopType.LEFT, position: 5040 },
          { type: TabStopType.LEFT, position: 7920 },
        ],
        spacing: { after: 240 },
      }));
      validReports.forEach((report: { title: string; controlSymbol?: string; paragraphRef?: string; exempt?: boolean }, idx: number) => {
        reportsPageParagraphs.push(new Paragraph({
          children: [new TextRun({
            text: `${toRomanNumeral(idx + 1).toUpperCase()}. ${report.title}\t${report.exempt ? 'EXEMPT' : (report.controlSymbol || '')}\t${report.paragraphRef || ''}`,
            font, size: FONT_SIZE_BODY,
          })],
          tabStops: [
            { type: TabStopType.LEFT, position: 5040 },
            { type: TabStopType.LEFT, position: 7920 },
          ],
          spacing: { after: 120 },
        }));
      });
    }
  }

  // --- Decision Grid (Position Paper) ---
  const decisionGridParagraphs: Paragraph[] = [];
  if (formData.documentType === 'position-paper' && formData.decisionGrid) {
      // Add spacer
      decisionGridParagraphs.push(createEmptyLine(font));

      // Recommenders
      formData.decisionGrid.recommenders.forEach((rec: { id: string; role: string; options: string[] }) => {
          // Role line
          decisionGridParagraphs.push(new Paragraph({
              children: [new TextRun({ text: `${rec.role} recommends:`, font, size: FONT_SIZE_BODY })],
              spacing: { after: 120 }
          }));

          // Options line
          const optionRuns: TextRun[] = [];
          rec.options.forEach((opt: string, index: number) => {
              if (index > 0) {
                  optionRuns.push(new TextRun({ text: "\t", font, size: FONT_SIZE_BODY }));
              }
              optionRuns.push(new TextRun({ text: opt, font, size: FONT_SIZE_BODY }));
              optionRuns.push(new TextRun({ text: " ", font, size: FONT_SIZE_BODY }));
              optionRuns.push(new TextRun({ 
                  text: "______", 
                  font, 
                  size: FONT_SIZE_BODY,
                  // Using underscore text instead of underline style for better visual match with PDF lines
              }));
          });

          decisionGridParagraphs.push(new Paragraph({
              children: optionRuns,
              tabStops: [
                  { type: TabStopType.LEFT, position: 2880 }, // 2 inches
                  { type: TabStopType.LEFT, position: 5760 }, // 4 inches
                  { type: TabStopType.LEFT, position: 8640 }  // 6 inches
              ],
              spacing: { after: 240 }
          }));
      });

      // Final Decision
      const final = formData.decisionGrid.finalDecision;
      decisionGridParagraphs.push(new Paragraph({
          children: [new TextRun({ text: `${final.role} decision:`, font, size: FONT_SIZE_BODY })],
          spacing: { after: 120, before: 240 }
      }));

      const finalOptionRuns: TextRun[] = [];
      final.options.forEach((opt: string, index: number) => {
          if (index > 0) {
              finalOptionRuns.push(new TextRun({ text: "\t", font, size: FONT_SIZE_BODY }));
          }
          finalOptionRuns.push(new TextRun({ text: opt, font, size: FONT_SIZE_BODY }));
          finalOptionRuns.push(new TextRun({ text: " ", font, size: FONT_SIZE_BODY }));
          finalOptionRuns.push(new TextRun({ 
              text: "______", 
              font, 
              size: FONT_SIZE_BODY,
          }));
      });

      decisionGridParagraphs.push(new Paragraph({
          children: finalOptionRuns,
          tabStops: [
              { type: TabStopType.LEFT, position: 2880 },
              { type: TabStopType.LEFT, position: 5760 },
              { type: TabStopType.LEFT, position: 8640 }
          ],
          spacing: { after: 240 }
      }));
  }

  // --- Signature ---
  const signatureParagraphs: (Paragraph | Table)[] = [];
  
  if (isMoaOrMou) {
      // 2-Column Table for MOA/MOU Signatures
      // Senior Right, Junior Left
      const table = new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "auto" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
              left: { style: BorderStyle.NONE, size: 0, color: "auto" },
              right: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
          },
          rows: [
              // Empty rows for spacing (2 lines to match PDF's 3-line total gap: 1 body + 2 here)
              new TableRow({ children: [ 
                  new TableCell({ children: [createEmptyLine(font)], borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } } }), 
                  new TableCell({ children: [createEmptyLine(font)], borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } } }) 
              ] }),
              new TableRow({ children: [ 
                  new TableCell({ children: [createEmptyLine(font)], borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } } }), 
                  new TableCell({ children: [createEmptyLine(font)], borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } } }) 
              ] }),
              
              // Signature Line
              new TableRow({
                  children: [
                      new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: "______________________", font, size: FONT_SIZE_BODY })], alignment: AlignmentType.CENTER })],
                          width: { size: 50, type: WidthType.PERCENTAGE },
                          borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                      }),
                      new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: "______________________", font, size: FONT_SIZE_BODY })], alignment: AlignmentType.CENTER })],
                          width: { size: 50, type: WidthType.PERCENTAGE },
                          borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                      })
                  ]
              }),

              // Names
              new TableRow({
                  children: [
                      new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: moaData.juniorSigner.name.toUpperCase(), font, size: FONT_SIZE_BODY })], alignment: AlignmentType.CENTER })],
                          width: { size: 50, type: WidthType.PERCENTAGE },
                          borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                      }),
                      new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: moaData.seniorSigner.name.toUpperCase(), font, size: FONT_SIZE_BODY })], alignment: AlignmentType.CENTER })],
                          width: { size: 50, type: WidthType.PERCENTAGE },
                          borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                      })
                  ]
              }),
              // Titles
              new TableRow({
                  children: [
                      new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: moaData.juniorSigner.title, font, size: FONT_SIZE_BODY })], alignment: AlignmentType.CENTER })],
                          width: { size: 50, type: WidthType.PERCENTAGE },
                          borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                      }),
                      new TableCell({
                          children: [new Paragraph({ children: [new TextRun({ text: moaData.seniorSigner.title, font, size: FONT_SIZE_BODY })], alignment: AlignmentType.CENTER })],
                          width: { size: 50, type: WidthType.PERCENTAGE },
                          borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                      })
                  ]
              }),
              // Activities
               new TableRow({
                   children: [
                       new TableCell({
                           children: [new Paragraph({ children: [new TextRun({ text: (moaData.juniorSigner?.activitySymbol || moaData.activityB || '').toUpperCase(), font, size: FONT_SIZE_BODY })], alignment: AlignmentType.CENTER })],
                           width: { size: 50, type: WidthType.PERCENTAGE },
                           borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                       }),
                       new TableCell({
                           children: [new Paragraph({ children: [new TextRun({ text: (moaData.seniorSigner?.activitySymbol || moaData.activityA || '').toUpperCase(), font, size: FONT_SIZE_BODY })], alignment: AlignmentType.CENTER })],
                           width: { size: 50, type: WidthType.PERCENTAGE },
                           borders: { top: { style: BorderStyle.NONE, size: 0, color: "auto" }, bottom: { style: BorderStyle.NONE, size: 0, color: "auto" }, left: { style: BorderStyle.NONE, size: 0, color: "auto" }, right: { style: BorderStyle.NONE, size: 0, color: "auto" } }
                       })
                   ]
               })
          ]
      });
      signatureParagraphs.push(table);
  } else if (isDLAMemo) {
      // DLA Memorandum Signature Block — 4 blank lines, centered per Ch.3-2 Para 16-17
      signatureParagraphs.push(createEmptyLine(font));
      signatureParagraphs.push(createEmptyLine(font));
      signatureParagraphs.push(createEmptyLine(font));
      signatureParagraphs.push(createEmptyLine(font));

      if (formData.signerFullName) {
          signatureParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.signerFullName, font, size: FONT_SIZE_BODY })],
              indent: { left: INDENTS.signature }, // start at page center, left-aligned (G4)
              spacing: { after: 0 }
          }));
      }
      if (formData.signerRank) {
          signatureParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.signerRank, font, size: FONT_SIZE_BODY })],
              indent: { left: INDENTS.signature }, // start at page center, left-aligned (G4)
              spacing: { after: 0 }
          }));
      }
      if (formData.signerTitle) {
          signatureParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.signerTitle, font, size: FONT_SIZE_BODY })],
              indent: { left: INDENTS.signature }, // start at page center, left-aligned (G4)
              spacing: { after: 0 }
          }));
      }
      if (formData.delegationText) {
          signatureParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.delegationText, font, size: FONT_SIZE_BODY })],
              indent: { left: INDENTS.signature }, // start at page center, left-aligned (G4)
              spacing: { after: 0 }
          }));
      }
  } else if (isDLABusinessLetter) {
      // DLA Business Letter Closing Block
      // Own separation from body: close begins on the 2nd line below
      // the text (MCO 5216.20B Sec 12; trailing body spacer removed).
      signatureParagraphs.push(createEmptyLine(font));
      const close = formData.complimentaryClose || 'Sincerely';
      signatureParagraphs.push(new Paragraph({
          children: [new TextRun({ text: close.endsWith(',') ? close : close + ',', font, size: FONT_SIZE_BODY })],
          indent: { left: INDENTS.signature }, // start at page center, left-aligned (G4)
          spacing: { after: 0 }
      }));
      // Signature on the 4th line below the close: three blank lines
      // (MCO 5216.20B Sec 12 2.f; audit G4).
      signatureParagraphs.push(createEmptyLine(font));
      signatureParagraphs.push(createEmptyLine(font));
      signatureParagraphs.push(createEmptyLine(font));

      if (formData.signerFullName) {
          signatureParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.signerFullName, font, size: FONT_SIZE_BODY })],
              indent: { left: INDENTS.signature }, // start at page center, left-aligned (G4)
              spacing: { after: 0 }
          }));
      }
      if (formData.delegationText) {
          signatureParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.delegationText, font, size: FONT_SIZE_BODY })],
              indent: { left: INDENTS.signature }, // start at page center, left-aligned (G4)
              spacing: { after: 0 }
          }));
      }
  } else if (isCivilianStyle) {
      // Business/Executive Letter Closing Block
      // keepNext chains the separation blank, the close, and the three
      // signature blanks so the closing never splits from the signature
      // across a page break (user-reported split, 2026-06-10).
      const closeSpacer = () => new Paragraph({
          children: [new TextRun({ text: "", font, size: FONT_SIZE_BODY })],
          keepNext: true,
      });
      signatureParagraphs.push(closeSpacer());
      const close = getComplimentaryClose(formData);

      signatureParagraphs.push(new Paragraph({
          keepNext: true,
          children: [new TextRun({ text: close, font, size: FONT_SIZE_BODY })],
          indent: { left: INDENTS.signature }, // start at page center, left-aligned (G4)
          spacing: { after: 0 }
      }));

      // Signature on the 4th line below the close: three blank lines
      // (M-5216.5 11-2.9; MCO 5216.20B Sec 12 2.f; audit G4).
      signatureParagraphs.push(closeSpacer());
      signatureParagraphs.push(closeSpacer());
      signatureParagraphs.push(closeSpacer());

      if (!formData.omitSignatureBlock) {
          // Signer Name
          if (formData.sig) {
              signatureParagraphs.push(new Paragraph({
                  children: [new TextRun({ text: formData.sig.toUpperCase(), font, size: FONT_SIZE_BODY })],
                  indent: { left: INDENTS.signature }, // start at page center, left-aligned (G4)
                  spacing: { after: 0 }
              }));
          }

          // Signer Rank (business letter only)
          if (isBusinessLetter && formData.signerRank) {
              signatureParagraphs.push(new Paragraph({
                  children: [new TextRun({ text: formData.signerRank, font, size: FONT_SIZE_BODY })],
                  indent: { left: INDENTS.signature }, // start at page center, left-aligned (G4)
                  spacing: { after: 0 }
              }));
          }

          // Signer Title
          if (formData.signerTitle) {
              signatureParagraphs.push(new Paragraph({
                  children: [new TextRun({ text: formData.signerTitle, font, size: FONT_SIZE_BODY })],
                  indent: { left: INDENTS.signature }, // start at page center, left-aligned (G4)
                  spacing: { after: 0 }
              }));
          }
      }

      // Congressional courtesy copy
      if (isExecLetter && formData.courtesyCopyTo) {
          signatureParagraphs.push(createEmptyLine(font));
          signatureParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.courtesyCopyTo, font, size: FONT_SIZE_BODY })],
              alignment: AlignmentType.LEFT,
              spacing: { after: 0 }
          }));
          signatureParagraphs.push(new Paragraph({
              children: [new TextRun({ text: 'Ranking Minority Member', font, size: FONT_SIZE_BODY })],
              alignment: AlignmentType.LEFT,
              spacing: { after: 0 }
          }));
      }
  } else if (formData.sig && !isStaffingPaper) {
    // Three empty lines, signature on the 4th line below the text
    // (M-5216.5 7-2.16). keepNext chains the blanks to the signature
    // line so the block never splits across a page boundary; combined
    // with keepNext on the last body paragraph, the signature page
    // always carries at least two lines of text (S6).
    const sigSpacer = () => new Paragraph({
      children: [new TextRun({ text: "", font, size: FONT_SIZE_BODY })],
      keepNext: true,
    });
    // P3.3 (G5): 3 blanks = 4th line for correspondence; 4 blanks =
    // 5th line for USMC directives (MCO 5215.1K para 37).
    for (let k = 0; k < getSignatureBlankLines(formData.documentType); k++) {
      signatureParagraphs.push(sigSpacer());
    }

    signatureParagraphs.push(new Paragraph({
      children: [
        new TextRun({ text: formData.sig.toUpperCase(), font, size: FONT_SIZE_BODY }),
      ],
      indent: { left: signatureIndent },
      spacing: { after: 0 },
    }));
    
    if (formData.delegationText && !isFromToMemo) {
      // Support both string and array formats for delegation text (reference uses string[])
      const delegationLines = Array.isArray(formData.delegationText)
        ? formData.delegationText
        : [formData.delegationText];

      delegationLines.forEach((line: string) => {
        if (line && line.trim()) {
          signatureParagraphs.push(new Paragraph({
            children: [
              new TextRun({ text: line, font, size: FONT_SIZE_BODY }),
            ],
            indent: { left: signatureIndent },
          }));
        }
      });
    }
  }

  // --- Distribution / Copy To ---
  const distributionParagraphs: Paragraph[] = [];
  
  // P3.6 — Distribution Statement at the BOTTOM of the letterhead
  // (first) page (MCO 5215.1K; audit lines 149/172), not in the body
  // flow. Implemented as a margin-anchored text frame whose flow
  // anchor sits early in the document, so it always lands on page 1.
  const distStatementParagraphs: Paragraph[] = [];
  if (isDirective) {
      const stmtText = resolveDistributionStatement(formData);
      if (stmtText) {
          distStatementParagraphs.push(new Paragraph({
              children: [new TextRun({ text: stmtText, font, size: FONT_SIZE_BODY })],
              frame: {
                  type: 'alignment',
                  alignment: { x: HorizontalPositionAlign.LEFT, y: VerticalPositionAlign.BOTTOM },
                  anchor: { horizontal: FrameAnchorType.MARGIN, vertical: FrameAnchorType.MARGIN },
                  width: 9360,  // 6.5in text width
                  height: 240,
                  rule: HeightRule.ATLEAST,
                  wrap: FrameWrap.AROUND,
              },
              spacing: { after: 0 },
          }));
      }
  }

  if (isDirective) {
      const dist = formData.distribution;
      // PCN and Copy To
      if (dist && (dist.type === 'pcn' || dist.type === 'pcn-with-copy')) {
          // DISTRIBUTION on the 2nd line below the signature block
          // (one blank between), caps, left margin (audit line 138).
          distributionParagraphs.push(createEmptyLine(font));
          distributionParagraphs.push(new Paragraph({
              children: [
                  new TextRun({ text: "DISTRIBUTION: ", font, size: FONT_SIZE_BODY }),
                  new TextRun({ text: `PCN ${dist.pcn || '___________'}`, font, size: FONT_SIZE_BODY })
              ],
              spacing: { after: 120 }
          }));
      }

      if (dist?.copyTo && dist.copyTo.length > 0) {
          distributionParagraphs.push(new Paragraph({
              children: [
                  new TextRun({ text: "Copy to: ", font, size: FONT_SIZE_BODY }),
                  new TextRun({ text: dist.copyTo.map((c: { code: string; qty: number }) => c.code).join(', '), font, size: FONT_SIZE_BODY })
              ],
              spacing: { after: 120 }
          }));
      }
  } else if (!isStaffingPaper) {
      // 1. Multiple-Address Distribution List (when "To Distribution" toggle is on)
      const isDocToDistribution = formData.documentType === 'multiple-address' && !!formData.distribution?.toDistribution;
      if (isDocToDistribution) {
          const recipients = formData.distribution?.recipients || [];
          const recipientsWithContent = recipients.filter((r: string) => r && r.trim());

          if (recipientsWithContent.length > 0) {
              distributionParagraphs.push(createEmptyLine(font));

              if (recipientsWithContent.length === 1) {
                  distributionParagraphs.push(new Paragraph({
                      children: [new TextRun({ text: `Distribution:  ${recipientsWithContent[0]}`, font, size: FONT_SIZE_BODY })],
                      alignment: AlignmentType.LEFT,
                      spacing: { after: 0 }
                  }));
              } else {
                  distributionParagraphs.push(new Paragraph({
                      children: [new TextRun({ text: "Distribution:", font, size: FONT_SIZE_BODY })],
                      alignment: AlignmentType.LEFT,
                      spacing: { after: 0 }
                  }));
                  recipientsWithContent.forEach((recipient: string) => {
                      distributionParagraphs.push(new Paragraph({
                          children: [new TextRun({ text: recipient, font, size: FONT_SIZE_BODY })],
                          alignment: AlignmentType.LEFT,
                          spacing: { after: 0 }
                      }));
                  });
              }
          }
      }

      // Manual Distribution List
      const manualDistWithContent = distList ? distList.filter(d => d.trim()) : [];

      if (manualDistWithContent.length > 0 && !isDocToDistribution) {
          distributionParagraphs.push(createEmptyLine(font));

          if (manualDistWithContent.length === 1) {
              distributionParagraphs.push(new Paragraph({
                  children: [new TextRun({ text: `Distribution:  ${manualDistWithContent[0]}`, font, size: FONT_SIZE_BODY })],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0 }
              }));
          } else {
              distributionParagraphs.push(new Paragraph({
                  children: [new TextRun({ text: "Distribution:", font, size: FONT_SIZE_BODY })],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0 }
              }));
              manualDistWithContent.forEach(dist => {
                  distributionParagraphs.push(new Paragraph({
                      children: [new TextRun({ text: dist, font, size: FONT_SIZE_BODY })],
                      alignment: AlignmentType.LEFT,
                      spacing: { after: 0 }
                  }));
              });
          }
      }

      // Standard Letter Copy To (DLA uses "cc:" per Ch.3 Para 21)
      const copiesWithContent = copyTos.filter(c => c.trim());
      if (copiesWithContent.length > 0) {
          const copyToLabel = isDLAType ? 'cc:' : getCopyToSpacing(formData.bodyFont);
          distributionParagraphs.push(createEmptyLine(font));
          distributionParagraphs.push(new Paragraph({
              children: [new TextRun({ text: copyToLabel, font, size: FONT_SIZE_BODY })],
              alignment: AlignmentType.LEFT,
              // Legacy does NOT indent the label
              spacing: { after: 0 }
          }));
          
          copiesWithContent.forEach(copy => {
              distributionParagraphs.push(new Paragraph({
                  children: [
                      new TextRun({ text: copy, font, size: FONT_SIZE_BODY }),
                  ],
                  alignment: AlignmentType.LEFT,
                  spacing: { after: 0 }
              }));
          });
      }


  }

  // --- Staffing Paper Footer ---
  let staffingFooter: Footer | undefined;
  // Keep variable to avoid breaking children array until updated
  const staffingFooterParagraphs: Paragraph[] = []; 

  if (isStaffingPaper) {
      const footerLines: Paragraph[] = [];
      const isPositionOrDecision = formData.documentType === 'position-paper' || formData.documentType === 'decision-paper';
      const isInformationPaper = formData.documentType === 'information-paper';

      if (isPositionOrDecision) {
        // Position/Decision Paper Footer: Prepared By & Approved By (Left Aligned), Classification (Center)
        
        // Prepared By
        footerLines.push(new Paragraph({
            children: [
                new TextRun({ text: "Prepared by: ", font, size: FONT_SIZE_BODY, bold: true }),
                new TextRun({ 
                    text: `${formData.drafterRank || ''} ${formData.drafterName || ''}, ${formData.drafterOfficeCode || ''}, ${formData.drafterPhone || ''}`, 
                    font, 
                    size: FONT_SIZE_BODY 
                })
            ],
            alignment: AlignmentType.LEFT,
            spacing: { after: 120 }
        }));

        // Approved By
        footerLines.push(new Paragraph({
            children: [
                new TextRun({ text: "Approved by: ", font, size: FONT_SIZE_BODY, bold: true }),
                new TextRun({ 
                    text: `${formData.approverRank || ''} ${formData.approverName || ''}, ${formData.approverOfficeCode || ''}, ${formData.approverPhone || ''}`, 
                    font, 
                    size: FONT_SIZE_BODY 
                })
            ],
            alignment: AlignmentType.LEFT,
            spacing: { after: 240 }
        }));

        // Classification (Center Bottom)
        footerLines.push(new Paragraph({
            children: [new TextRun({ text: formData.classification || 'UNCLASSIFIED', font, size: FONT_SIZE_BODY, bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240 }
        }));

      } else if (isInformationPaper) {
          // Information Paper Footer: Prepared By (Left) with Service/Agency

          footerLines.push(new Paragraph({
            children: [
                new TextRun({ text: "Prepared by: ", font, size: FONT_SIZE_BODY, bold: true }),
                new TextRun({
                    text: `${formData.drafterName || ''}, ${formData.drafterRank || ''}, ${formData.drafterService || 'USMC'}`,
                    font,
                    size: FONT_SIZE_BODY
                })
            ],
            alignment: AlignmentType.LEFT,
            spacing: { after: 0 }
        }));

        footerLines.push(new Paragraph({
            children: [
                new TextRun({
                    text: `             ${formData.drafterAgency ? formData.drafterAgency + ', ' : ''}${formData.drafterOfficeCode || ''}, ${formData.drafterPhone || ''}`,
                    font,
                    size: FONT_SIZE_BODY
                })
            ],
            alignment: AlignmentType.LEFT,
            spacing: { after: (formData.approverName || formData.approverRank) ? 120 : 240 }
        }));

        // Approved By (if approver info is provided)
        if (formData.approverName || formData.approverRank) {
            footerLines.push(new Paragraph({
                children: [
                    new TextRun({ text: "Approved by: ", font, size: FONT_SIZE_BODY, bold: true }),
                    new TextRun({
                        text: `${formData.approverRank || ''} ${formData.approverName || ''}, ${formData.approverOfficeCode || ''}, ${formData.approverPhone || ''}`,
                        font,
                        size: FONT_SIZE_BODY
                    })
                ],
                alignment: AlignmentType.LEFT,
                spacing: { after: 240 }
            }));
        }

         // Classification (Center Bottom)
         footerLines.push(new Paragraph({
            children: [new TextRun({ text: formData.classification || 'UNCLASSIFIED', font, size: FONT_SIZE_BODY, bold: true })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240 }
        }));

      }
      
      staffingFooter = new Footer({
          children: footerLines
      });
  }

  // --- Header for First Page (Seal) ---
  // USER RULING 2026-06-10: seal anchor stays in the first-page header
  // so Word keeps its long-validated letterhead position (~0.67in, the
  // anchor paragraph pushes the body). This deviates from M-5216.5
  // 2-2.12b (first letterhead line on the 4th line = 0.5in). Deferred:
  // see docs/PHASE1_GOLDEN_DIFFS.md S3.3.
  let firstPageHeader: Header;

  if (sealBuffer && !isFromToMemo && !isMfr && !isStaffingPaper) {
      firstPageHeader = new Header({
          children: [
              new Paragraph({
                  children: [
                      new ImageRun({
                          data: sealBuffer,
                          transformation: {
                              width: 96,
                              height: 96,
                          },
                          floating: {
                              horizontalPosition: {
                                  relative: HorizontalPositionRelativeFrom.PAGE,
                                  offset: 458700, // approx 0.5"
                              },
                              verticalPosition: {
                                  relative: VerticalPositionRelativeFrom.PAGE,
                                  offset: 458700, // approx 0.5"
                              },
                              wrap: {
                                  type: TextWrappingType.NONE,
                              },
                          },
                      }),
                  ],
              }),
          ],
      });
  } else {
      firstPageHeader = new Header({ children: [] });
  }

  // Add FOUO to first page header for DLA types
  if (isDLAType && formData.fouoDesignation && formData.fouoDesignation !== '') {
      const fouoParagraph = new Paragraph({
          children: [new TextRun({ text: 'FOR OFFICIAL USE ONLY', font, size: FONT_SIZE_BODY })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 0 },
      });

      if (sealBuffer && !isFromToMemo && !isMfr && !isStaffingPaper) {
          // Rebuild with FOUO + seal
          firstPageHeader = new Header({
              children: [
                  fouoParagraph,
                  new Paragraph({
                      children: [
                          new ImageRun({
                              data: sealBuffer,
                              transformation: { width: 96, height: 96 },
                              floating: {
                                  horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 458700 },
                                  verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 458700 },
                                  wrap: { type: TextWrappingType.NONE },
                              },
                          }),
                      ],
                  }),
              ],
          });
      } else {
          firstPageHeader = new Header({ children: [fouoParagraph] });
      }
  }

  // --- Header for Subsequent Pages (Subject Line) ---
  const subsequentHeaderParagraphs: Paragraph[] = [];
  const subsequentHeaderTables: (Paragraph | Table)[] = [];
  
  if (isCivilianStyle) {
      // Business/Executive Letter Continuation Header: SSIC, Originator, Date
      if (formData.ssic) {
          subsequentHeaderParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.ssic, font, size: FONT_SIZE_BODY })],
              spacing: { after: 0 }
          }));
      }
      if (formData.originatorCode) {
          subsequentHeaderParagraphs.push(new Paragraph({
              children: [new TextRun({ text: formData.originatorCode, font, size: FONT_SIZE_BODY })],
              spacing: { after: 0 }
          }));
      }
      const dateText = isCivilianStyle
        ? formatBusinessDate(formData.date || '')
        : parseAndFormatDate(formData.date || 'Date Placeholder');

      subsequentHeaderParagraphs.push(new Paragraph({ 
          children: [new TextRun({ text: dateText, font, size: FONT_SIZE_BODY })],
          spacing: { after: 0 }
      }));
      
      subsequentHeaderParagraphs.push(createEmptyLine(font));
  } else if (isDirective) {
      // P3.4 — directive continuation header (audit lines 98, 160;
      // MCO 5215.1K para 38): the ID symbols repeat flush right, 1 inch
      // from the top, ORIGINATOR CODE OMITTED past page 1 (divergence
      // hot spot, audit line 126). Designation on line 1, date on the
      // next line; blocked left inside a right-anchored borderless
      // table so the longest line touches the right margin.
      const contStack = [getDirectiveDesignation(formData), parseAndFormatDate(formData.date || 'Date Placeholder')]
        .filter(Boolean);
      // P4.2 (audit line 160): the stack sits 1 INCH from the page
      // top. The header band originates at 720 twips; a 720-twip
      // spacer paragraph (240 line + 480 after) lands the first
      // stack line at 1440 twips.
      subsequentHeaderTables.push(new Paragraph({
          children: [new TextRun({ text: '', font, size: FONT_SIZE_BODY })],
          spacing: { after: 480 },
      }));
      subsequentHeaderTables.push(new Table({
          width: { size: 0, type: WidthType.AUTO },
          alignment: AlignmentType.RIGHT,
          borders: {
              top: { style: BorderStyle.NONE, size: 0, color: "auto" },
              bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
              left: { style: BorderStyle.NONE, size: 0, color: "auto" },
              right: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "auto" },
              insideVertical: { style: BorderStyle.NONE, size: 0, color: "auto" },
          },
          rows: [new TableRow({
              children: [new TableCell({
                  width: { size: 0, type: WidthType.AUTO },
                  borders: {
                      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
                      bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
                      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
                      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
                  },
                  children: contStack.map((line) => new Paragraph({
                      children: [new TextRun({ text: line, font, size: FONT_SIZE_BODY })],
                      alignment: AlignmentType.LEFT,
                      spacing: { after: 0 },
                  })),
              })],
          })],
      }));
      subsequentHeaderParagraphs.push(createEmptyLine(font));
  } else {
      // Continuation pages: Subj starts on the 6th line from the page
      // top and text resumes on the 2nd line below it (M-5216.5; audit
      // line 46, implementation per audit line 62). Header zone begins
      // at 720 twips (line 4); two full blank lines place Subj at
      // 1200 twips = lines 6. The trailing blank line after Subj pushes
      // body text to line 8 (1680 twips = 1.166in), i.e. 2nd line below.
      subsequentHeaderParagraphs.push(createEmptyLine(font));
      subsequentHeaderParagraphs.push(createEmptyLine(font));

      const headerSubjLines = splitSubject((formData.subj || '').toUpperCase(), 57);
      const headerSubjPrefix = getSubjSpacing(formData.bodyFont);
      
      if (headerSubjLines.length === 0) {
          if (formData.bodyFont === 'courier') {
              subsequentHeaderParagraphs.push(new Paragraph({
                  children: [new TextRun({ text: headerSubjPrefix, font, size: FONT_SIZE_BODY })],
                  alignment: AlignmentType.LEFT
              }));
          } else {
              subsequentHeaderParagraphs.push(new Paragraph({
                  children: [new TextRun({ text: headerSubjPrefix, font, size: FONT_SIZE_BODY })],
                  tabStops: [{ type: TabStopType.LEFT, position: 720 }]
              }));
          }
      } else {
          if (formData.bodyFont === 'courier') {
              subsequentHeaderParagraphs.push(new Paragraph({
                  children: [new TextRun({ text: headerSubjPrefix + headerSubjLines[0], font, size: FONT_SIZE_BODY })],
                  alignment: AlignmentType.LEFT
              }));
              for (let i = 1; i < headerSubjLines.length; i++) {
                  subsequentHeaderParagraphs.push(new Paragraph({
                      children: [new TextRun({ text: '       ' + headerSubjLines[i], font, size: FONT_SIZE_BODY })],
                      alignment: AlignmentType.LEFT
                  }));
              }
          } else {
              subsequentHeaderParagraphs.push(new Paragraph({
                  children: [
                      new TextRun({ text: headerSubjPrefix, font, size: FONT_SIZE_BODY }),
                      new TextRun({ text: headerSubjLines[0], font, size: FONT_SIZE_BODY })
                  ],
                  tabStops: [{ type: TabStopType.LEFT, position: 720 }]
              }));
              for (let i = 1; i < headerSubjLines.length; i++) {
                  subsequentHeaderParagraphs.push(new Paragraph({
                      children: [new TextRun({ text: "\t" + headerSubjLines[i], font, size: FONT_SIZE_BODY })],
                      tabStops: [{ type: TabStopType.LEFT, position: 720 }]
                  }));
              }
          }
      }
      subsequentHeaderParagraphs.push(createEmptyLine(font));
  }

  // DLA FOUO header line (appears at top of every page)
  const dlaFouoHeaderParagraphs: Paragraph[] = [];
  if (isDLAType && formData.fouoDesignation && formData.fouoDesignation !== '') {
      dlaFouoHeaderParagraphs.push(new Paragraph({
          children: [new TextRun({ text: 'FOR OFFICIAL USE ONLY', font, size: FONT_SIZE_BODY })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 0 },
      }));
  }

  const defaultHeader = new Header({
      children: [...dlaFouoHeaderParagraphs, ...subsequentHeaderTables, ...subsequentHeaderParagraphs]
  });

  // --- Footer (Page Numbers) ---
  const footerChildren: Paragraph[] = [];

  // DLA FOUO footer line
  if (isDLAType && formData.fouoDesignation && formData.fouoDesignation !== '') {
      footerChildren.push(new Paragraph({
          children: [new TextRun({ text: 'FOR OFFICIAL USE ONLY', font, size: FONT_SIZE_BODY })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 0 },
      }));
  }

  footerChildren.push(new Paragraph({
      children: [
          new TextRun({
              children: [PageNumber.CURRENT],
              font,
              size: FONT_SIZE_BODY
          })
      ],
      alignment: isDLAType ? AlignmentType.RIGHT : AlignmentType.CENTER  // DLA: right margin per Ch.3-2 Para 13
  }));

  const footer = new Footer({ children: footerChildren });

  // Determine if we should show page number on first page
  // Standard letters (start=1): No number on first page
  // Endorsements/Continuations (start>1): Show number on first page
  const startPage = formData.startingPageNumber || 1;
  const showPageNumberOnFirstPage = startPage > 1;

  // --- P4.1: directive structural pages (MCO 5215.1K para 48) ---
  // Locator Sheet, Record of Changes, and Table of Contents as
  // separate DOCX sections with static roman-numeral footers,
  // mirroring the PDF (which already had them — the DOCX export
  // silently dropped structural pages before P4.1). Roman numbering
  // cascades over the pages actually enabled.
  const structuralSections: object[] = [];
  if (isDirective && (formData.showLocatorSheet || formData.showRecordOfChanges || formData.showStructuralPages)) {
    const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v'];
    let structuralPageIndex = 0;
    const locatorNum = formData.showLocatorSheet ? romanNumerals[structuralPageIndex++] : '';
    const rocNum = formData.showRecordOfChanges ? romanNumerals[structuralPageIndex++] : '';
    const tocNum = formData.showStructuralPages ? romanNumerals[structuralPageIndex++] : '';

    const structuralPageProps = {
      page: {
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 720, footer: 708 },
      },
    };
    const emptyHeader = new Header({ children: [] });
    const romanFooter = (label: string) => new Footer({
      children: [new Paragraph({
        children: [new TextRun({ text: label, font, size: FONT_SIZE_BODY })],
        alignment: AlignmentType.CENTER,
      })],
    });
    const structuralSection = (label: string, children: (Paragraph | Table)[]) => ({
      properties: structuralPageProps,
      headers: { first: emptyHeader, default: emptyHeader },
      footers: { first: romanFooter(label), default: romanFooter(label) },
      children,
    });
    const noBorder = {
      top: { style: BorderStyle.NONE, size: 0, color: "auto" },
      bottom: { style: BorderStyle.NONE, size: 0, color: "auto" },
      left: { style: BorderStyle.NONE, size: 0, color: "auto" },
      right: { style: BorderStyle.NONE, size: 0, color: "auto" },
    };
    void noBorder;
    const solid = { style: BorderStyle.SINGLE, size: 4, color: "000000" };

    if (formData.showLocatorSheet) {
      const designation = (formData.directiveTitle || buildDirectiveTitle(formData)).toUpperCase();
      structuralSections.push(structuralSection(locatorNum, [
        new Paragraph({ children: [new TextRun({ text: designation, font, size: FONT_SIZE_BODY })], alignment: AlignmentType.RIGHT, spacing: { after: 0 } }),
        new Paragraph({ children: [new TextRun({ text: formattedDate || '', font, size: FONT_SIZE_BODY })], alignment: AlignmentType.RIGHT, spacing: { after: 240 } }),
        new Paragraph({ children: [new TextRun({ text: 'LOCATOR SHEET', font, size: FONT_SIZE_BODY })], alignment: AlignmentType.CENTER, spacing: { after: 480 } }),
        new Paragraph({ children: [new TextRun({ text: `Subj:\u00A0\u00A0${(formData.subj || '').toUpperCase()}`, font, size: FONT_SIZE_BODY })], spacing: { after: 240 } }),
        new Paragraph({ children: [new TextRun({ text: 'Location:\u00A0\u00A0_______________________________________________', font, size: FONT_SIZE_BODY })], spacing: { after: 60 } }),
        new Paragraph({ children: [new TextRun({ text: '(Indicate the location(s) of the copy(ies) of this Order.)', font, size: FONT_SIZE_BODY })], spacing: { after: 0 } }),
      ]));
    }

    if (formData.showRecordOfChanges) {
      const headerCell = (text: string, pct: number) => new TableCell({
        width: { size: pct, type: WidthType.PERCENTAGE },
        borders: { top: solid, bottom: solid, left: solid, right: solid },
        children: [new Paragraph({ children: [new TextRun({ text, font, size: FONT_SIZE_BODY, bold: true })], alignment: AlignmentType.CENTER })],
      });
      const bodyCell = (text: string, pct: number, center = true) => new TableCell({
        width: { size: pct, type: WidthType.PERCENTAGE },
        borders: { top: solid, bottom: solid, left: solid, right: solid },
        children: [new Paragraph({ children: [new TextRun({ text, font, size: FONT_SIZE_BODY })], alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT })],
      });
      const rows = [
        new TableRow({ children: [
          headerCell('Change Number', 15), headerCell('Date of Change', 20),
          headerCell('Date Entered', 20), headerCell('Signature of Person Incorporating Change', 45),
        ]}),
        ...(formData.recordOfChanges || []).map((c: { changeNo: number; date: string; pagesAffected: string; enteredBy: string }) =>
          new TableRow({ children: [
            bodyCell(String(c.changeNo), 15), bodyCell(c.date, 20),
            bodyCell(c.pagesAffected, 20), bodyCell(c.enteredBy, 45, false),
          ]})),
        ...Array.from({ length: Math.max(0, 20 - (formData.recordOfChanges?.length || 0)) }, () =>
          new TableRow({ children: [bodyCell('', 15), bodyCell('', 20), bodyCell('', 20), bodyCell('', 45)] })),
      ];
      structuralSections.push(structuralSection(rocNum, [
        new Paragraph({ children: [new TextRun({ text: 'RECORD OF CHANGES', font, size: 28, bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 480 } }),
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }),
      ]));
    }

    if (formData.showStructuralPages) {
      const tocEntries = paragraphsWithContent
        .filter((p) => p.level === 1 && (p.title || p.content))
        .map((p, i) => ({
          number: formData.fourDigitNumbering
            ? `${formData.chapterNumber || 1}${String(i + 1).padStart(3, '0')}`
            : `${i + 1}`,
          title: p.title || p.content.substring(0, 80),
        }));
      const enclsWithContent = enclosures.filter((e) => e.trim());
      const tocChildren: (Paragraph | Table)[] = [
        new Paragraph({ children: [new TextRun({ text: 'TABLE OF CONTENTS', font, size: 28, bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 480 } }),
        new Paragraph({ children: [new TextRun({ text: 'PARAGRAPH\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0TITLE', font, size: FONT_SIZE_BODY, bold: true })], spacing: { after: 240 } }),
        ...tocEntries.map((e) => new Paragraph({
          children: [new TextRun({ text: `${e.number}.\t${e.title}`, font, size: FONT_SIZE_BODY })],
          tabStops: [{ type: TabStopType.LEFT, position: 900 }],
          spacing: { after: 60 },
        })),
      ];
      if (enclsWithContent.length > 0) {
        tocChildren.push(new Paragraph({ children: [new TextRun({ text: 'ENCLOSURE\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0TITLE', font, size: FONT_SIZE_BODY, bold: true })], spacing: { before: 240, after: 240 } }));
        tocChildren.push(...enclsWithContent.map((e, i) => new Paragraph({
          children: [new TextRun({ text: `(${i + 1})\t${e}`, font, size: FONT_SIZE_BODY })],
          tabStops: [{ type: TabStopType.LEFT, position: 900 }],
          spacing: { after: 60 },
        })));
      }
      structuralSections.push(structuralSection(tocNum, tocChildren));
    }
  }

  // --- Assemble Document ---
  const doc = new Document({
    sections: [{
        properties: {
          page: {
            margin: {
              top: MARGIN_TOP,
              right: formData.isShortLetter ? 2880 : MARGIN_RIGHT,
              bottom: MARGIN_BOTTOM,
              left: formData.isShortLetter ? 2880 : MARGIN_LEFT,
              // Header zone starts at 0.5in so continuation-header line
              // positions compute on the 6-lines-per-inch grid
              // (M-5216.5 7-2.14; audit line 46).
              header: 720,
            },
            pageNumbers: {
              start: startPage,
              formatType: "decimal",
            },
          },
          titlePage: true, // Distinct first page header
        },
      headers: {
        first: firstPageHeader,
        default: defaultHeader,
      },
      footers: {
        first: isStaffingPaper && staffingFooter ? staffingFooter : (showPageNumberOnFirstPage ? footer : new Footer({ children: [] })),
        default: footer,
      },
      children: [
        ...letterheadParagraphs,
        ...distStatementParagraphs,
        ...ssicParagraphs,
        ...businessHeaderParagraphs,
        ...(isMoaOrMou ? [] : [createEmptyLine(font)]),
        ...moaHeaderParagraphs,
        ...staffingHeaderParagraphs,
        ...endorsementParagraphs,
        ...directiveTitleParagraphs,
        ...addressParagraphs,
        ...refParagraphs,
        ...enclParagraphs,
        ...reportsParagraphs,
        ...bodyParagraphs,
        ...decisionGridParagraphs,
        ...signatureParagraphs,
        ...distributionParagraphs,
        ...reportsPageParagraphs,
      ],
    },
    ...(structuralSections as []),
    ],
  });

  return Packer.toBlob(doc);
}
