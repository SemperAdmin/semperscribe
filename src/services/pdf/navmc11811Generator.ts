import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { Navmc11811Data, BoxBoundary } from '@/types/navmc';
import { loadAssetBytes } from '@/lib/assets';
import { PAGE11_FLOW, columnLines, flowPage11, type Page11Column } from '@/lib/page11-flow';

// --- Configuration & Constants ---

const FONT_SIZE = 11;
const LINE_HEIGHT = 14;
const PARAGRAPH_SPACING = 14;

// Box Definitions from boxes.json
// Origin is bottom-left.
export const PAGE11_BOXES: Record<string, BoxBoundary> = {
  name: { left: 35, top: 141, width: 395, height: 19 },
  edipi: { left: 434, top: 141, width: 142, height: 19 },
  
  // Two columns for remarks
  remarksLeft: { left: 35, top: 558, width: 261, height: 400 },
  remarksRight: { left: 315, top: 558, width: 261, height: 400 }
};

// --- Helper Functions ---

async function loadTemplates() {
  const page1Bytes = await loadAssetBytes('templates/navmc11811/page1.pdf');
  return { page1Bytes };
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  // If empty string, return empty line
  if (!text) return [''];

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = font.widthOfTextAtSize(`${currentLine} ${word}`, fontSize);
    if (width < maxWidth) {
      currentLine += ` ${word}`;
    } else {
      // If a single word is wider than maxWidth, it will still overflow with this logic.
      // But for normal text, it pushes to next line.
      lines.push(currentLine);
      currentLine = word;
    }
  }
  
  // Final check: if the last line (or single word) is too long, we might need to force split it?
  // For now, let's just push it. The issue was mainly "aaaaa..." (one word)
  // If we have one huge word, we should split it by characters.
  
  if (font.widthOfTextAtSize(currentLine, fontSize) > maxWidth) {
     // Force break long word
     // This is a naive implementation but handles the "aaaa..." case
     let tempLine = "";
     for (const char of currentLine) {
       if (font.widthOfTextAtSize(tempLine + char, fontSize) < maxWidth) {
         tempLine += char;
       } else {
         lines.push(tempLine);
         tempLine = char;
       }
     }
     lines.push(tempLine);
  } else {
     lines.push(currentLine);
  }
  
  return lines;
}

function drawTextInBox(
  page: PDFPage,
  text: string,
  box: BoxBoundary,
  font: PDFFont,
  alignment: 'left' | 'center' = 'left'
) {
  const textWidth = font.widthOfTextAtSize(text, FONT_SIZE);
  let x = box.left;
  
  if (alignment === 'center') {
    x = box.left + (box.width - textWidth) / 2;
  }
  
  // Center vertically in the box roughly
  const y = box.top - (box.height / 2) - (FONT_SIZE / 3);

  page.drawText(text, {
    x,
    y,
    size: FONT_SIZE,
    font,
    color: rgb(0, 0, 0),
  });
}

// Function to handle multi-column text flow
function drawRemarks(
  page: PDFPage,
  text: string,
  leftBox: BoxBoundary,
  rightBox: BoxBoundary,
  font: PDFFont
) {
  // Split text into paragraphs
  const paragraphs = text.split('\n');
  let currentY = leftBox.top - FONT_SIZE;
  let currentColumn = 'left';
  
  for (const paragraph of paragraphs) {
    // Wrap paragraph
    const maxWidth = currentColumn === 'left' ? leftBox.width : rightBox.width;
    const lines = wrapText(paragraph, font, FONT_SIZE, maxWidth);
    
    for (const line of lines) {
      // Check for overflow
      const bottomLimit = currentColumn === 'left' 
        ? (leftBox.top - leftBox.height) 
        : (rightBox.top - rightBox.height);
        
      if (currentY < bottomLimit) {
        if (currentColumn === 'left') {
          // Switch to right column
          currentColumn = 'right';
          currentY = rightBox.top - FONT_SIZE;
        } else {
          // Overflow right column - stop or warn? 
          // For now, just stop drawing to avoid writing off page
          console.warn("Text overflowed both columns in NAVMC 118(11)");
          return;
        }
      }
      
      const x = currentColumn === 'left' ? leftBox.left : rightBox.left;
      page.drawText(line, {
        x,
        y: currentY,
        size: FONT_SIZE,
        font,
        color: rgb(0, 0, 0),
      });
      
      currentY -= LINE_HEIGHT;
    }
    // Add extra space between paragraphs
    currentY -= PARAGRAPH_SPACING;
  }
}

// --- Main Generator ---

export async function generateNavmc11811(data: Navmc11811Data): Promise<Uint8Array> {
  const templates = await loadTemplates();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const [coverPage] = await doc.embedPdf(templates.page1Bytes);

  const newPage = () => {
    const page = doc.addPage([coverPage.width, coverPage.height]);
    page.drawPage(coverPage);
    // Every page of a Page 11, continuation pages included, carries the
    // Marine's name and DoD ID.
    drawTextInBox(page, data.name.toUpperCase(), PAGE11_BOXES.name, font, 'left');
    drawTextInBox(page, data.edipi, PAGE11_BOXES.edipi, font, 'center');
    return page;
  };

  if (data.remarksLeft || data.remarksRight) {
    // The entry flows left column, right column, next page (src/lib/
    // page11-flow.ts). Times-Roman 9 pt on a 10 pt line matches the
    // official form's Remarks fields, so the preview breaks where the
    // filled form breaks.
    const flow = flowPage11(data.remarksLeft ?? '', data.remarksRight ?? '');
    for (const flowPage of flow.pages) {
      const page = newPage();
      drawFlowColumn(page, flowPage.left, PAGE11_BOXES.remarksLeft, font);
      drawFlowColumn(page, flowPage.right, PAGE11_BOXES.remarksRight, font);
    }
  } else {
    const page = newPage();
    if (data.remarks) {
      // Fallback to auto-flow if old data structure used
      drawRemarks(page, data.remarks, PAGE11_BOXES.remarksLeft, PAGE11_BOXES.remarksRight, font);
    }
  }

  return doc.save();
}

/** One flowed column: pre-wrapped lines, top-aligned, 10 pt apart. */
function drawFlowColumn(page: PDFPage, column: Page11Column, box: BoxBoundary, font: PDFFont) {
  let y = box.top - PAGE11_FLOW.fontSize;
  for (const line of columnLines(column)) {
    if (line) page.drawText(line, { x: box.left, y, size: PAGE11_FLOW.fontSize, font, color: rgb(0, 0, 0) });
    y -= PAGE11_FLOW.lineHeight;
  }
}


