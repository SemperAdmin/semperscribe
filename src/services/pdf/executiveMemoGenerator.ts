import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';

export interface ExecMemoData {
  execFormat: 'standard-memo' | 'action-memo' | 'info-memo';
  date?: string;
  omitDate?: boolean;
  memoFor?: string;
  memoFrom?: string;
  subj?: string;
  sig?: string;
  signerTitle?: string;
  omitSignatureBlock?: boolean;
  preparedBy?: string;
  preparedByPhone?: string;
  paragraphs?: { content: string }[];
  [key: string]: unknown;
}

const MARGIN = 72; // 1 inch
const TOP_MARGIN_FIRST = 144; // 2 inches per Ch 12-4
const FONT_SIZE = 12;
const LINE_HEIGHT = FONT_SIZE * 1.5;
const INDENT = 36; // 0.5 inch paragraph indent

export async function createExecutiveMemoPdf(data: ExecMemoData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]); // Letter size
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const { width } = page.getSize();
  const maxWidth = width - MARGIN * 2;
  let y = 792 - TOP_MARGIN_FIRST;

  const drawText = (text: string, x: number, yPos: number, options?: { font?: PDFFont; size?: number }) => {
    const f = options?.font || font;
    const s = options?.size || FONT_SIZE;
    page.drawText(text, { x, y: yPos, font: f, size: s, color: rgb(0, 0, 0) });
    return yPos - LINE_HEIGHT;
  };

  const wrapText = (text: string, maxW: number, f: PDFFont = font): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (f.widthOfTextAtSize(test, FONT_SIZE) > maxW) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([612, 792]);
      y = 792 - MARGIN;
    }
  };

  const isActionMemo = data.execFormat === 'action-memo';
  const isInfoMemo = data.execFormat === 'info-memo';

  // Title (centered, bold)
  const title = isActionMemo ? 'ACTION MEMO' : isInfoMemo ? 'INFO MEMO' : '';
  if (title) {
    const titleWidth = boldFont.widthOfTextAtSize(title, FONT_SIZE);
    y = drawText(title, (width - titleWidth) / 2, y, { font: boldFont });
    y -= LINE_HEIGHT; // double space after title
  }

  // Date (right-aligned, unless omitted)
  if (!data.omitDate && data.date) {
    const dateWidth = font.widthOfTextAtSize(data.date, FONT_SIZE);
    y = drawText(data.date, width - MARGIN - dateWidth, y);
    y -= LINE_HEIGHT;
  }

  // MEMORANDUM FOR / FOR line
  if (data.memoFor) {
    const label = (isActionMemo || isInfoMemo) ? 'FOR:' : 'MEMORANDUM FOR';
    const labelWidth = boldFont.widthOfTextAtSize(label, FONT_SIZE);
    drawText(label, MARGIN, y, { font: boldFont });
    // Addressee(s) - may be multiline
    const addressees = data.memoFor.split('\n');
    const addrX = MARGIN + labelWidth + 8;
    for (let i = 0; i < addressees.length; i++) {
      if (i === 0) {
        y = drawText(addressees[i].trim(), addrX, y);
      } else {
        y = drawText(addressees[i].trim(), addrX, y);
      }
    }
    y -= LINE_HEIGHT;
  }

  // FROM line (action/info memos)
  if ((isActionMemo || isInfoMemo) && data.memoFrom) {
    const fromLabel = 'FROM:';
    const fromLabelWidth = boldFont.widthOfTextAtSize(fromLabel, FONT_SIZE);
    drawText(fromLabel, MARGIN, y, { font: boldFont });
    y = drawText(data.memoFrom, MARGIN + fromLabelWidth + 8, y);
    y -= LINE_HEIGHT;
  }

  // SUBJECT line
  if (data.subj) {
    const subjLabel = 'SUBJECT:';
    const subjLabelWidth = boldFont.widthOfTextAtSize(subjLabel, FONT_SIZE);
    drawText(subjLabel, MARGIN, y, { font: boldFont });
    const subjLines = wrapText(data.subj, maxWidth - subjLabelWidth - 8);
    for (let i = 0; i < subjLines.length; i++) {
      if (i === 0) {
        y = drawText(subjLines[i], MARGIN + subjLabelWidth + 8, y);
      } else {
        y = drawText(subjLines[i], MARGIN + subjLabelWidth + 8, y);
      }
    }
    y -= LINE_HEIGHT;
  }

  // Body paragraphs
  const paragraphs = data.paragraphs || [];
  for (const para of paragraphs) {
    if (!para.content?.trim()) continue;
    ensureSpace(LINE_HEIGHT * 2);

    if (isActionMemo || isInfoMemo) {
      // Bullet format per Ch 12-4 para 3
      const bulletText = '•  ' + para.content;
      const lines = wrapText(bulletText, maxWidth - INDENT);
      for (let i = 0; i < lines.length; i++) {
        ensureSpace(LINE_HEIGHT);
        y = drawText(lines[i], MARGIN + (i === 0 ? 0 : INDENT), y);
      }
      y -= LINE_HEIGHT; // double space between bullets
    } else {
      // Standard memo: indented paragraphs, no numbering
      const lines = wrapText(para.content, maxWidth - INDENT);
      for (let i = 0; i < lines.length; i++) {
        ensureSpace(LINE_HEIGHT);
        y = drawText(lines[i], MARGIN + (i === 0 ? INDENT : 0), y);
      }
      y -= LINE_HEIGHT; // double space between paragraphs
    }
  }

  // RECOMMENDATION line (action memos)
  if (isActionMemo) {
    ensureSpace(LINE_HEIGHT * 3);
    const recLabel = 'RECOMMENDATION:';
    drawText(recLabel, MARGIN, y, { font: boldFont });
    y -= LINE_HEIGHT;
    // Approve / Disapprove lines
    y = drawText('Approve ____    Disapprove ____', MARGIN + INDENT, y);
    y -= LINE_HEIGHT;
  }

  // COORDINATION line (action/info memos)
  if (isActionMemo || isInfoMemo) {
    ensureSpace(LINE_HEIGHT * 2);
    y = drawText('COORDINATION: [Tab D] or [None]', MARGIN, y, { font: boldFont });
    y -= LINE_HEIGHT;
  }

  // Signature block (standard memo)
  if (!isActionMemo && !isInfoMemo && !data.omitSignatureBlock) {
    ensureSpace(LINE_HEIGHT * 5);
    y -= LINE_HEIGHT * 3; // 4 blank lines
    const centerX = width / 2;
    if (data.sig) {
      y = drawText(data.sig, centerX, y);
    }
    if (data.signerTitle) {
      y = drawText(data.signerTitle, centerX, y);
    }
  }

  // Attachments line
  if (isActionMemo || isInfoMemo) {
    ensureSpace(LINE_HEIGHT * 2);
    y = drawText('Attachments:', MARGIN, y);
    y = drawText('As stated', MARGIN, y);
    y -= LINE_HEIGHT;
  }

  // Prepared By line
  if (data.preparedBy) {
    ensureSpace(LINE_HEIGHT * 2);
    let prepText = `Prepared By: ${data.preparedBy}`;
    if (data.preparedByPhone) prepText += `, ${data.preparedByPhone}`;
    y = drawText(prepText, MARGIN, y);
  }

  return pdfDoc.save();
}
