import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { Navmc10274Data, BoxBoundary } from '@/types/navmc';
import { ParagraphData } from '@/types';
import { generateCitation } from '@/lib/citation';
import { getBasePath } from '@/lib/path-utils';

// --- Configuration & Constants ---

// Font size in points
const FONT_SIZE = 10;
const LINE_HEIGHT = 12;
const PADDING = 2;

// Indentation in points (derived from standard naval 0.25", 0.5", etc.)
const NAVAL_INDENTS_POINTS: Record<number, { citation: number, text: number }> = {
  1: { citation: 0, text: 18 },    // 0" and 0.25"
  2: { citation: 18, text: 36 },   // 0.25" and 0.5"
  3: { citation: 36, text: 54 },   // 0.5" and 0.75"
  4: { citation: 54, text: 72 },   // 0.75" and 1.0"
  5: { citation: 72, text: 90 },
  6: { citation: 90, text: 108 },
  7: { citation: 108, text: 126 },
  8: { citation: 126, text: 144 },
};

// Approximate Coordinates (in Points, Bottom-Left origin)
// Note: These need to be verified against the actual PDF template.
// Assuming standard Letter size (612 x 792 points).
// Origin (0,0) is bottom-left.

// Example from prompt:
// actionNo: { left: 406, top: 728, width: 79, height: 18 }
// from: { left: 29, top: 674, width: 276, height: 25 }

export const PAGE2_BOXES: Record<string, BoxBoundary> = {
  actionNo: { left: 406, top: 728, width: 79, height: 18 },
  ssic: { left: 487, top: 728, width: 97, height: 18 },
  date: { left: 406, top: 701, width: 178, height: 16 },
  
  from: { left: 29, top: 674, width: 276, height: 25 },
  orgStation: { left: 309, top: 674, width: 274, height: 61 },
  via: { left: 29, top: 638, width: 276, height: 25 },
  to: { left: 65, top: 601, width: 265, height: 77 },
  
  subject: { left: 353, top: 602, width: 230, height: 42 }, // natureOfAction
  copyTo: { left: 353, top: 547, width: 230, height: 32 },
  
  reference: { left: 30, top: 500, width: 275, height: 75 },
  enclosure: { left: 309, top: 500, width: 274, height: 75 },
  
  // The main body box
  supplementalInfo: { left: 30, top: 410, width: 553, height: 355 },
};

const PAGE3_CONTENT_BOX: BoxBoundary = {
  left: 31,
  top: 725,
  width: 550,
  height: 686,
};

// --- Helper Functions ---

/**
 * Loads the PDF templates from the public folder.
 */
async function loadTemplates() {
  const basePath = getBasePath();
  const [page1Bytes, page2Bytes, page3Bytes] = await Promise.all([
    fetch(`${basePath}/templates/navmc10274/page1.pdf`).then((res) => res.arrayBuffer()),
    fetch(`${basePath}/templates/navmc10274/page2.pdf`).then((res) => res.arrayBuffer()),
    fetch(`${basePath}/templates/navmc10274/page3.pdf`).then((res) => res.arrayBuffer()),
  ]);
  return { page1Bytes, page2Bytes, page3Bytes };
}

/**
 * Wraps text into lines that fit within a given width.
 */
function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = font.widthOfTextAtSize(`${currentLine} ${word}`, fontSize);
    if (width < maxWidth) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Formats a date string to YYYY-MM-DD for AA Forms
 */
