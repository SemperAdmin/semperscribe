
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface DecisionPaperData {
  documentType: string;
  subj: string;
  date: string;
  problem: string;
  discussionPoints?: Array<{ point: string }>;
  recommendation: string;
  [key: string]: unknown;
}

const drawSection = async (context: {
  page: any;
  font: any;
  y: number;
  width: number;
  margin: number;
  fontSize: number;
  lineHeight: number;
  title: string;
  content: string;
}) => {
  const { page, font, y, width, margin, fontSize, lineHeight, title, content } = context;
  let currentY = y;

  page.drawText(title, {
    x: margin,
    y: currentY,
    font: await page.doc.embedFont(StandardFonts.TimesRomanBold),
    size: fontSize,
    color: rgb(0, 0, 0),
  });
  currentY -= lineHeight;

  const lines = content.split('\n');
  for (const line of lines) {
    page.drawText(line, {
      x: margin + 10,
      y: currentY,
      font,
      size: fontSize,
      color: rgb(0, 0, 0),
    });
    currentY -= lineHeight;
  }
  return currentY - lineHeight;
};

export async function createDecisionPaperPdf(data: DecisionPaperData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage();
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const fontSize = 12;
  const margin = 50;
  const lineHeight = fontSize * 1.5;
  let y = height - margin;

  // Title
  page.drawText('DECISION PAPER', {
    x: width / 2 - 50,
    y: y,
    font: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    size: 16,
    color: rgb(0, 0, 0),
  });
  y -= lineHeight * 2;

  // Problem Section
  y = await drawSection({
    page,
    font,
    y,
    width,
    margin,
    fontSize,
    lineHeight,
    title: '1. Problem',
    content: data.problem,
  });

  // Discussion Section
  let discussionContent = '';
  if (data.discussionPoints) {
    discussionContent = data.discussionPoints.map((p: { point: string }, i: number) => `${i + 1}. ${p.point}`).join('\n');
  }
  y = await drawSection({
    page,
    font,
    y,
    width,
    margin,
    fontSize,
    lineHeight,
    title: '2. Discussion',
    content: discussionContent,
  });

  // Recommendation Section. Last section on the page - the returned
  // cursor has no further reader.
  await drawSection({
    page,
    font,
    y,
    width,
    margin,
    fontSize,
    lineHeight,
    title: '3. Recommendation',
    content: data.recommendation,
  });

  return pdfDoc.save();
}
