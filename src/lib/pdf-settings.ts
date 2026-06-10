/**
 * PDF Settings for Naval Letter Generation
 * 
 * UPDATED:
 * - Header moved down (half spacing from top)
 * - SSIC block pushed right by ~1 inch
 * - Body text wraps to left margin (not indented)
 */

// Page dimensions
export const PDF_PAGE = {
  width: 612,        // 8.5 inches
  height: 792,       // 11 inches
  orientation: 'portrait' as const,
};

// Page margins
export const PDF_MARGINS = {
  // USER RULING 2026-06-10: 44pt top so the PDF letterhead matches the
  // Word rendering (whose first-page header anchor pushes the body to
  // ~0.67in). Spec value is 36pt = 0.5in, first letterhead line on the
  // 4th line from the page top (M-5216.5 2-2.12b). Deferred: see
  // docs/PHASE1_GOLDEN_DIFFS.md S3.3. Continuation-page geometry is
  // unaffected (constants derive absolute 60/84pt positions).
  top: 44,
  bottom: 72,        // 1"
  left: 72,          // 1"
  right: 72,         // 1"
};

// Font sizes in points
export const PDF_FONT_SIZES = {
  title: 10,         // Header title
  unitLines: 8,      // Unit address lines
  body: 12,          // Body text
};

// Colors
export const PDF_COLORS = {
  usmc: '#000000',
  don: '#002D72',
};

// DoD Seal
export const PDF_SEAL = {
  width: 72,
  height: 72,
  offsetX: 36,
  offsetY: 36,
};

// Indentation positions in points
export const PDF_INDENTS = {
  tabStop1: 36,      // 0.5" for From/To/Subj labels
  tabStop2: 52.3,
  
  // SSIC block - PUSHED RIGHT by ~1 inch
  // Was 396pt (5.5"), reduced to 324pt (4.5") to prevent date wrapping
  ssicBlock: 324,
  
  signature: 234,
  refHangingTimes: 54,
  refHangingCourier: 79.2,
  levelSpacing: 18,
  copyTo: 36,
};

// Paragraph tab stops
export const PDF_PARAGRAPH_TABS = {
  1: { citation: 0, text: 18 },
  2: { citation: 18, text: 36 },
  3: { citation: 36, text: 54 },
  4: { citation: 54, text: 72 },
  5: { citation: 72, text: 90 },
  6: { citation: 90, text: 108 },
  7: { citation: 108, text: 126 },
  8: { citation: 126, text: 144 },
} as const;

// Subject line
export const PDF_SUBJECT = {
  maxLineLength: 57,
  continuationIndent: 36,
};

// Line spacing
// One blank line = the natural Times New Roman line at 12pt:
// (ascent 1825 - descent -443 + lineGap 87) / 2048 em * 12pt = 13.80pt.
// Word uses the same font metrics, so DOCX blank lines and PDF gaps
// now have identical height (pagination parity; audit G2/G8).
export const LINE_HEIGHT_12PT = 13.8;
export const PDF_SPACING = {
  paragraph: LINE_HEIGHT_12PT,  // Space between body paragraphs (one blank line)
  emptyLine: LINE_HEIGHT_12PT,  // Height of one blank line
  sectionGap: LINE_HEIGHT_12PT, // Space between heading sections
};

// Content width
export const PDF_CONTENT_WIDTH = PDF_PAGE.width - PDF_MARGINS.left - PDF_MARGINS.right;
