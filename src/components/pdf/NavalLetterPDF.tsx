import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer';
import { FormData, ParagraphData } from '@/types';
import { getPDFBodyFont, PDF_FONTS } from '@/lib/pdf-fonts';
import {
  PDF_PAGE,
  PDF_MARGINS,
  PDF_FONT_SIZES,
  PDF_COLORS,
  PDF_INDENTS,
  PDF_PARAGRAPH_TABS,
  PDF_SEAL,
  PDF_SUBJECT,
  PDF_CONTENT_WIDTH,
  PDF_SPACING,
} from '@/lib/pdf-settings';

// Height reserved for continuation page header (Subj line + spacing)
// This creates top margin space on pages 2+ so content doesn't overlap the header
// Needs to accommodate 2 lines of subject text + spacing
// Continuation-page geometry (M-5216.5; audit lines 46, 62), 6 lines/inch:
// Subj line top = line 6 = 5/6 in = 60pt from page top.
// Body text resumes line 8 = 7/6 in = 84pt from page top.
// Page padding is PDF_MARGINS.top (44pt), so the naval spacer is 84-44=40pt
// and the naval Subj block is nudged 60-44=16pt below the shared
// absolute-positioned header origin.
const CONTINUATION_SUBJ_OFFSET = 60 - PDF_MARGINS.top;
const CONTINUATION_SPACER_NAVAL = 84 - PDF_MARGINS.top;
const CONTINUATION_HEADER_HEIGHT = 48; // directive/civilian legacy, retuned in Phases 3-4
import { getPDFSealDataUrl } from '@/lib/pdf-seal';
import { parseAndFormatDate, formatBusinessDate } from '@/lib/date-utils';
import { splitSubject, formatCancellationDate, getDirectiveDesignation, buildDirectiveTitle, getViaSpacing as sharedGetViaSpacing, getComplimentaryClose, getSignatureBlankLines, resolveDistributionStatement } from '@/lib/naval-format-utils';
import { DISTRIBUTION_STATEMENTS } from '@/lib/constants';
import { parseFormattedText } from '@/lib/pdf-text-parser';
import { relativeIndentEngine, fixedLadderEngine, isCorrespondenceType, isDirectiveType } from '@/lib/indent-engine';
import { resolveBodyFont, resolveHeaderType } from '@/lib/font-policy';
import type { ParagraphIndentSpec } from '@/lib/indent-engine';

interface NavalLetterPDFProps {
  formData: FormData;
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  paragraphs: ParagraphData[];
  distList?: string[];
}

const createStyles = (bodyFont: 'times' | 'courier', accentColor?: string, isShortLetter?: boolean) => {
  const fontFamily = getPDFBodyFont(bodyFont);
  // Use user-selected color for header (blue or black)
  const headerColor = accentColor === 'blue' ? '#002D72' : '#000000';

  // Short Letter: 2" side margins (144pt). Standard is 1" (72pt) usually defined in PDF_MARGINS.
  // We override the default left/right margins if isShortLetter is true.
  const sideMargin = isShortLetter ? 144 : PDF_MARGINS.left;

  return StyleSheet.create({
    page: {
      paddingTop: PDF_MARGINS.top,
      paddingBottom: PDF_MARGINS.bottom,
      paddingLeft: sideMargin,
      paddingRight: sideMargin,
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
    },
    
    seal: {
      position: 'absolute',
      top: PDF_SEAL.offsetY,
      left: PDF_SEAL.offsetX,
      width: PDF_SEAL.width,
      height: PDF_SEAL.height,
    },
    
    letterhead: {
      marginBottom: 0,
    },
    
    headerTitle: {
      fontFamily: PDF_FONTS.SERIF,
      fontSize: PDF_FONT_SIZES.title,
      fontWeight: 'bold',
      textAlign: 'center',
      color: headerColor,
    },
    
    headerLine: {
      fontFamily: PDF_FONTS.SERIF,
      fontSize: PDF_FONT_SIZES.unitLines,
      textAlign: 'center',
      color: headerColor,
    },
    
    // SSIC block - uses sectionGap for spacing after
    addressBlock: {
      marginLeft: PDF_INDENTS.ssicBlock,
      marginBottom: PDF_SPACING.sectionGap,
    },
    addressLine: {
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
    },
    
    fromToSection: {
      marginBottom: 0,
    },
    fromToLine: {
      flexDirection: 'row',
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
    },
    fromToLabel: {
      width: PDF_INDENTS.tabStop1,
    },
    
    // Subject - uses sectionGap for spacing before and after
    subjectSection: {
      marginTop: PDF_SPACING.sectionGap,
      marginBottom: PDF_SPACING.sectionGap,
    },
    subjectLine: {
      flexDirection: 'row',
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
    },
    subjectLabel: {
      width: PDF_INDENTS.tabStop1,
    },
    subjectContinuation: {
      marginLeft: PDF_INDENTS.tabStop1,
    },
    
    // Ref/Encl - uses sectionGap for spacing after
    refEnclSection: {
      marginBottom: PDF_SPACING.sectionGap,
    },
    refEnclLine: {
      flexDirection: 'row',
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
    },
    refEnclLabel: {
      width: PDF_INDENTS.tabStop1,
    },
    refEnclContent: {
      flex: 1,
    },
    
    // Body - uses sectionGap for spacing after
    bodySection: {
      marginBottom: PDF_SPACING.sectionGap,
    },

    // MOA/MOU Header
    moaHeader: {
      textAlign: 'center',
      marginBottom: 0,
    },
    moaTitle: {
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
      marginBottom: 6,
    },
    moaBetween: {
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
      marginBottom: 6,
    },
    moaActivity: {
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
      marginBottom: 6,
    },
    moaAnd: {
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
      marginBottom: 6,
    },
    moaRegarding: {
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
      marginTop: 6,
    },

    // MOA/MOU Signatures
    signatureRow: {
      flexDirection: 'row',
      marginTop: 0,
      marginBottom: 12,
    },
    signatureColumn: {
      width: '50%',
      alignItems: 'center',
    },
    signatureLine: {
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
      textAlign: 'center',
    },
    
    // Individual paragraph spacing
    paragraphItem: {
      marginBottom: 0,
    },
    
    signatureBlock: {
      marginTop: 0,
      marginLeft: PDF_INDENTS.signature,
    },

    copyToSection: {
      marginTop: 0,
    },
    copyToLabel: {
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
    },
    copyToLine: {
      marginLeft: 0,
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
    },
    
    emptyLine: {
      height: PDF_SPACING.emptyLine,
    },
    
    footer: {
      position: 'absolute',
      bottom: 36,
      left: 0,
      right: 0,
      textAlign: 'center',
      fontSize: PDF_FONT_SIZES.body,
      fontFamily: fontFamily,
    },
    
    // Continuation page header (pages 2+)
    // Absolutely positioned at top of page, only visible on pages 2+
    continuationHeader: {
      position: 'absolute',
      top: PDF_MARGINS.top,
      left: PDF_MARGINS.left,
      right: PDF_MARGINS.right,
    },
    continuationSubjLabel: {
      width: PDF_INDENTS.tabStop1,
    },
    continuationSubjLine: {
      flexDirection: 'row',
    },
    continuationSubjText: {
      flex: 1,
    },

    // Staffing Paper Header
    staffingPaperHeader: {
      textAlign: 'center',
      marginBottom: PDF_SPACING.sectionGap * 2,
    },
    staffingPaperTitle: {
      fontFamily: PDF_FONTS.SERIF, // Usually Courier for these, but let's respect bodyFont or default to standard
      fontSize: PDF_FONT_SIZES.title,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      textDecoration: 'underline', // MCO 5216.20A often shows underlined title for Point Papers
      marginBottom: 12,
    },
    staffingPaperOn: {
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
      fontWeight: 'bold',
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    staffingPaperSubject: {
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
      // fontWeight: 'bold', // Removed per user request
      // textTransform: 'uppercase', // Removed per user request
    },

    staffingPaperFooter: {
      position: 'absolute',
      bottom: PDF_MARGINS.bottom,
      right: PDF_MARGINS.right,
      textAlign: 'right',
    },
    staffingPaperFooterLine: {
      fontFamily: fontFamily,
      fontSize: PDF_FONT_SIZES.body,
      textAlign: 'right',
    },

    // Information Paper Specific Styles
    infoPaperClassification: {
      textAlign: 'center',
      fontSize: PDF_FONT_SIZES.body,
      fontFamily: fontFamily,
      marginBottom: 12,
      textTransform: 'uppercase',
    },
    infoPaperTitle: {
      textAlign: 'center',
      fontSize: PDF_FONT_SIZES.body,
      fontFamily: fontFamily,
      marginBottom: 0,
      textTransform: 'uppercase',
    },
    infoPaperIdBlock: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginBottom: PDF_SPACING.sectionGap,
    },
    infoPaperFooterContainer: {
        position: 'absolute',
        bottom: PDF_MARGINS.bottom,
        left: PDF_MARGINS.left,
        right: PDF_MARGINS.right,
    },
    infoPaperFooterLeft: {
        textAlign: 'left',
        fontSize: PDF_FONT_SIZES.body,
        fontFamily: fontFamily,
    },
    infoPaperFooterCenter: {
        textAlign: 'center',
        fontSize: PDF_FONT_SIZES.body,
        fontFamily: fontFamily,
        marginTop: 12,
        textTransform: 'uppercase',
    },
  });
};

/**
 * Converts a number to Excel-style letters (1=a, 2=b... 26=z, 27=aa, 28=ab)
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

function generateCitation(
  paragraph: ParagraphData,
  index: number,
  allParagraphs: ParagraphData[],
  documentType?: string,
  fourDigitNumbering?: boolean,
  chapterNumber?: number
): string {
  const { level } = paragraph;

  if (documentType === 'information-paper' && level > 1) {
    switch (level) {
      case 2: return '•';
      case 3: return '◦';
      case 4: return '▪';
      default: return '•';
    }
  }

  let listStartIndex = 0;
  if (level > 1) {
    for (let i = index - 1; i >= 0; i--) {
      if (allParagraphs[i].level < level) {
        listStartIndex = i + 1;
        break;
      }
    }
  }

  let count = 0;
  for (let i = listStartIndex; i <= index; i++) {
    const p = allParagraphs[i];
    if (p.level === level) {
      if (p.content.trim() || p.title || p.id === paragraph.id) {
        count++;
      }
    }
  }

  if (count === 0) count = 1;

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
    case 5: return `${count}.`;
    case 6: return `${numberToLetter(count)}.`;
    case 7: return `(${count})`;
    case 8: return `(${numberToLetter(count)})`;
    default: return '';
  }
}

/**
 * Paragraph rendering - uses hanging indent so wrapped text aligns
 * with the start of body text (after citation), matching DOCX output.
 */