function formatDateForAA(dateStr: string): string {
  if (!dateStr) return '';
  
  // Handle "today"
  if (dateStr.toLowerCase() === 'today') {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // If already YYYY-MM-DD, return as is
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // Handle standard formats
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  return dateStr;
}

/**
 * Handles complex text drawing:
 * 1. Wrapping
 * 2. Placeholder highlighting ({{VAR}})
 * 3. Positioning
 * 4. Alignment (Left or Center)
 */
function drawTextInBox(
  page: PDFPage,
  text: string,
  box: BoxBoundary,
  font: PDFFont,
  alignment: 'left' | 'center' = 'left'
) {
  if (!text) return;

  const maxWidth = box.width - (PADDING * 2);
  // Handle newlines explicitly first
  const paragraphs = text.split('\n');
  let allLines: string[] = [];
  
  paragraphs.forEach(para => {
    const lines = wrapText(para, font, FONT_SIZE, maxWidth);
    allLines = allLines.concat(lines);
  });

  // Calculate starting Y (Top of box - padding - approximate ascender)
  let currentY = box.top - PADDING - FONT_SIZE + 2; 

  allLines.forEach((line) => {
    if (currentY < box.top - box.height) return; // Basic clipping

    let startX = box.left + PADDING;
    
    if (alignment === 'center') {
      // Calculate line width to center it
      const lineWidth = font.widthOfTextAtSize(line.replace(/{{|}}/g, '').trim(), FONT_SIZE);
      startX = box.left + (box.width / 2) - (lineWidth / 2);
    }

    drawLineWithHighlights(page, line, startX, currentY, font);
    currentY -= LINE_HEIGHT;
  });
}

/**
 * Draws a single line of text, checking for {{PLACEHOLDERS}} to highlight.
 */
function drawLineWithHighlights(
  page: PDFPage,
  line: string,
  x: number,
  y: number,
  font: PDFFont
) {
  const regex = /({{[^}]+}})/g;
  const parts = line.split(regex);
  
  let currentX = x;

  parts.forEach((part) => {
    if (!part) return;

    const width = font.widthOfTextAtSize(part, FONT_SIZE);
    const isPlaceholder = part.startsWith('{{') && part.endsWith('}}');

    if (isPlaceholder) {
      // Draw yellow highlight
      page.drawRectangle({
        x: currentX,
        y: y - 2, // Adjust for baseline
        width: width,
        height: FONT_SIZE + 2,
        color: rgb(1, 1, 0), // Yellow
      });
    }

    // Draw text
    page.drawText(part, {
      x: currentX,
      y: y,
      size: FONT_SIZE,
      font: font,
      color: rgb(0, 0, 0),
    });

    currentX += width;
  });
}

/**
 * Handles the "Supplemental Information" field which might spill over to Page 3.
 */
