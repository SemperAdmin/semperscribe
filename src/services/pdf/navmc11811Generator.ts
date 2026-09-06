import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';
import { Navmc11811Data, BoxBoundary } from '@/types/navmc';
import { loadAssetBytes } from '@/lib/assets';

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
  const monoFont = await doc.embedFont(StandardFonts.Courier);
  
  const [coverPage] = await doc.embedPdf(templates.page1Bytes);
  const page = doc.addPage([coverPage.width, coverPage.height]);
  page.drawPage(coverPage);
  
  // Draw fields
  drawTextInBox(page, data.name.toUpperCase(), PAGE11_BOXES.name, font, 'left');
  drawTextInBox(page, data.edipi, PAGE11_BOXES.edipi, font, 'center');
  
  if (data.remarksLeft || data.remarksRight) {
    // Explicit left/right column content
    if (data.remarksLeft) {
      drawSimpleColumn(page, data.remarksLeft, PAGE11_BOXES.remarksLeft, monoFont, 9, 10, 48);
    }
    if (data.remarksRight) {
      drawSimpleColumn(page, data.remarksRight, PAGE11_BOXES.remarksRight, monoFont, 9, 10, 48);
    }
  } else if (data.remarks) {
    // Fallback to auto-flow if old data structure used
    drawRemarks(page, data.remarks, PAGE11_BOXES.remarksLeft, PAGE11_BOXES.remarksRight, font);
  }
  
  return doc.save();
}

function wrapTextByCharCount(text: string, maxChars: number): string[] {
  if (!text) return [''];

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    // Check length of (currentLine + space + word)
    if ((currentLine.length + 1 + word.length) <= maxChars) {
      currentLine += ` ${word}`;
    } else {
      // Push current line
      lines.push(currentLine);
      
      // Start new line with word
      // But if the word itself is longer than maxChars, we must split it
      if (word.length > maxChars) {
         let remainingWord = word;
         while (remainingWord.length > maxChars) {
           lines.push(remainingWord.slice(0, maxChars));
           remainingWord = remainingWord.slice(maxChars);
         }
         currentLine = remainingWord;
      } else {
         currentLine = word;
      }
    }
  }

  // Handle the last line (or first line if only one word)
  if (currentLine.length > maxChars) {
      let remainingLine = currentLine;
      while (remainingLine.length > maxChars) {
        lines.push(remainingLine.slice(0, maxChars));
        remainingLine = remainingLine.slice(maxChars);
      }
      lines.push(remainingLine);
  } else {
      lines.push(currentLine);
  }
  
  return lines;
}

function drawSimpleColumn(
  page: PDFPage,
  text: string,
  box: BoxBoundary,
  font: PDFFont,
  fontSize: number = FONT_SIZE,
  lineHeight: number = LINE_HEIGHT,
  maxChars?: number // Optional param for fixed char wrap
) {
  const paragraphs = text.split('\n');
  let currentY = box.top - fontSize;
  
  for (const paragraph of paragraphs) {
    let lines: string[];
    if (maxChars) {
      lines = wrapTextByCharCount(paragraph, maxChars);
    } else {
      lines = wrapText(paragraph, font, fontSize, box.width);
    }

    for (const line of lines) {
      if (currentY < (box.top - box.height)) break;
      
      page.drawText(line, {
        x: box.left,
        y: currentY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });
      currentY -= lineHeight;
    }
    // currentY -= lineHeight; // Paragraph spacing removed as per user request
  }
}