function ParagraphItem({
  paragraph,
  index,
  allParagraphs,
  bodyFont,
  shouldBoldTitle = true,
  shouldUppercaseTitle = true,
  documentType,
  isShortLetter,
  fourDigitNumbering,
  chapterNumber,
  spec,
  isLast,
}: {
  paragraph: ParagraphData;
  index: number;
  allParagraphs: ParagraphData[];
  bodyFont: 'times' | 'courier';
  shouldBoldTitle?: boolean;
  shouldUppercaseTitle?: boolean;
  documentType?: string;
  isShortLetter?: boolean;
  fourDigitNumbering?: boolean;
  chapterNumber?: number;
  spec?: ParagraphIndentSpec;
  isLast?: boolean;
}) {
  const citation = generateCitation(paragraph, index, allParagraphs, documentType, fourDigitNumbering, chapterNumber);
  const level = paragraph.level;
  const tabs = PDF_PARAGRAPH_TABS[level as keyof typeof PDF_PARAGRAPH_TABS] || PDF_PARAGRAPH_TABS[1];
  const isUnderlined = level >= 5 && level <= 8;

  // Calculate left margin for this paragraph level
  const leftMargin = tabs.citation;
  
  const titleText = shouldUppercaseTitle && paragraph.title ? paragraph.title.toUpperCase() : paragraph.title;

  if (documentType === 'business-letter' || documentType === 'executive-correspondence') {
     if (level === 1) {
        // Main Paragraph: First line indent 0.25" (18pt) to match Word/policy "8 spaces"
        // Short Letter rule: If isShortLetter is true, indent is 1 inch (72pt)
        const indent = isShortLetter ? 72 : 18; 
        
        return (
          <View style={{ marginLeft: 0, marginBottom: isLast ? 0 : PDF_SPACING.paragraph, textIndent: indent }}>
             <Text style={isShortLetter ? { lineHeight: 2.0 } : {}}>
                {paragraph.title && (
                    <Text style={{ fontWeight: shouldBoldTitle ? 'bold' : 'normal' }}>
                        {titleText}{paragraph.content ? '.' : ''}{paragraph.content ? '\u00A0\u00A0' : ''}
                    </Text>
                )}
                {parseFormattedText(paragraph.content)}
             </Text>
          </View>
        );
     } else {
        // Subparagraphs: Indented with hanging indent behavior
        // Level 2: Citation at 0.25" (18pt). Text aligns with first letter
        
        // Define indentation levels for business letters
        // Level 2: Indent 18pt (0.25") -> Alignment 36pt
        const indentStep = 18;
        const textOffset = 18; // Space between citation and text
        
        // Level 2 starts at 36pt. Level 3 at 72pt.
        const baseIndent = (level - 1) * indentStep; 
        const totalLeftMargin = baseIndent + textOffset; // Where text starts
        
        return (
          <View style={{ flexDirection: 'row', marginLeft: baseIndent, marginBottom: isLast ? 0 : PDF_SPACING.paragraph }}>
             <View style={{ width: textOffset }}>
                <Text style={isShortLetter ? { lineHeight: 2.0 } : {}}>{citation}</Text>
             </View>
             <Text style={{ flex: 1, ...(isShortLetter ? { lineHeight: 2.0 } : {}) }}>
                {paragraph.title && (
                    <Text style={{ fontWeight: shouldBoldTitle ? 'bold' : 'normal' }}>
                        {titleText}{paragraph.content ? '.' : ''}{paragraph.content ? '\u00A0\u00A0' : ''}
                    </Text>
                )}
                {parseFormattedText(paragraph.content)}
             </Text>
          </View>
        );
     }
  }

  // DLA paragraph rendering per DLA Corr Manual Ch.3:
  // - Level 1: unnumbered, indent one tab (½ inch) from left margin
  // - Level 2: a. — first subdivision, indent additional tab
  // - Level 3: (1) — second subdivision, indent additional tab
  // - Level 4: (a) — third designation (max), indent additional tab
  // "Do not list subdivisions more than the third designation"
  if (documentType?.startsWith('dla-')) {
    const effectiveLevel = Math.min(level, 4); // Max 4 levels (unnumbered + 3 subdivisions)
    const dlaIndent = 36; // ½ inch = 36pt per tab
    const citationWidth = 24; // space for citation like "a.", "(1)", "(a)"

    if (effectiveLevel === 1) {
      // Level 1: No number, first-line indent of one tab, text wraps to left margin
      return (
        <View style={{ marginLeft: 0, marginBottom: isLast ? 0 : PDF_SPACING.paragraph, textIndent: dlaIndent }}>
          <Text>
            {paragraph.title && (
              <Text style={{ fontWeight: shouldBoldTitle ? 'bold' : 'normal' }}>
                {titleText}{paragraph.content ? '.' : ''}{paragraph.content ? '\u00A0\u00A0' : ''}
              </Text>
            )}
            {parseFormattedText(paragraph.content)}
          </Text>
        </View>
      );
    }

    // Sub-levels (2-4): citation + text at indent position
    // Each sub-level indents an additional tab from left margin
    const leftMarginDLA = (effectiveLevel - 1) * dlaIndent;
    return (
      <View style={{ flexDirection: 'row', marginLeft: leftMarginDLA, marginBottom: isLast ? 0 : PDF_SPACING.paragraph }}>
        <View style={{ width: citationWidth }}>
          <Text>{citation}</Text>
        </View>
        <Text style={{ flex: 1 }}>
          {paragraph.title && (
            <Text style={{ fontWeight: shouldBoldTitle ? 'bold' : 'normal' }}>
              {titleText}{paragraph.content ? '.' : ''}{paragraph.content ? '\u00A0\u00A0' : ''}
            </Text>
          )}
          {parseFormattedText(paragraph.content)}
        </Text>
      </View>
    );
  }

  if (bodyFont === 'courier') {
    // Courier uses character-based spacing: 4 non-breaking spaces per indent level
    // This matches DOCX which uses '\u00A0'.repeat((level - 1) * 4)
    // With an engine spec (correspondence): measured character columns per
    // M-5216.5 Fig 7-8. Without (directives): pre-Phase-1 fixed 4-char ladder.
    const leadingSpaces = '\u00A0'.repeat(spec ? spec.prefixChars : (level - 1) * 4);
    const spacesAfterCitation = spec
      ? '\u00A0'.repeat(spec.spacesAfter)
      : ((citation.endsWith('.') || documentType === 'information-paper') ? '\u00A0\u00A0' : '\u00A0');

    return (
      <View style={{ marginBottom: isLast ? 0 : PDF_SPACING.paragraph }}>
        <Text>
          {leadingSpaces}
          {isUnderlined ? (
            <>
              {citation.includes('(') && '('}
              <Text style={{ textDecoration: 'underline' }}>
                {citation.replace(/[().]/g, '')}
              </Text>
              {citation.includes('(') ? ')' : '.'}
            </>
          ) : (
            citation
          )}
          {spacesAfterCitation}
          {paragraph.title && (
            <Text>{titleText}{paragraph.content ? '.' : ''}{paragraph.content ? '\u00A0\u00A0' : ''}</Text>
          )}
          {parseFormattedText(paragraph.content)}
        </Text>
      </View>
    );
  }

  // CORRESPONDENCE MODE (relative indent engine).
  // SECNAV M-5216.5 Fig 7-8: designator at measured content-relative
  // position via text-indent; runover lines return to the left margin
  // (M-5216.5 7-2.13; POLICY_COMPLIANCE_AUDIT.md line 43).
  if (spec) {
    return (
      <View style={{ marginBottom: isLast ? 0 : PDF_SPACING.paragraph }}>
        {/* S6: orphan/widow floor of two lines per paragraph fragment */}
        <Text style={{ textIndent: spec.firstLinePoints }} orphans={2} widows={2}>
          {/* react-pdf quirk: textIndent only engages when the first
              child is a non-empty string. Levels 5-8 start with a nested
              underlined <Text>, so lead with a zero-width space (U+200B).
              It occupies no width and does not appear in the PDF text
              layer (verified by extraction test). */}
          {isUnderlined && '\u200B'}
          {isUnderlined ? (
            <>
              {citation.includes('(') && '('}
              <Text style={{ textDecoration: 'underline' }}>
                {citation.replace(/[().]/g, '')}
              </Text>
              {citation.includes(')') ? ')' : '.'}
            </>
          ) : (
            citation
          )}
          {'\u00A0'.repeat(spec.spacesAfter)}
          {paragraph.title && (
            <Text style={{
              fontWeight: shouldBoldTitle ? 'bold' : 'normal',
              textDecoration: 'none'
            }}>{titleText}{paragraph.content ? '.' : ''}{paragraph.content ? '\u00A0\u00A0' : ''}</Text>
          )}
          {parseFormattedText(paragraph.content)}
        </Text>
      </View>
    );
  }

  // Times New Roman - row layout: citation in fixed-width column, text in flex column
  // This matches DOCX tab-stop behavior where text starts at an exact position
  const hangingIndent = tabs.text - tabs.citation;
  return (
    <View style={{ flexDirection: 'row', marginLeft: tabs.citation, marginBottom: isLast ? 0 : PDF_SPACING.paragraph }}>
      <View style={{ width: hangingIndent }}>
        <Text>
          {isUnderlined ? (
            <>
              {citation.includes('(') && '('}
              <Text style={{ textDecoration: 'underline' }}>
                {citation.replace(/[().]/g, '')}
              </Text>
              {citation.includes(')') ? ')' : '.'}
            </>
          ) : (
            citation
          )}
        </Text>
      </View>
      <Text style={{ flex: 1 }}>
        {paragraph.title && (
            <Text style={{
              fontWeight: shouldBoldTitle ? 'bold' : 'normal',
              textDecoration: 'none'
            }}>{titleText}{paragraph.content ? '.' : ''}{paragraph.content ? '\u00A0\u00A0' : ''}</Text>
        )}
        {parseFormattedText(paragraph.content)}
      </Text>
    </View>
  );
}

