import { Paragraph, TextRun, AlignmentType, TabStopType } from "docx";
// Constants for SECNAV M-5216.5 compliance
export const DOC_SETTINGS = {
  font: "Times New Roman",
  fontSize: 24, // 12pt
  pageMargins: {
    top: 720,       // 0.5" top (per reference app)
    bottom: 1440,   // 1" bottom
    left: 1440,     // 1" left
    right: 1440,    // 1" right
  },
  // spacing.after removed (Phase 1 S2). The 6pt value was dead code -
  // no call site consumed it - and conflicted with SECNAV M-5216.5
  // 7-2.13: separation between paragraphs is one full blank line at
  // body size, emitted as an explicit empty paragraph (createEmptyLine).
  pageSize: {
      width: 12240,  // 8.5 inches in twips
      height: 15840, // 11 inches in twips
  }
};
// Tab stop positions in TWIPs
export const TAB_STOPS = {
  first: 720,   // 0.5"
  second: 1046, // 0.726"
};
// Indentation values
export const INDENTS = {
  subject: 720,         // 0.5"
  hanging: 360,         // 0.25"
  date: 7920,           // 5.5"
  signature: 4680       // 3.25"
};