async function drawSupplementalInfo(
  doc: PDFDocument,
  page2: PDFPage,
  page3Bytes: ArrayBuffer,
  supplementalInfo: string,
  font: PDFFont,
  paragraphs?: ParagraphData[],
  signature?: string
) {
  const box = PAGE2_BOXES.supplementalInfo;
  const maxWidth = box.width - (PADDING * 2);
  
  interface RowSegment { text: string; x: number; isSignature?: boolean; }
  type Row = RowSegment[];
  
  let allRows: Row[] = [];

  if (paragraphs && paragraphs.length > 0) {
    // Structured Paragraph Rendering
    paragraphs.forEach((p, i) => {
      const { citation } = generateCitation(p, i, paragraphs);
      const level = p.level || 1;
      const indents = NAVAL_INDENTS_POINTS[level] || NAVAL_INDENTS_POINTS[8] || NAVAL_INDENTS_POINTS[1];

      const citationX = box.left + PADDING + indents.citation;
      const textX = box.left + PADDING + indents.text;
      const boxRight = box.left + box.width - PADDING;

      // First line shares space with citation so wraps at reduced width
      const firstLineWidth = boxRight - textX;
      // Continuation lines run full width back to the citation column
      const continuationWidth = boxRight - citationX;

      const firstLineWrapped = wrapText(p.content, font, FONT_SIZE, firstLineWidth);
      const firstLine = firstLineWrapped[0] || '';
      const remainingText = p.content.slice(firstLine.length).trimStart();
      const continuationLines = remainingText
        ? wrapText(remainingText, font, FONT_SIZE, continuationWidth)
        : [];

      if (!firstLine && continuationLines.length === 0) {
        allRows.push([{ text: citation, x: citationX }]);
      } else {
        allRows.push([
          { text: citation, x: citationX },
          { text: firstLine, x: textX }
        ]);
        for (const contLine of continuationLines) {
          allRows.push([{ text: contLine, x: citationX }]);
        }
      }

      if (i < paragraphs.length - 1) {
        allRows.push([]);
      }
    });
  } else {
    // Legacy String Rendering (Fallback)
    const paragraphsRaw = supplementalInfo.split('\n');
    paragraphsRaw.forEach(para => {
      const lines = wrapText(para, font, FONT_SIZE, maxWidth);
      lines.forEach(line => {
        allRows.push([{ text: line, x: box.left + PADDING }]);
      });
    });
  }

  // Add Signature Block
  if (signature) {
    // Add 3 blank lines (rows) below the last text
    allRows.push([]);
    allRows.push([]);
    allRows.push([]);
    
    // Calculate center X for signature
    // Requirement: "the first letter should start at the center"
    // This means the text starts at the horizontal center of the box.
    const centerX = box.left + (box.width / 2);
    
    allRows.push([{ text: signature, x: centerX, isSignature: true }]);
  }

  // Calculate how many rows fit on Page 2
  const maxLinesPage2 = Math.floor((box.height - (PADDING * 2)) / LINE_HEIGHT);
  
  const page2Rows = allRows.slice(0, maxLinesPage2);
  const overflowRows = allRows.slice(maxLinesPage2);

  // Draw Page 2 content
  let currentY = box.top - PADDING - FONT_SIZE + 2;
  
  for (const row of page2Rows) {
    for (const segment of row) {
      drawLineWithHighlights(page2, segment.text, segment.x, currentY, font);
      // Signature field is now handled via manual placement modal in the UI
    }
    currentY -= LINE_HEIGHT;
  }

  // If overflow, create Page 3(s)
  if (overflowRows.length > 0) {
    let currentPage3 = await appendPage3(doc, page3Bytes);
    // Note: page3TopY is essentially the starting Y position for text on Page 3
    const page3TopY = PAGE3_CONTENT_BOX.top - PADDING - FONT_SIZE + 2; 
    const page3BottomY = PAGE3_CONTENT_BOX.top - PAGE3_CONTENT_BOX.height + PADDING;
    
    let page3Y = page3TopY;

    for (const row of overflowRows) {
      if (page3Y < page3BottomY) {
        // New Page 3 needed
        currentPage3 = await appendPage3(doc, page3Bytes);
        page3Y = page3TopY;
      }
      
      for (const segment of row) {
        // For Page 3, we need to adjust X coordinates relative to Page 3 margins if they differ from Page 2
        // But typically we can just map the relative offsets.
        // The original logic used PAGE3_CONTENT_BOX.left.
        // The segments have X absolute to Page 2 Box.
        // We need to shift them to be relative to Page 3 Box.
        
        const relativeX = segment.x - box.left;
        const page3X = PAGE3_CONTENT_BOX.left + relativeX;
        
        drawLineWithHighlights(currentPage3, segment.text, page3X, page3Y, font);
        // Signature field is now handled via manual placement modal in the UI
      }
      
      page3Y -= LINE_HEIGHT;
    }
  }
}

/**
 * Handles formatting for the "Via" block, supporting multi-column layout for >2 items.
 */