export function NavalLetterPDF({
  formData,
  vias,
  references,
  enclosures,
  copyTos,
  paragraphs,
  distList = [],
}: NavalLetterPDFProps) {
  // P3.1 (G7): archetype font policy — directives coerce to Courier.
  // Letterhead guard: directives never carry DLA letterhead.
  formData = {
    ...formData,
    bodyFont: resolveBodyFont(formData.documentType, formData.bodyFont),
    headerType: resolveHeaderType(formData.documentType, formData.headerType) as FormData['headerType'],
  };
  const styles = createStyles(
    formData.bodyFont || 'times',
    formData.accentColor
  );

  const isBusinessLetter = formData.documentType === 'business-letter';
  const isExecCorr = formData.documentType === 'executive-correspondence';
  const isExecLetter = isExecCorr && (formData.execFormat === 'letter' || !formData.execFormat);
  const isDLAType = formData.documentType?.startsWith('dla-') || false;
  const isDLAMemo = formData.documentType === 'dla-memorandum';
  const isDLABusinessLetter = formData.documentType === 'dla-business-letter';
  const isCivilianStyle = isBusinessLetter || isExecLetter || isDLAType;

  const sealDataUrl = getPDFSealDataUrl(formData.headerType as 'USMC' | 'DON' | 'DLA');
  const formattedDate = isCivilianStyle
    ? formatBusinessDate(formData.date || '')
    : parseAndFormatDate(formData.date || '');

  const viasWithContent = vias.filter((v) => v.trim());
  const refsWithContent = references.filter((r) => r.trim());
  const enclsWithContent = enclosures.filter((e) => e.trim());
  const copiesWithContent = copyTos.filter((c) => c.trim());
  const distListWithContent = distList.filter((d) => d.trim());
  const isDirective = formData.documentType === 'mco' || formData.documentType === 'bulletin' || formData.documentType === 'change-transmittal';
  const paragraphsWithContent = paragraphs.filter((p) => p.content.trim() || (isDirective && p.title && p.title.trim()));

  // Correspondence: paragraph indents from the relative engine
  // (SECNAV M-5216.5 Fig 7-8, content-relative). Directive/message
  // formats keep their dedicated paths until Phase 3/4.
  const relativeSpecs = isCorrespondenceType(formData.documentType)
    ? relativeIndentEngine.computeSpecs(
        paragraphsWithContent,
        formData.bodyFont === 'courier' ? 'courier' : 'times'
      )
    : isDirectiveType(formData.documentType)
      ? fixedLadderEngine.computeSpecs(paragraphsWithContent, 'courier')
      : undefined;

  const formattedSubjLines = splitSubject((formData.subj || '').toUpperCase(), PDF_SUBJECT.maxLineLength);
  const isFromToMemo = formData.documentType === 'from-to-memo';
  const isMfr = formData.documentType === 'mfr';
  const isMoaOrMou = formData.documentType === 'moa' || formData.documentType === 'mou';
  const isInformationPaper = formData.documentType === 'information-paper';
  // const isBusinessLetter defined above
  const isPositionPaper = formData.documentType === 'position-paper';
  const isDecisionPaper = formData.documentType === 'decision-paper';
  const isStaffingPaper = ['position-paper', 'information-paper', 'decision-paper'].includes(formData.documentType);

  // Determine if standard header (Seal + Letterhead) should be shown
  // HIDDEN for MFR, From-To Memo, and Staffing Papers (per MCO 5216.20B)
  const showStandardHeader = !isFromToMemo && !isMfr && !isStaffingPaper;

  const moaData = formData.moaData || {
    activityA: '',
    activityB: '',
    activityAHeader: { ssic: '', serial: '', date: '' },
    activityBHeader: { ssic: '', serial: '', date: '' },
    seniorSigner: { name: '', title: '', activity: '', date: '' },
    juniorSigner: { name: '', title: '', activity: '', date: '' }
  };
  
  // Logic to determine if we are in "Multiple Address" mode with MANY recipients (automatic list)
  // If true, we use the automatic list and HIDE the manual list to avoid duplication.
  const hasMultipleTo = formData.documentType === 'multiple-address' || formData.documentType === 'from-to-memo';
  const isMultipleAddressMany = hasMultipleTo &&
                               (formData.distribution?.recipients?.filter((r: string) => r && r.trim()).length || 0) > 1;
  const isToDistribution = hasMultipleTo && !!formData.distribution?.toDistribution;

  const getFromToSpacing = (label: string): string => {
    if (formData.bodyFont === 'courier') {
      if (label === 'From') return 'From:  ';
      if (label === 'To') return 'To:    ';
    }
    return `${label}:`;
  };

  // Via numbering rule shared with the DOCX emitter (M-5216.5: number
  // only when 2+ vias; single via unnumbered). The Times PDF renders
  // the label and the "(n)" in separate flex columns, so this local
  // helper only emits the label/number prefix; the single source of
  // truth for the numbering CONDITION is sharedGetViaSpacing.
  const getViaSpacing = (index: number, total: number): string => {
    if (formData.bodyFont === 'courier') {
      return sharedGetViaSpacing(index, 'courier', total);
    }
    if (total === 1) return 'Via:';
    return index === 0 ? 'Via:' : '';
  };

  const isEndorsement = formData.documentType === 'endorsement';
  const startPage = isEndorsement ? (formData.startingPageNumber || 1) : 1;

  // Calculate starting indices for refs/encls
  const startRefChar = isEndorsement && formData.startingReferenceLevel 
    ? formData.startingReferenceLevel.charCodeAt(0) 
    : 'a'.charCodeAt(0);
    
  const startEnclNum = isEndorsement && formData.startingEnclosureNumber
    ? parseInt(formData.startingEnclosureNumber, 10)
    : 1;

  const fontFamily = getPDFBodyFont(formData.bodyFont || 'times');

  // Roman numeral conversion for structural pages
  const toRoman = (n: number): string => {
    const map: [number, string][] = [[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']];
    let result = '';
    for (const [value, numeral] of map) {
      while (n >= value) { result += numeral; n -= value; }
    }
    return result;
  };

  // Extract headings for Table of Contents from level-1 paragraphs
  const tocEntries = isDirective && formData.showStructuralPages
    ? paragraphsWithContent
        .filter(p => p.level === 1 && (p.title || p.content))
        .map((p, i) => ({
          number: formData.fourDigitNumbering
            ? `${formData.chapterNumber || 1}${String(i + 1).padStart(3, '0')}`
            : `${i + 1}`,
          title: p.title || p.content.substring(0, 80),
        }))
    : [];

  // Dynamic roman numeral page numbers for structural pages
  // Locator Sheet is always "i"; Record of Changes and TOC shift based on what's enabled
  const romanNumerals = ['i', 'ii', 'iii', 'iv', 'v'];
  let structuralPageIndex = 0;
  const locatorSheetPageNum = formData.showLocatorSheet ? romanNumerals[structuralPageIndex++] : '';
  const recordOfChangesPageNum = formData.showRecordOfChanges ? romanNumerals[structuralPageIndex++] : '';
  const tocPageNum = formData.showStructuralPages ? romanNumerals[structuralPageIndex++] : '';

  // Pre-compute distribution statement text for use in fixed footer
  // P3.6: shared resolver — both emitters resolve fill-ins through
  // resolveDistributionStatement so the text can never diverge.
  const distributionStatementText = isDirective ? resolveDistributionStatement(formData) : '';

  return (
    <Document
      title={formData.subj || 'Naval Letter'}
      author="by Semper Admin"
      subject="Generated Naval Letter Format"
    >
      <Page size="LETTER" style={[styles.page, formData.isShortLetter ? { paddingLeft: 144, paddingRight: 144 } : {}]}>
        {/* Continuation page header - Subject line on pages 2+ (absolutely positioned) */}
        {/* For directives: show directive ID block (SSIC + date) per MCO 5215.1K para 38 */}
        <View
          style={styles.continuationHeader}
          fixed
          render={({ pageNumber }) => (
            pageNumber > 1 ? (
              <View>
                {isCivilianStyle && (
                   <View style={{ marginBottom: 12 }}>
                      <Text style={styles.addressLine}>{formData.ssic}</Text>
                      <Text style={styles.addressLine}>{formData.originatorCode}</Text>
                      {!formData.omitDate && <Text style={styles.addressLine}>{formattedDate}</Text>}
                   </View>
                )}
                {isDirective && (
                   /* P3.4/P4.2 (audit lines 98, 160): ID symbols flush
                      right, designation + date, originator code
                      omitted, stack top at 1 INCH from the page top
                      (band origin is PDF_MARGINS.top, so offset the
                      difference). */
                   <View style={{ alignItems: 'flex-end', marginTop: 72 - PDF_MARGINS.top }}>
                      <View style={{ alignItems: 'flex-start' }}>
                        <Text style={styles.addressLine}>
                          {getDirectiveDesignation(formData)}
                        </Text>
                        <Text style={styles.addressLine}>{formattedDate}</Text>
                      </View>
                   </View>
                )}
                {!isCivilianStyle && !isDirective && (
                  <View style={{ marginTop: CONTINUATION_SUBJ_OFFSET }}>
                    <View style={styles.continuationSubjLine}>
                      <Text style={styles.continuationSubjLabel}>Subj:</Text>
                      <Text style={styles.continuationSubjText}>{formattedSubjLines[0]}</Text>
                    </View>
                    {formattedSubjLines.slice(1).map((line, i) => (
                      <Text key={i} style={{ marginLeft: PDF_INDENTS.tabStop1 }}>{line}</Text>
                    ))}
                  </View>
                )}
              </View>
            ) : null
          )}
        />
        
        {/* Fixed spacer - reserves space at top for continuation header on pages 2+ */}
        <View
          fixed
          render={({ pageNumber }) => (
            pageNumber > 1 ? (
              <View style={{ height: isDirective
                ? CONTINUATION_HEADER_HEIGHT
                : isCivilianStyle
                  ? CONTINUATION_HEADER_HEIGHT + 48
                  : CONTINUATION_SPACER_NAVAL }} />
            ) : null
          )}
        />
        
        {/* Seal - Only on first page */}
        {showStandardHeader && <Image src={sealDataUrl} style={styles.seal} />}

        {/* Letterhead - Only on first page */}
        {showStandardHeader && (
        <View style={styles.letterhead}>
          {/* DLA letterhead: 12pt bold agency name, 10pt sub-lines per DLA Correspondence Manual Ch.1 Para 17.f.(4) */}
          {isDLAType ? (
            <>
              <Text style={[styles.headerTitle, { fontSize: 12 }]}>DEFENSE LOGISTICS AGENCY</Text>
              {formData.line1 && <Text style={[styles.headerLine, { fontSize: 10 }]}>{formData.line1}</Text>}
              {formData.line2 && <Text style={[styles.headerLine, { fontSize: 10 }]}>{formData.line2}</Text>}
              {formData.line3 && <Text style={[styles.headerLine, { fontSize: 10 }]}>{formData.line3}</Text>}
            </>
          ) : (
            <>
              <Text style={styles.headerTitle}>
                {formData.headerType === 'USMC'
                  ? 'UNITED STATES MARINE CORPS'
                  : 'DEPARTMENT OF THE NAVY'}
              </Text>
              {formData.line1 && <Text style={styles.headerLine}>{formData.line1}</Text>}
              {formData.line2 && <Text style={styles.headerLine}>{formData.line2}</Text>}
              {formData.line3 && <Text style={styles.headerLine}>{formData.line3}</Text>}
            </>
          )}
        </View>
        )}

        {/* One empty line after letterhead */}
        {showStandardHeader && <View style={styles.emptyLine} />}

        {/* From-To Memo and MFR Date - Flush Right, top of content */}
        {(isFromToMemo || isMfr) && (
            <View style={{ marginBottom: PDF_SPACING.sectionGap, marginTop: 24, alignItems: 'flex-end' }}>
                <Text style={styles.addressLine}>{formattedDate}</Text>
            </View>
        )}

        {/* Bulletin cancellation date — centered in right half, two lines above SSIC */}
        {!isFromToMemo && !isMfr && !isMoaOrMou && !isStaffingPaper &&
          formData.documentType === 'bulletin' && formData.cancellationDate && (
          /* P3.4: right-aligned, one blank above the SSIC position
             (audit lines 144/170). */
          <View style={{ marginBottom: PDF_SPACING.emptyLine, alignItems: 'flex-end' }}>
            <Text style={styles.addressLine}>
              {formData.cancellationType === 'contingent' ? 'Canc frp: ' : 'Canc: '}{formatCancellationDate(formData.cancellationDate)}
            </Text>
          </View>
        )}

        {/* SSIC Block - Hide for MFR, FromToMemo, Staffing Papers, DLA types */}
        {/* New Layout: Flush Right Container, Left Aligned Text Content */}
        {!isFromToMemo && !isMfr && !isMoaOrMou && !isStaffingPaper && !isDLAType && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: PDF_SPACING.sectionGap }}>
             <View style={{ alignItems: 'flex-start' }}>
                <Text style={styles.addressLine}>
                  {/* P3.4: designation = abbreviation + SSIC (audit line 138) */}
                  {isDirective ? getDirectiveDesignation(formData) : (formData.ssic || '')}
                </Text>
                <Text style={styles.addressLine}>{formData.originatorCode || ''}</Text>
                <Text style={styles.addressLine}>{formattedDate}</Text>
             </View>
          </View>
        )}

        {/* Business Letter Inside Address & Salutation */}
        {isBusinessLetter && (
             <View style={{ 
                marginTop: formData.isWindowEnvelope ? 84 : 0,
                marginBottom: PDF_SPACING.sectionGap,
                marginLeft: 0 
             }}>
                 {formData.recipientName && <Text style={styles.addressLine}>{formData.recipientName}</Text>}
                 {formData.recipientTitle && <Text style={styles.addressLine}>{formData.recipientTitle}</Text>}
                 {formData.businessName && <Text style={styles.addressLine}>{formData.businessName}</Text>}
                 {(formData.recipientAddress || '').split('\n').map((line: string, i: number) => (
                     <Text key={i} style={styles.addressLine}>{line}</Text>
                 ))}

                 {formData.attentionLine && (
                     <Text style={[styles.addressLine, { marginTop: 12, marginBottom: 12 }]}>
                         Attention: {formData.attentionLine}
                     </Text>
                 )}

                 <Text style={[styles.addressLine, { marginTop: 24 }]}>
                     {formData.salutation || 'Dear Sir or Madam:'}
                 </Text>

                 {/* Subject Line (Optional) */}
                 {formData.subj && (
                    <View style={{ flexDirection: 'row', marginTop: 12 }}>
                        <Text style={[styles.addressLine, { width: 62 }]}>SUBJECT:</Text>
                        <Text style={[styles.addressLine, { flex: 1, textTransform: 'uppercase' }]}>
                            {formData.subj}
                        </Text>
                    </View>
                 )}
             </View>
        )}

        {/* Executive Letter Inside Address & Salutation */}
        {isExecLetter && (
             <View style={{
                marginBottom: PDF_SPACING.sectionGap,
                marginLeft: 0
             }}>
                 {!formData.omitDate && formattedDate && (
                   <Text style={[styles.addressLine, { textAlign: 'right', marginBottom: 24 }]}>
                     {formattedDate}
                   </Text>
                 )}
                 {formData.recipientName && <Text style={styles.addressLine}>{formData.recipientName}</Text>}
                 {formData.recipientTitle && <Text style={styles.addressLine}>{formData.recipientTitle}</Text>}
                 {formData.organizationName && <Text style={styles.addressLine}>{formData.organizationName}</Text>}
                 {(formData.recipientAddress || '').split('\n').map((line: string, i: number) => (
                     <Text key={i} style={styles.addressLine}>{line}</Text>
                 ))}

                 <Text style={[styles.addressLine, { marginTop: 24 }]}>
                     {formData.salutation || 'Dear Sir or Madam:'}
                 </Text>

                 {formData.subj && (
                    <View style={{ flexDirection: 'row', marginTop: 12 }}>
                        <Text style={[styles.addressLine, { width: 62 }]}>SUBJECT:</Text>
                        <Text style={[styles.addressLine, { flex: 1 }]}>
                            {formData.subj}
                        </Text>
                    </View>
                 )}
             </View>
        )}

        {/* DLA Memorandum Header — Suspense Date + Date (flush right) + MEMORANDUM FOR / THROUGH / SUBJECT */}
        {isDLAMemo && (
          <View>
            {/* Suspense date (two lines above document date, flush right) */}
            {formData.suspenseDate && (
              <View style={{ alignItems: 'flex-end', marginBottom: PDF_SPACING.emptyLine }}>
                <Text style={styles.addressLine}>S: {formatBusinessDate(formData.suspenseDate)}</Text>
              </View>
            )}
            {/* Date flush right */}
            <View style={{ alignItems: 'flex-end', marginBottom: PDF_SPACING.sectionGap }}>
              <Text style={styles.addressLine}>{formattedDate}</Text>
            </View>
            {/* MEMORANDUM FOR */}
            <View style={{ flexDirection: 'row', marginBottom: PDF_SPACING.emptyLine }}>
              <Text style={[styles.addressLine, { width: 130, minWidth: 130 }]}>MEMORANDUM FOR</Text>
              <Text style={styles.addressLine}>{formData.memorandumFor || ''}</Text>
            </View>
            {/* THROUGH (optional) */}
            {formData.through && (
              <View style={{ flexDirection: 'row', marginBottom: PDF_SPACING.emptyLine }}>
                <Text style={[styles.addressLine, { width: 130, minWidth: 130 }]}>THROUGH</Text>
                <Text style={styles.addressLine}>{formData.through}</Text>
              </View>
            )}
            {/* SUBJECT — Title Case per DLA Corr Manual Ch.3 Para 8 */}
            <View style={{ flexDirection: 'row', marginBottom: PDF_SPACING.sectionGap }}>
              <Text style={[styles.addressLine, { width: 130, minWidth: 130 }]}>SUBJECT:</Text>
              <Text style={[styles.addressLine, { flex: 1 }]}>{formData.subj || ''}</Text>
            </View>
          </View>
        )}

        {/* DLA Business Letter — Suspense Date + Date (flush right) + Inside Address + Salutation + Subject */}
        {isDLABusinessLetter && (
          <View>
            {/* Suspense date (two lines above document date, flush right) */}
            {formData.suspenseDate && (
              <View style={{ alignItems: 'flex-end', marginBottom: PDF_SPACING.emptyLine }}>
                <Text style={styles.addressLine}>S: {formatBusinessDate(formData.suspenseDate)}</Text>
              </View>
            )}
            {/* Date flush right */}
            <View style={{ alignItems: 'flex-end', marginBottom: PDF_SPACING.sectionGap }}>
              <Text style={styles.addressLine}>{formattedDate}</Text>
            </View>
            {/* Inside Address */}
            <View style={{ marginBottom: PDF_SPACING.sectionGap }}>
              {formData.recipientName && <Text style={styles.addressLine}>{formData.recipientName}</Text>}
              {formData.recipientTitle && <Text style={styles.addressLine}>{formData.recipientTitle}</Text>}
              {formData.businessName && <Text style={styles.addressLine}>{formData.businessName}</Text>}
              {(formData.recipientAddress || '').split('\n').map((line: string, i: number) => (
                <Text key={i} style={styles.addressLine}>{line}</Text>
              ))}
            </View>
            {/* Salutation */}
            <Text style={[styles.addressLine, { marginBottom: PDF_SPACING.sectionGap }]}>
              {formData.salutation || 'Dear Sir or Madam:'}
            </Text>
            {/* SUBJECT */}
            {formData.subj && (
              <View style={{ flexDirection: 'row', marginBottom: PDF_SPACING.sectionGap }}>
                <Text style={[styles.addressLine, { width: 70 }]}>SUBJECT:</Text>
                <Text style={[styles.addressLine, { flex: 1, textTransform: 'uppercase' }]}>{formData.subj}</Text>
              </View>
            )}
          </View>
        )}

        {/* Endorsement Identification Line - Between date and From */}
        {isEndorsement && formData.endorsementLevel && formData.basicLetterReference && (
          <View style={{ marginBottom: PDF_SPACING.sectionGap }}>
            <Text style={styles.addressLine}>
              {`${formData.endorsementLevel} ENDORSEMENT on ${formData.basicLetterReference}`}
            </Text>
          </View>
        )}

        {/* Directive Title Line - Between date and From (MCO/Bulletin) */}
        {isDirective && (formData.directiveTitle || formData.ssic) && (
          <View style={{ marginBottom: PDF_SPACING.sectionGap }}>
            <Text style={[styles.addressLine, { textDecoration: 'underline' }]}>
              {(formData.directiveTitle || buildDirectiveTitle(formData)).toUpperCase()}
            </Text>
          </View>
        )}

        {/* MFR Title */}
        {formData.documentType === 'mfr' && (
          <View style={{ marginBottom: PDF_SPACING.sectionGap }}>
            <Text style={[styles.addressLine, { textAlign: 'left' }]}>
              MEMORANDUM FOR THE RECORD
            </Text>
          </View>
        )}

        {/* From-To Memo Title */}
        {isFromToMemo && (
          <View style={{ marginBottom: PDF_SPACING.sectionGap, marginTop: 12, alignItems: 'flex-start' }}>
            <Text style={[styles.addressLine, { textAlign: 'left' }]}>
              MEMORANDUM
            </Text>
          </View>
        )}

        {/* Letterhead Memo Title - Between date and MEMORANDUM FOR */}
        {formData.documentType === 'letterhead-memo' && (
          <View style={{ marginBottom: PDF_SPACING.sectionGap }}>
             <Text style={[styles.addressLine, { textAlign: 'left' }]}>
              MEMORANDUM
            </Text>
          </View>
        )}

        {/* MOA/MOU Header */}
        {isMoaOrMou && (
            <>
              {/* Side-by-Side Activity Header */}
              <View style={{
                flexDirection: 'row',
                marginBottom: 14,
                marginTop: 12,
                fontFamily: fontFamily,
                fontSize: PDF_FONT_SIZES.body
              }}>
                 {/* Left Side: Activity B (Junior) - Starts at left margin */}
                 <View style={{ width: '50%' }}>
                   <Text>{(moaData.juniorSigner.activitySymbol || moaData.activityB || '').toUpperCase()}</Text>
                   {moaData.activityBHeader?.ssic && <Text>{moaData.activityBHeader.ssic}</Text>}
                   {moaData.activityBHeader?.serial && <Text>{moaData.activityBHeader.serial}</Text>}
                   {moaData.activityBHeader?.date && <Text>{moaData.activityBHeader.date}</Text>}
                 </View>

                 {/* Right Side: Activity A (Senior) - Dynamically placed based on longest line (Flush Right block, Left Text) */}
                 <View style={{ width: '50%', alignItems: 'flex-end' }}>
                   <View style={{ alignItems: 'flex-start' }}>
                     <Text>{(moaData.seniorSigner.activitySymbol || moaData.activityA || '').toUpperCase()}</Text>
                     {moaData.activityAHeader?.ssic && <Text>{moaData.activityAHeader.ssic}</Text>}
                     {moaData.activityAHeader?.serial && <Text>{moaData.activityAHeader.serial}</Text>}
                     {moaData.activityAHeader?.date && <Text>{moaData.activityAHeader.date}</Text>}
                   </View>
                 </View>
              </View>

              <View style={styles.moaHeader}>
                <Text style={styles.moaTitle}>
                    {formData.documentType === 'moa' ? 'MEMORANDUM OF AGREEMENT' : 'MEMORANDUM OF UNDERSTANDING'}
                </Text>
                <Text style={styles.moaBetween}>BETWEEN</Text>
                <Text style={styles.moaActivity}>{(moaData.activityA || '').toUpperCase()}</Text>
                <Text style={styles.moaAnd}>AND</Text>
                <Text style={styles.moaActivity}>{(moaData.activityB || '').toUpperCase()}</Text>
              </View>
            </>
        )}

        {/* Subj line for MOA/MOU - uses same subjectSection style as standard letter */}
        {isMoaOrMou && (
          <View style={styles.subjectSection}>
            {formData.bodyFont === 'courier' ? (
              <>
                <Text>Subj:  {formattedSubjLines[0]}</Text>
                {formattedSubjLines.slice(1).map((line, i) => (
                  <Text key={i} style={styles.subjectContinuation}>
                    {'       '}{line}
                  </Text>
                ))}
              </>
            ) : (
              <>
                <View style={styles.subjectLine}>
                  <Text style={styles.subjectLabel}>Subj:</Text>
                  <Text>{formattedSubjLines[0] || ''}</Text>
                </View>
                {formattedSubjLines.slice(1).map((line, i) => (
                  <Text key={i} style={{ marginLeft: PDF_INDENTS.tabStop1 }}>{line}</Text>
                ))}
              </>
            )}
          </View>
        )}

        {/* Staffing Paper Header */}
        {isStaffingPaper && (
          <View style={{ marginBottom: 0 }}>
              {/* Top Classification */}
              <Text style={styles.infoPaperClassification}>
                  {formData.classification || 'UNCLASSIFIED'}
              </Text>
              
              {/* ID Block (Right) */}
              <View style={styles.infoPaperIdBlock}>
                <View style={{ alignItems: 'flex-start' }}>
                  <Text style={styles.addressLine}>{formData.drafterOfficeCode || ''}</Text>
                  <Text style={styles.addressLine}>{formattedDate || ''}</Text>
                </View>
              </View>

              {/* Title */}
              <Text style={styles.infoPaperTitle}>
                  {isPositionPaper ? 'POSITION PAPER' : isDecisionPaper ? 'DECISION PAPER' : 'INFORMATION PAPER'}
              </Text>
              
              {/* Subject for Position Paper/Info Paper */}
              <View style={{ marginTop: 12, marginBottom: PDF_SPACING.sectionGap }}>
                {formData.bodyFont === 'courier' ? (
                  <>
                    <Text style={styles.staffingPaperSubject}>
                      Subj:{'\u00A0'}{formattedSubjLines[0] || ''}
                    </Text>
                    {formattedSubjLines.slice(1).map((line, i) => (
                      <Text key={i} style={[styles.staffingPaperSubject, { marginLeft: PDF_INDENTS.tabStop1 }]}>
                        {'       '}{line}
                      </Text>
                    ))}
                  </>
                ) : (
                  <>
                    <View style={{ flexDirection: 'row' }}>
                      <Text style={[styles.staffingPaperSubject, { width: PDF_INDENTS.tabStop1 }]}>Subj:{'\u00A0'}</Text>
                      <Text style={styles.staffingPaperSubject}>{formattedSubjLines[0] || ''}</Text>
                    </View>
                    {formattedSubjLines.slice(1).map((line, i) => (
                      <Text key={i} style={[styles.staffingPaperSubject, { marginLeft: PDF_INDENTS.tabStop1 }]}>
                        {line}
                      </Text>
                    ))}
                  </>
                )}
              </View>
          </View>
        )}

        {/* From/To/Via - Hide for MFR, MOA/MOU, Staffing Papers, Business Letter, Exec Letter */}
        {formData.documentType !== 'mfr' && !isMoaOrMou && !isStaffingPaper && !isCivilianStyle && (
        <View style={styles.fromToSection}>
          {/* From Line - Common */}
          {formData.bodyFont === 'courier' ? (
             <Text style={styles.addressLine}>{getFromToSpacing('From')}{formData.from}</Text>
          ) : (
             <View style={styles.fromToLine}>
                <Text style={styles.fromToLabel}>From:</Text>
                <Text>{formData.from}</Text>
             </View>
          )}

          {/* To Line(s) */}
          {hasMultipleTo ? (
             // Multiple Address Logic
             (() => {
                const recipients = formData.distribution?.recipients || (formData.to ? [formData.to] : ["Addressee"]);
                const recipientsWithContent = recipients.filter((r: string) => r && r.trim());
                if (recipientsWithContent.length === 0) recipientsWithContent.push("Addressee");

                if (isToDistribution) {
                    // "To Distribution" toggle is ON: To line says "Distribution"
                    return formData.bodyFont === 'courier' ? (
                         <Text style={styles.addressLine}>{getFromToSpacing('To')}Distribution</Text>
                    ) : (
                         <View style={styles.fromToLine}>
                            <Text style={styles.fromToLabel}>To:</Text>
                            <Text>Distribution</Text>
                         </View>
                    );
                } else {
                    // Toggle OFF: list recipients directly under To, aligned at same position
                    return recipientsWithContent.map((r: string, i: number) => (
                      formData.bodyFont === 'courier' ? (
                        <Text key={i} style={styles.addressLine}>
                          {i === 0
                            ? `To:\u00A0\u00A0\u00A0\u00A0${r}`
                            : `\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0${r}`}
                        </Text>
                      ) : (
                        <View key={i} style={styles.fromToLine}>
                          <Text style={{ width: PDF_INDENTS.tabStop1, minWidth: PDF_INDENTS.tabStop1 }}>{i === 0 ? 'To:' : '\u00A0'}</Text>
                          <Text>{r}</Text>
                        </View>
                      )
                    ));
                }
             })()
          ) : (
             // Standard Logic
             formData.bodyFont === 'courier' ? (
                <Text style={styles.addressLine}>{getFromToSpacing('To')}{formData.to}</Text>
             ) : (
                <View style={styles.fromToLine}>
                    <Text style={styles.fromToLabel}>To:</Text>
                    <Text>{formData.to}</Text>
                </View>
             )
          )}

          {/* Via Lines */}
          {viasWithContent.map((via, i) => (
            formData.bodyFont === 'courier' ? (
              <Text key={i} style={styles.addressLine}>
                {getViaSpacing(i, viasWithContent.length)}{via}
              </Text>
            ) : (
              <View key={i} style={styles.fromToLine}>
                <Text style={styles.fromToLabel}>{i === 0 ? 'Via:' : ''}</Text>
                {viasWithContent.length > 1 ? (
                  <Text>({i + 1}) {via}</Text>
                ) : (
                  <Text>{via}</Text>
                )}
              </View>
            )
          ))}
        </View>
        )}

        {/* Subject */}
        {/* Subject Line - Hide for MOA/MOU (handled in header), Staffing Papers (handled in custom header), Business/Exec Letter (custom placement) */}
        {!isMoaOrMou && !isStaffingPaper && !isCivilianStyle && (
        <View style={styles.subjectSection}>
          {formData.bodyFont === 'courier' ? (
            <>
              <Text>Subj:  {formattedSubjLines[0] || ''}</Text>
              {formattedSubjLines.slice(1).map((line, i) => (
                <Text key={i} style={styles.subjectContinuation}>
                  {'       '}{line}
                </Text>
              ))}
            </>
          ) : (
            <>
              <View style={styles.subjectLine}>
                <Text style={styles.subjectLabel}>Subj:</Text>
                <Text>{formattedSubjLines[0] || ''}</Text>
              </View>
              {formattedSubjLines.slice(1).map((line, i) => (
                <Text key={i} style={{ marginLeft: PDF_INDENTS.tabStop1 }}>{line}</Text>
              ))}
            </>
          )}
        </View>
        )}

        {/* References - Hide for Business/Exec Letter (but show for DLA) */}
        {(!isCivilianStyle || isDLAType) && refsWithContent.length > 0 && (
          <View style={styles.refEnclSection}>
            {refsWithContent.map((ref, i) => {
              const refLetter = String.fromCharCode(startRefChar + i);
              if (formData.bodyFont === 'courier') {
                const prefix = i === 0
                  ? `Ref:\u00A0\u00A0\u00A0(${refLetter})\u00A0`
                  : `\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0(${refLetter})\u00A0`;
                return <Text key={i}>{prefix}{ref}</Text>;
              }
              return (
                <View key={i} style={styles.refEnclLine}>
                  <Text style={styles.refEnclLabel}>{i === 0 ? 'Ref:' : ''}</Text>
                  <Text style={{ width: 18 }}>({refLetter})</Text>
                  <Text style={{ flex: 1 }}>{ref}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Enclosures / Tabs / Attachments - Hide for Business/Exec Letter (rendered at bottom), show for DLA */}
        {(!isCivilianStyle || isDLAType) && enclsWithContent.length > 0 && (
          isDLAType ? (
            // DLA uses "Attachments" (not "Enclosures") per DLA Corr Manual Ch.3 Para 19
            <View style={styles.refEnclSection}>
              <Text style={styles.addressLine}>
                {enclsWithContent.length > 1 ? 'Attachments:' : 'Attachment:'}
              </Text>
              {enclsWithContent.map((encl, i) => (
                <Text key={i} style={styles.addressLine}>
                  {enclsWithContent.length > 1 ? `${i + 1}.  ${encl}` : encl}
                </Text>
              ))}
            </View>
          ) : (
          <View style={styles.refEnclSection}>
            {enclsWithContent.map((encl, i) => {
              const isPositionPaper = formData.documentType === 'position-paper';
              const enclNum = startEnclNum + i;
              const enclLabel = isPositionPaper ? 'Tab:' : 'Encl:';
              // Tabs use A, B, C... Enclosures use (1), (2), (3)...
              const enclIndicator = isPositionPaper ? String.fromCharCode(65 + i) : `(${enclNum})`;

              if (formData.bodyFont === 'courier') {
                // Adjust spacing for "Tab:" (4 chars) vs "Encl:" (5 chars)
                // Actually "Tab:" is 4, "Encl:" is 5.
                // Standard letter uses 2 spaces after colon.
                const labelStr = i === 0 ? enclLabel : '';
                const padding = i === 0
                    ? (isPositionPaper ? '\u00A0\u00A0' : '\u00A0\u00A0')
                    : (isPositionPaper ? '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0' : '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0');

                // For Courier, we need precise alignment.
                // Tab:  (A)  Item
                //       (B)  Item
                // Encl: (1)  Item
                //       (2)  Item

                // Let's use a simplified approach for now consistent with previous code
                 const prefix = i === 0
                  ? `${enclLabel}\u00A0\u00A0${isPositionPaper ? '' : ''}${enclIndicator}\u00A0`
                  : `\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0${enclIndicator}\u00A0`;

                // If it's Tab (shorter label), we might need an extra space to align if mixed (but they aren't mixed)
                return <Text key={i}>{prefix}{encl}</Text>;
              }
              return (
                <View key={i} style={styles.refEnclLine}>
                  <Text style={styles.refEnclLabel}>{i === 0 ? enclLabel : ''}</Text>
                  <Text style={{ width: 18 }}>{enclIndicator}</Text>
                  <Text style={{ flex: 1 }}>{encl}</Text>
                </View>
              );
            })}
          </View>
          )
        )}



        {/* Reports Required (for Directives) - before first paragraph per MCO 5216.20B par. 29b */}
        {isDirective && formData.reports && formData.reports.filter((r: { title: string }) => r.title).length > 0 && (() => {
          const validReports = formData.reports.filter((r: { title: string }) => r.title);
          const plural = validReports.length > 1;
          const label = `Report${plural ? 's' : ''} Required:`;
          // Label width must accommodate "Reports Required:" without wrapping
          // Courier/Liberation Mono: 18 chars × 7.2pt = 129.6pt; Times/Serif fits in ~88pt
          const labelWidth = fontFamily === 'Liberation Mono' ? 135 : 120;

          if (validReports.length <= 4) {
            return (
              <View style={{ marginBottom: PDF_SPACING.sectionGap }}>
                {validReports.map((report: { id: string; title: string; controlSymbol: string; paragraphRef: string; exempt?: boolean }, idx: number) => {
                  const numeral = validReports.length > 1 ? `${toRoman(idx + 1).toUpperCase()}.` : '';
                  const controlText = report.exempt ? 'EXEMPT' : (report.controlSymbol ? `Report Control Symbol ${report.controlSymbol}` : '');
                  const parRef = report.paragraphRef ? `, par. ${report.paragraphRef}` : '';
                  const reportText = `${report.title}${controlText ? ` (${controlText})` : ''}${parRef}`;
                  return (
                    <View key={report.id || idx} wrap={false} style={{ flexDirection: 'row', fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body }}>
                      <Text style={{ width: labelWidth, flexShrink: 0 }}>{idx === 0 ? label : ''}</Text>
                      {validReports.length > 1 && (
                        <Text style={{ width: fontFamily === 'Liberation Mono' ? 30 : 26, flexShrink: 0, textAlign: 'right', paddingRight: 4 }}>{numeral}</Text>
                      )}
                      <Text style={{ flex: 1 }}>{reportText}</Text>
                    </View>
                  );
                })}
              </View>
            );
          } else {
            // 5+ reports: refer to the Reports Required page
            return (
              <View style={{ marginBottom: PDF_SPACING.sectionGap }}>
                <View style={{ flexDirection: 'row', fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body }}>
                  <Text style={{ width: labelWidth, flexShrink: 0 }}>Reports Required:</Text>
                  <Text style={{ flex: 1 }}>See page following signature page.</Text>
                </View>
              </View>
            );
          }
        })()}

        {/* Body paragraphs - text wraps to left margin */}
        <View style={[styles.bodySection,
          (relativeSpecs && !isMoaOrMou && !isStaffingPaper && !isCivilianStyle && formData.sig)
            ? { marginBottom: 0 } : {}]}>
          {paragraphsWithContent.map((p, i) => {
             // Custom handling for Position/Decision Paper - Paragraph 4 (Recommendation)
             // We wrap this paragraph AND the Decision Grid together to prevent orphans
             // STRICTLY check for 'Recommendation' title to avoid hijacking other paragraphs (like 2b)
             if ((formData.documentType === 'position-paper' || formData.documentType === 'decision-paper') &&
                 p.title && p.title.toLowerCase().includes('recommendation')) {
         
                 return (
                     <View key={p.id} wrap={false} style={{ marginLeft: PDF_PARAGRAPH_TABS[1].citation, marginBottom: PDF_SPACING.paragraph }}>
                         {/* 4. Recommendation. */}
                        <Text>
                            {generateCitation(p, i, paragraphsWithContent, formData.documentType, formData.fourDigitNumbering, formData.chapterNumber)}
                            {/* Restore title for the actual Recommendation paragraph */}
                            {p.title && (
                                <Text>
                                    {'\u00A0\u00A0'}{p.title}.
                                </Text>
                            )}
                            {/* Render content inline for ALL modes */}
                            {p.content && (
                                <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body }}>
                                   {'\u00A0\u00A0'}{p.content}
                                </Text>
                            )}
                        </Text>
                         
                         {/* Content of Recommendation Paragraph */}
                         {/* If MULTIPLE_RECS, content is generated from grid items. */}
                         
                         {formData.decisionMode === 'MULTIPLE_RECS' ? (
                            // MULTIPLE_RECS Logic (Embedded Grid)
                            // We re-use the SINGLE/MULTIPLE_CHOICE layout logic for each recommendation item.
                            formData.decisionGrid?.recommendationItems?.map((item: { id: string; text: string }, idx: number) => (
                                 <View key={item.id} style={{ marginTop: 12, marginRight: 0 }}> 
                                     {/* Item Text: a. Approve adoption... */}
                                     <Text style={{ marginBottom: 12, fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body }}>
                                         {String.fromCharCode(97 + idx)}.{'\u00A0\u00A0'}{item.text}
                                     </Text>
                                     
                                     {/* Routing Chain - Same layout as SINGLE mode */}
                                     {formData.decisionGrid?.recommenders.map((rec: { id: string; role: string; options: string[] }, rIdx: number) => (
                                        <View key={rIdx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                            <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, maxWidth: '50%' }}>
                                                {rec.role} recommends:
                                            </Text>
                                            <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                                                {rec.options.map((opt: string, j: number) => {
                                                    // Mapping "Approve" -> "Approval" for display consistency
                                                    let displayOpt = opt;
                                                    if (opt === 'Approve') displayOpt = 'Approval';
                                                    if (opt === 'Disapprove') displayOpt = 'Disapproval';

                                                    return (
                                                        <View key={j} style={{ flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                                                            <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, marginRight: 8 }}>
                                                                {displayOpt}
                                                            </Text>
                                                            <View style={{ borderBottomWidth: 1, borderBottomColor: 'black', width: 100 }} />
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                     ))}
                                     
                                     {/* Final Decision - Same layout as SINGLE mode */}
                                     {formData.decisionGrid?.finalDecision && (
                                       <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 12 }}>
                                           <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, maxWidth: '50%', fontWeight: 'bold' }}>
                                               {formData.decisionGrid.finalDecision.role} decision:
                                           </Text>
                                           <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                                               {formData.decisionGrid.finalDecision.options.map((opt: string, j: number) => {
                                                   // Mapping "Approved" -> "Approved" (no change needed usually, but just in case)
                                                   let displayOpt = opt;
                                                   // Ensure consistent past tense if needed, but usually it's "Approved" / "Disapproved" in the data
                                                   
                                                   return (
                                                       <View key={j} style={{ flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                                                           <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, marginRight: 8 }}>
                                                               {displayOpt}
                                                           </Text>
                                                           <View style={{ borderBottomWidth: 1, borderBottomColor: 'black', width: 100 }} />
                                                       </View>
                                                   );
                                               })}
                                           </View>
                                       </View>
                                     )}
                                 </View>
                             ))
                         ) : (
                            // SINGLE / MULTIPLE_CHOICE Logic
                            <>
                                {/* Render the Decision Grid immediately after */}
                                {formData.decisionGrid && (
                                    <View style={{ marginTop: 12, marginRight: 0 }}>
                                       {/* Recommenders */}
                                       {formData.decisionGrid.recommenders.map((rec: { id: string; role: string; options: string[] }, rIdx: number) => (
                                          <View key={rIdx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                              <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, maxWidth: '50%' }}>
                                                  {rec.role} recommends:
                                              </Text>
                                              <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                                                  {rec.options.map((opt: string, j: number) => {
                                                      let displayOpt = opt;
                                                      if (formData.decisionMode === 'SINGLE') {
                                                          if (opt === 'Approve') displayOpt = 'Approval';
                                                          if (opt === 'Disapprove') displayOpt = 'Disapproval';
                                                      }
                                                      return (
                                                          <View key={j} style={{ flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                                                              <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, marginRight: 8 }}>
                                                                  {displayOpt}
                                                              </Text>
                                                              <View style={{ borderBottomWidth: 1, borderBottomColor: 'black', width: 100 }} />
                                                          </View>
                                                      );
                                                  })}
                                              </View>
                                          </View>
                                        ))}
                          
                                        {/* Final Decision */}
                                        {formData.decisionGrid.finalDecision && (
                                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 0 }}>
                                              <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, maxWidth: '50%' }}>
                                                  {formData.decisionGrid.finalDecision.role} decision:
                                              </Text>
                                              <View style={{ flexDirection: 'column', alignItems: 'flex-end' }}>
                                                  {(() => {
                                                       const finalOptions = formData.decisionGrid.finalDecision.options;

                                                       return finalOptions.map((opt: string, j: number) => {
                                                           return (
                                                              <View key={j} style={{ flexDirection: 'row', marginBottom: 8, alignItems: 'flex-end', justifyContent: 'flex-end' }}>
                                                                  <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, marginRight: 8 }}>
                                                                      {opt}
                                                                  </Text>
                                                                  <View style={{ borderBottomWidth: 1, borderBottomColor: 'black', width: 100 }} />
                                                              </View>
                                                           );
                                                      });
                                                  })()}
                                              </View>
                                          </View>
                                        )}
                                    </View>
                                 )}
                             </>
                         )}
                     </View>
                 );
             }

            return (
            <ParagraphItem
              key={p.id}
              paragraph={p}
              index={i}
              allParagraphs={paragraphsWithContent}
              bodyFont={formData.bodyFont}
              shouldBoldTitle={!['mco', 'moa', 'mou', 'information-paper', 'position-paper'].includes(formData.documentType)}
              shouldUppercaseTitle={!['mco', 'bulletin', 'change-transmittal', 'moa', 'mou', 'information-paper', 'position-paper'].includes(formData.documentType)}
              documentType={formData.documentType}
              isShortLetter={formData.isShortLetter}
              fourDigitNumbering={formData.fourDigitNumbering}
              chapterNumber={formData.chapterNumber}
              spec={relativeSpecs?.[i]}
              isLast={!!relativeSpecs && i === paragraphsWithContent.length - 1}
            />
          );
          })}
        </View>

        {/* Reports Required removed – rendered before body paragraphs per MCO 5216.20B */}

        {/* Signature block - Standard (Hide for MOA/MOU, Staffing Papers, Business/Exec Letter) */}
        {!isMoaOrMou && !isStaffingPaper && !isCivilianStyle && formData.sig && (
          <View style={styles.signatureBlock} wrap={false}>
            {/* P3.3 (G5): 3 blanks = 4th line (M-5216.5 7-2.16); USMC
                directives 4 blanks = 5th line (MCO 5215.1K para 37). */}
            {Array.from({ length: getSignatureBlankLines(formData.documentType) }, (_, k) => (
              <View key={k} style={styles.emptyLine} />
            ))}
            <Text style={[styles.signatureLine, { textAlign: 'left' }]}>{formData.sig.toUpperCase()}</Text>
            {!isFromToMemo && formData.delegationText && (
              <Text style={[styles.signatureLine, { textAlign: 'left' }]}>{formData.delegationText}</Text>
            )}
          </View>
        )}

        {/* DLA Memorandum Signature Block — 4 blank lines, centered, with rank/title per Ch.3-2 Para 16-17 */}
        {isDLAMemo && (
          <View style={styles.signatureBlock} wrap={false}>
            <View style={styles.emptyLine} />
            <View style={styles.emptyLine} />
            <View style={styles.emptyLine} />
            <View style={styles.emptyLine} />
            {formData.signerFullName && (
              <Text style={[styles.signatureLine, { textAlign: 'center' }]}>{formData.signerFullName}</Text>
            )}
            {formData.signerRank && (
              <Text style={[styles.signatureLine, { textAlign: 'center' }]}>{formData.signerRank}</Text>
            )}
            {formData.signerTitle && (
              <Text style={[styles.signatureLine, { textAlign: 'center' }]}>{formData.signerTitle}</Text>
            )}
            {formData.delegationText && (
              <Text style={[styles.signatureLine, { textAlign: 'center' }]}>{formData.delegationText}</Text>
            )}
          </View>
        )}

        {/* DLA Business Letter Closing Block — with complimentary close */}
        {isDLABusinessLetter && (
          <View>
            <View style={{ marginBottom: PDF_SPACING.sectionGap * 3, marginLeft: PDF_INDENTS.signature }}>
              <View style={styles.emptyLine} />
              <Text style={styles.addressLine}>
                {formData.complimentaryClose || 'Sincerely,'}
              </Text>
            </View>
            <View style={{ marginBottom: PDF_SPACING.sectionGap, marginLeft: PDF_INDENTS.signature }}>
              <View style={styles.emptyLine} />
              <View style={styles.emptyLine} />
              {formData.signerFullName && <Text style={styles.addressLine}>{formData.signerFullName}</Text>}
              {formData.delegationText && <Text style={styles.addressLine}>{formData.delegationText}</Text>}
            </View>
          </View>
        )}

        {/* Business/Executive Letter Closing Block */}
        {isCivilianStyle && !isDLAType && (
            // wrap=false: the close and signature block never split
            // across a page break (M-5216.5 7-2.16 discipline applied
            // to the business closing; user-reported split 2026-06-10).
            <View wrap={false}>
                {/* Complimentary Close (Centered) */}
                <View style={{ marginBottom: PDF_SPACING.sectionGap * 3, marginLeft: PDF_INDENTS.signature }}>
                    <View style={styles.emptyLine} />
                    <Text style={styles.addressLine}>
                        {getComplimentaryClose(formData)}
                    </Text>
                </View>

                {/* Signature Block (Centered) - may be omitted for exec correspondence */}
                {!formData.omitSignatureBlock && (
                  <View style={{ marginBottom: PDF_SPACING.sectionGap, marginLeft: PDF_INDENTS.signature }}>
                       <View style={styles.emptyLine} />
                       <View style={styles.emptyLine} />
                       {formData.sig && <Text style={styles.addressLine}>{formData.sig}</Text>}
                       {isBusinessLetter && formData.signerRank && <Text style={styles.addressLine}>{formData.signerRank}</Text>}
                       {formData.signerTitle && <Text style={styles.addressLine}>{formData.signerTitle}</Text>}
                       {formData.delegationText && <Text style={styles.addressLine}>{formData.delegationText}</Text>}
                  </View>
                )}

                {/* Enclosures (Flush Left) */}
                {enclsWithContent.length > 0 && (
                    <View style={{ marginBottom: PDF_SPACING.sectionGap, marginLeft: 0 }}>
                        <Text style={styles.addressLine}>
                            {enclsWithContent.length > 1 ? 'Enclosures' : 'Enclosure'}
                        </Text>
                        {enclsWithContent.map((encl, i) => (
                            <Text key={i} style={styles.addressLine}>{encl}</Text>
                        ))}
                    </View>
                )}

                {/* Copy To / Courtesy Copy (Flush Left) */}
                {copiesWithContent.length > 0 && (
                    <View style={{ marginBottom: PDF_SPACING.sectionGap, marginLeft: 0 }}>
                        <Text style={styles.addressLine}>Copy to:</Text>
                        {copiesWithContent.map((copy, i) => (
                            <Text key={i} style={styles.addressLine}>{copy}</Text>
                        ))}
                    </View>
                )}

                {/* Congressional Courtesy Copy */}
                {isExecLetter && formData.courtesyCopyTo && (
                    <View style={{ marginBottom: PDF_SPACING.sectionGap, marginLeft: 0 }}>
                        <Text style={styles.addressLine}>{formData.courtesyCopyTo}</Text>
                        <Text style={styles.addressLine}>Ranking Minority Member</Text>
                    </View>
                )}
            </View>
        )}

        {/* MOA/MOU Signature Block */}
        {isMoaOrMou && (
          <View style={styles.signatureRow}>
            {/* Junior Signer (Left) */}
            <View style={styles.signatureColumn}>
              <View style={styles.emptyLine} />
              <View style={styles.emptyLine} />
              <View style={{ borderBottomWidth: 1, borderBottomColor: 'black', width: '80%', marginBottom: 4 }} />
              <Text style={styles.signatureLine}>{(moaData.juniorSigner?.name || '').toUpperCase()}</Text>
              <Text style={styles.signatureLine}>{moaData.juniorSigner?.title || ''}</Text>
              <Text style={styles.signatureLine}>{(moaData.juniorSigner?.activitySymbol || moaData.activityB || '').toUpperCase()}</Text>
            </View>

            {/* Senior Signer (Right) */}
            <View style={styles.signatureColumn}>
              <View style={styles.emptyLine} />
              <View style={styles.emptyLine} />
              <View style={{ borderBottomWidth: 1, borderBottomColor: 'black', width: '80%', marginBottom: 4 }} />
              <Text style={styles.signatureLine}>{(moaData.seniorSigner?.name || '').toUpperCase()}</Text>
              <Text style={styles.signatureLine}>{moaData.seniorSigner?.title || ''}</Text>
              <Text style={styles.signatureLine}>{(moaData.seniorSigner?.activitySymbol || moaData.activityA || '').toUpperCase()}</Text>
            </View>
          </View>
        )}

        {/* Distribution / Copy To for Directives */}
        {/* Distribution Statement rendered in footer on first page only */}
        {isDirective && (
            <View style={styles.copyToSection}>
                {formData.distribution && (formData.distribution.type === 'pcn' || formData.distribution.type === 'pcn-with-copy') && (
                    <View style={{ flexDirection: 'row', marginTop: PDF_SPACING.paragraph }}>
                        <Text style={styles.copyToLabel}>DISTRIBUTION: </Text>
                        <Text style={styles.copyToLine}>
                            PCN {formData.distribution.pcn || '___________'}
                        </Text>
                    </View>
                )}
                
                {formData.distribution?.copyTo && formData.distribution.copyTo.length > 0 && (
                    <View style={{ flexDirection: 'row', marginTop: PDF_SPACING.paragraph }}>
                        <Text style={styles.copyToLabel}>Copy to: </Text>
                        <Text style={styles.copyToLine}>
                            {formData.distribution.copyTo.map((c: { code: string; qty: number }) => c.code).join(', ')}
                        </Text>
                    </View>
                )}
            </View>
        )}



        {/* Distribution List for Multiple-Address Letter (when "To Distribution" toggle is on) */}
        {isToDistribution && (() => {
            const filtered = formData.distribution?.recipients?.filter((r: string) => r && r.trim()) || [];
            if (filtered.length === 0) return null;
            return (
              <View style={styles.copyToSection}>
                <View style={styles.emptyLine} />
                {filtered.length === 1 ? (
                  <Text style={styles.copyToLabel}>
                    {formData.bodyFont === 'courier' ? `Distribution:\u00A0\u00A0${filtered[0]}` : `Distribution:  ${filtered[0]}`}
                  </Text>
                ) : (
                  <>
                    <Text style={styles.copyToLabel}>
                      {formData.bodyFont === 'courier' ? 'Distribution:' : 'Distribution:'}
                    </Text>
                    {filtered.map((r: string, i: number) => (
                      <Text key={i} style={styles.copyToLine}>{r}</Text>
                    ))}
                  </>
                )}
              </View>
            );
        })()}

        {/* Manual Distribution List (Standard Letter, not when toDistribution already rendered) */}
        {!isDirective && !isToDistribution && distListWithContent.length > 0 && (
          <View style={styles.copyToSection}>
            {distListWithContent.length === 1 ? (
              <Text style={styles.copyToLabel}>
                {formData.bodyFont === 'courier' ? `Distribution:\u00A0\u00A0${distListWithContent[0]}` : `Distribution:  ${distListWithContent[0]}`}
              </Text>
            ) : (
              <>
                <Text style={styles.copyToLabel}>
                  {formData.bodyFont === 'courier' ? 'Distribution:' : 'Distribution:'}
                </Text>
                {distListWithContent.map((dist, i) => (
                  <Text key={i} style={styles.copyToLine}>
                    {dist}
                  </Text>
                ))}
              </>
            )}
          </View>
        )}

        {/* Copy to (Standard Letter) - Hide for Business/Exec Letter AND Staffing Papers (show for DLA) */}
        {!isDirective && (!isCivilianStyle || isDLAType) && !isStaffingPaper && copiesWithContent.length > 0 && (
          <View style={styles.copyToSection}>
            {/* Add full space if any distribution list was rendered above */}
            {(isToDistribution || (distListWithContent.length > 0)) && (
               <View style={styles.emptyLine} />
            )}
            <Text style={styles.copyToLabel}>
              {isDLAType ? 'cc:' : (formData.bodyFont === 'courier' ? 'Copy to:  ' : 'Copy to:')}
            </Text>
            {copiesWithContent.map((copy, i) => (
              <Text key={i} style={styles.copyToLine}>
                {copy}
              </Text>
            ))}
          </View>
        )}

        {/* Footer - page number on pages after first */}
        {/* DLA: page number at right margin per Ch.3-2 Para 13 */}
        <Text
          style={isDLAType ? { ...styles.footer, textAlign: 'right', right: PDF_MARGINS.right } : styles.footer}
          render={({ pageNumber }) => {
            const displayPage = pageNumber + startPage - 1;
            return displayPage > 1 ? displayPage : '';
          }}
          fixed
        />

        {/* Distribution Statement Footer — first page only for directives */}
        {distributionStatementText !== '' && (
          <Text
            style={{
              position: 'absolute',
              bottom: 22,
              left: PDF_MARGINS.left,
              right: PDF_MARGINS.left,
              textAlign: 'left',
              fontSize: PDF_FONT_SIZES.body,
              fontFamily: fontFamily,
            }}
            fixed
            render={({ pageNumber }) => pageNumber === 1 ? distributionStatementText : ''}
          />
        )}

        {/* FOUO Footer - Per MCO 5215.1K para 10 */}
        {/* "FOR OFFICIAL USE ONLY" centered at bottom of pages for FOUO-designated directives */}
        {isDirective && formData.fouoDesignation && formData.fouoDesignation !== '' && (
          <Text
            style={{
              position: 'absolute',
              bottom: 18,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontSize: PDF_FONT_SIZES.body,
              fontFamily: fontFamily,
            }}
            fixed
            render={({ pageNumber, totalPages }) => {
              // Full FOUO: show on letterhead (page 1) and last page
              if (formData.fouoDesignation === 'full') {
                if (pageNumber === 1 || pageNumber === totalPages) {
                  return 'FOR OFFICIAL USE ONLY';
                }
              }
              // Partial FOUO: show on all pages (user decides which pages have FOUO content)
              if (formData.fouoDesignation === 'partial') {
                return 'FOR OFFICIAL USE ONLY';
              }
              return '';
            }}
          />
        )}

        {/* DLA FOUO - Per DLA Correspondence Manual Ch.1 Para 15 */}
        {/* Stamps "FOR OFFICIAL USE ONLY" at top and bottom of each page */}
        {isDLAType && formData.fouoDesignation && formData.fouoDesignation !== '' && (
          <>
            <Text
              style={{
                position: 'absolute',
                top: 8,
                left: 0,
                right: 0,
                textAlign: 'center',
                fontSize: PDF_FONT_SIZES.body,
                fontFamily: fontFamily,
              }}
              fixed
              render={() => 'FOR OFFICIAL USE ONLY'}
            />
            <Text
              style={{
                position: 'absolute',
                bottom: 18,
                left: 0,
                right: 0,
                textAlign: 'center',
                fontSize: PDF_FONT_SIZES.body,
                fontFamily: fontFamily,
              }}
              fixed
              render={() => 'FOR OFFICIAL USE ONLY'}
            />
          </>
        )}

        {/* Staffing Paper Footer */}
        {isStaffingPaper && (
          isInformationPaper ? (
            <View style={styles.infoPaperFooterContainer}>
                 <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row' }}>
                        <Text style={styles.infoPaperFooterLeft}>Prepared by: </Text>
                        <View>
                            <Text style={styles.infoPaperFooterLeft}>
                                {formData.drafterName}, {formData.drafterRank}, {formData.drafterService || 'USMC'}
                            </Text>
                            <Text style={styles.infoPaperFooterLeft}>
                                {formData.drafterAgency ? `${formData.drafterAgency}, ` : ''}{formData.drafterOfficeCode}, {formData.drafterPhone}
                            </Text>
                        </View>
                    </View>
                    {(formData.approverName || formData.approverRank) && (
                        <View style={{ flexDirection: 'row' }}>
                            <Text style={styles.infoPaperFooterLeft}>Approved by: </Text>
                            <Text style={styles.infoPaperFooterLeft}>
                                {formData.approverRank} {formData.approverName}, {formData.approverOfficeCode}, {formData.approverPhone}
                            </Text>
                        </View>
                    )}
                 </View>
                 <Text style={styles.infoPaperFooterCenter}>
                    {formData.classification || 'UNCLASSIFIED'}
                 </Text>
            </View>
          ) : (isPositionPaper || isDecisionPaper) ? (
             <View style={styles.infoPaperFooterContainer}>
                 <View style={{ gap: 12 }}>
                    <View style={{ flexDirection: 'row' }}>
                        <Text style={styles.infoPaperFooterLeft}>Prepared by: </Text>
                        <Text style={styles.infoPaperFooterLeft}>
                            {formData.drafterRank} {formData.drafterName}, {formData.drafterOfficeCode}, {formData.drafterPhone}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row' }}>
                        <Text style={styles.infoPaperFooterLeft}>Approved by: </Text>
                        <Text style={styles.infoPaperFooterLeft}>
                            {formData.approverRank || 'Rank'} {formData.approverName || 'Name'}, {formData.approverOfficeCode || 'Code'}, {formData.approverPhone || 'Phone'}
                        </Text>
                    </View>
                 </View>
                 <Text style={styles.infoPaperFooterCenter}>
                    {formData.classification || 'UNCLASSIFIED'}
                 </Text>
            </View>
          ) : (
          <View style={styles.staffingPaperFooter}>
               <Text style={styles.staffingPaperFooterLine}>{formData.drafterName || ''} {formData.drafterRank || ''}</Text>
               <Text style={styles.staffingPaperFooterLine}>{formData.drafterOfficeCode || ''} {formData.drafterPhone ? `/ ${formData.drafterPhone}` : ''}</Text>
               <Text style={styles.staffingPaperFooterLine}>{formattedDate}</Text>
          </View>
          )
        )}
      </Page>

      {/* Reports Required page — for directives with 5+ reports (MCO 5216.20B par. 29c) */}
      {isDirective && formData.reports && formData.reports.filter((r: { title: string }) => r.title).length >= 5 && (
        <Page size="LETTER" style={styles.page}>
          <View style={{ alignItems: 'center', marginBottom: PDF_SPACING.sectionGap * 2 }}>
            <Text style={{ fontFamily: styles.page.fontFamily, fontSize: PDF_FONT_SIZES.body }}>
              Reports Required
            </Text>
          </View>

          {/* Column headers */}
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            <Text style={{ fontFamily: styles.page.fontFamily, fontSize: PDF_FONT_SIZES.body, width: fontFamily === 'Liberation Mono' ? 42 : 36, flexShrink: 0 }}>{''}</Text>
            <Text style={{ fontFamily: styles.page.fontFamily, fontSize: PDF_FONT_SIZES.body, width: '50%' }}>
              REPORT TITLE
            </Text>
            <Text style={{ fontFamily: styles.page.fontFamily, fontSize: PDF_FONT_SIZES.body, width: '28%' }}>
              REPORT{'\n'}CONTROL SYMBOL
            </Text>
            <Text style={{ fontFamily: styles.page.fontFamily, fontSize: PDF_FONT_SIZES.body, width: '22%' }}>
              PARAGRAPH
            </Text>
          </View>

          {/* Report rows */}
          {formData.reports.filter((r: { title: string }) => r.title).map((report: { id: string; title: string; controlSymbol: string; paragraphRef: string; exempt?: boolean }, idx: number) => (
            <View key={report.id || idx} style={{ flexDirection: 'row', marginBottom: 4 }}>
              <Text style={{ fontFamily: styles.page.fontFamily, fontSize: PDF_FONT_SIZES.body, width: fontFamily === 'Liberation Mono' ? 42 : 36, textAlign: 'right', paddingRight: 6, flexShrink: 0 }}>
                {`${toRoman(idx + 1).toUpperCase()}.`}
              </Text>
              <Text style={{ fontFamily: styles.page.fontFamily, fontSize: PDF_FONT_SIZES.body, width: '50%' }}>
                {report.title}
              </Text>
              <Text style={{ fontFamily: styles.page.fontFamily, fontSize: PDF_FONT_SIZES.body, width: '28%' }}>
                {report.exempt ? 'EXEMPT' : (report.controlSymbol || '')}
              </Text>
              <Text style={{ fontFamily: styles.page.fontFamily, fontSize: PDF_FONT_SIZES.body, width: '22%' }}>
                {report.paragraphRef || ''}
              </Text>
            </View>
          ))}

          {/* Footer - page number */}
          <Text
            style={styles.footer}
            render={({ pageNumber }) => {
              const displayPage = pageNumber + startPage - 1;
              return displayPage > 1 ? displayPage : '';
            }}
            fixed
          />

          {/* Distribution Statement Footer */}
        </Page>
      )}

      {/* Locator Sheet — per MCO 5215.1K para 48 */}
      {isDirective && formData.showLocatorSheet && (
        <Page size="LETTER" style={styles.page}>
          {/* Top-right: Directive designation and date */}
          <View style={{ alignItems: 'flex-end', marginBottom: PDF_SPACING.emptyLine }}>
            <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body }}>
              {(formData.directiveTitle || buildDirectiveTitle(formData)).toUpperCase()}
            </Text>
            <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body }}>
              {formattedDate}
            </Text>
          </View>
          {/* Centered title - 1 hard space after date */}
          <View style={{ alignItems: 'center', marginBottom: PDF_SPACING.emptyLine * 2 }}>
            <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, textAlign: 'center' }}>
              LOCATOR SHEET
            </Text>
          </View>
          {/* Left-aligned Subj line - 2 hard spaces after title */}
          <View style={{ marginBottom: PDF_SPACING.emptyLine }}>
            <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body }}>
              Subj:  {(formData.subj || '').toUpperCase()}
            </Text>
          </View>
          {/* Left-aligned Location line */}
          <View style={{ marginBottom: 4 }}>
            <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body }}>
              Location:  _______________________________________________
            </Text>
          </View>
          <View>
            <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body }}>
              (Indicate the location(s) of the copy(ies) of this Order.)
            </Text>
          </View>
          <Text style={[styles.footer, { fontFamily: fontFamily }]}>{locatorSheetPageNum}</Text>
        </Page>
      )}

      {/* Record of Changes — per MCO 5215.1K para 48 */}
      {isDirective && formData.showRecordOfChanges && (
        <Page size="LETTER" style={styles.page}>
          <Text style={{ fontFamily: fontFamily, fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 }}>
            RECORD OF CHANGES
          </Text>
          {/* Boxed table */}
          <View style={{ borderWidth: 1, borderColor: '#000' }}>
            {/* Table Header */}
            <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000' }}>
              <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, fontWeight: 'bold', width: '15%', textAlign: 'center', padding: 4, borderRightWidth: 1, borderRightColor: '#000' }}>Change{'\n'}Number</Text>
              <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, fontWeight: 'bold', width: '20%', textAlign: 'center', padding: 4, borderRightWidth: 1, borderRightColor: '#000' }}>Date of{'\n'}Change</Text>
              <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, fontWeight: 'bold', width: '20%', textAlign: 'center', padding: 4, borderRightWidth: 1, borderRightColor: '#000' }}>Date{'\n'}Entered</Text>
              <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, fontWeight: 'bold', width: '45%', textAlign: 'center', padding: 4 }}>Signature of Person{'\n'}Incorporating Change</Text>
            </View>
            {/* Existing changes */}
            {(formData.recordOfChanges || []).map((change: { changeNo: number; date: string; pagesAffected: string; enteredBy: string }, i: number) => (
              <View key={i} style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', minHeight: 20 }}>
                <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, width: '15%', textAlign: 'center', padding: 4, borderRightWidth: 1, borderRightColor: '#000' }}>{change.changeNo}</Text>
                <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, width: '20%', textAlign: 'center', padding: 4, borderRightWidth: 1, borderRightColor: '#000' }}>{change.date}</Text>
                <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, width: '20%', textAlign: 'center', padding: 4, borderRightWidth: 1, borderRightColor: '#000' }}>{change.pagesAffected}</Text>
                <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, width: '45%', padding: 4 }}>{change.enteredBy}</Text>
              </View>
            ))}
            {/* Empty rows for future changes */}
            {Array.from({ length: Math.max(0, 20 - (formData.recordOfChanges?.length || 0)) }).map((_, i, arr) => (
              <View key={`empty-${i}`} style={{ flexDirection: 'row', minHeight: 20, ...(i < arr.length - 1 ? { borderBottomWidth: 1, borderBottomColor: '#000' } : {}) }}>
                <View style={{ width: '15%', borderRightWidth: 1, borderRightColor: '#000', minHeight: 20 }} />
                <View style={{ width: '20%', borderRightWidth: 1, borderRightColor: '#000', minHeight: 20 }} />
                <View style={{ width: '20%', borderRightWidth: 1, borderRightColor: '#000', minHeight: 20 }} />
                <View style={{ width: '45%', minHeight: 20 }} />
              </View>
            ))}
          </View>
          <Text style={[styles.footer, { fontFamily: fontFamily }]}>{recordOfChangesPageNum}</Text>
        </Page>
      )}

      {/* Table of Contents — per MCO 5215.1K para 48 */}
      {isDirective && formData.showStructuralPages && (
        <Page size="LETTER" style={styles.page}>
          <Text style={{ fontFamily: fontFamily, fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 24 }}>
            TABLE OF CONTENTS
          </Text>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, fontWeight: 'bold', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 4 }}>
              PARAGRAPH{'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}TITLE
            </Text>
            {tocEntries.map((entry, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
                <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, width: 60 }}>
                  {entry.number}.
                </Text>
                <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, flex: 1 }}>
                  {entry.title}
                </Text>
              </View>
            ))}
          </View>
          {/* Enclosures in TOC */}
          {enclsWithContent.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, fontWeight: 'bold', marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#000', paddingBottom: 4 }}>
                ENCLOSURE{'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'}TITLE
              </Text>
              {enclsWithContent.map((encl, i) => (
                <View key={i} style={{ flexDirection: 'row', marginBottom: 4 }}>
                  <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, width: 60 }}>
                    ({i + 1})
                  </Text>
                  <Text style={{ fontFamily: fontFamily, fontSize: PDF_FONT_SIZES.body, flex: 1 }}>
                    {encl}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <Text style={[styles.footer, { fontFamily: fontFamily }]}>{tocPageNum}</Text>
        </Page>
      )}
    </Document>
  );
}

export default NavalLetterPDF;