function drawVia(
  page: PDFPage,
  viaText: string,
  box: BoxBoundary,
  font: PDFFont
) {
  if (!viaText) return;

  const items = viaText.split('\n').filter(s => s.trim().length > 0);
  if (items.length === 0) return;

  const startY = box.top - PADDING - FONT_SIZE + 2;

  // Case 1: Single Item (No Numbering)
  if (items.length === 1) {
    drawLineWithHighlights(page, items[0], box.left + PADDING, startY, font);
    return;
  }

  // Case 2: Two Items (Vertical Stack, Numbered)
  if (items.length === 2) {
    items.forEach((item, index) => {
      const text = `(${index + 1}) ${item}`;
      const y = startY - (index * LINE_HEIGHT);
      drawLineWithHighlights(page, text, box.left + PADDING, y, font);
    });
    return;
  }

  // Case 3: More than 2 Items (2-Column Layout, Numbered)
  // Split into columns (Column-Major Order)
  const midPoint = Math.ceil(items.length / 2);
  const col1Items = items.slice(0, midPoint);
  const col2Items = items.slice(midPoint);

  // Calculate Column 2 X-Offset dynamically
  let maxCol1Width = 0;
  col1Items.forEach((item, index) => {
    const text = `(${index + 1}) ${item}`;
    const width = font.widthOfTextAtSize(text, FONT_SIZE);
    if (width > maxCol1Width) {
      maxCol1Width = width;
    }
  });

  const twoSpacesWidth = font.widthOfTextAtSize('  ', FONT_SIZE);
  const col2X = box.left + PADDING + maxCol1Width + twoSpacesWidth;

  // Column 1
  col1Items.forEach((item, index) => {
    const text = `(${index + 1}) ${item}`;
    const y = startY - (index * LINE_HEIGHT);
    // Clip if exceeds box height
    if (y < box.top - box.height) return;
    drawLineWithHighlights(page, text, box.left + PADDING, y, font);
  });

  // Column 2
  col2Items.forEach((item, index) => {
    const text = `(${index + 1 + midPoint}) ${item}`;
    const y = startY - (index * LINE_HEIGHT);
    // Clip if exceeds box height
    if (y < box.top - box.height) return;
    drawLineWithHighlights(page, text, col2X, y, font);
  });
}

async function appendPage3(doc: PDFDocument, page3Bytes: ArrayBuffer) {
  const [embeddedPage3] = await doc.embedPdf(page3Bytes, [0]); // Embed first page of template
  const page = doc.addPage([embeddedPage3.width, embeddedPage3.height]);
  page.drawPage(embeddedPage3);
  return page;
}


// --- Main Generator Function ---

export async function generateNavmc10274(data: Navmc10274Data): Promise<Uint8Array> {
  // 1. Load Templates
  const templates = await loadTemplates();
  
  // 2. Create Document
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);

  // 3. Add Page 1 (Cover Sheet) - usually just static or minimal info
  const [coverPage] = await doc.embedPdf(templates.page1Bytes);
  const page1 = doc.addPage([coverPage.width, coverPage.height]);
  page1.drawPage(coverPage);
  // Fill any Page 1 fields if needed (omitted for now as per prompt focus on Page 2/3)

  // 4. Add Page 2 (Main Form)
  const [mainForm] = await doc.embedPdf(templates.page2Bytes);
  const page2 = doc.addPage([mainForm.width, mainForm.height]);
  page2.drawPage(mainForm);

  // 5. Fill Page 2 Fields (except Supplemental Info)
  const simpleFields = [
    'actionNo', 'ssic', 'date', 'from', 'orgStation', 'to', 
    'subject', 'reference', 'enclosure', 'copyTo'
  ];

  simpleFields.forEach(fieldKey => {
    let value = data[fieldKey as keyof Navmc10274Data];
    const box = PAGE2_BOXES[fieldKey];
    
    // Apply specific formatting
    if (fieldKey === 'date' && typeof value === 'string') {
      value = formatDateForAA(value);
    }

    if (value && box) {
       // Only string types for now
       if (typeof value === 'string') {
          const alignment = fieldKey === 'date' ? 'center' : 'left';
          drawTextInBox(page2, value, box, font, alignment);
       }
    }
  });

  // Handle Via specifically for multi-column layout
  if (data.via) {
    drawVia(page2, data.via, PAGE2_BOXES.via, font);
  }

  // 6. Handle Supplemental Info (Overflows to Page 3)
  if (data.supplementalInfo) {
    await drawSupplementalInfo(
      doc, 
      page2, 
      templates.page3Bytes, 
      data.supplementalInfo, 
      font, 
      data.supplementalInfoParagraphs,
      data.signature
    );
  }

  // 7. Save
  return doc.save();
}
