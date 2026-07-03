import { describe, it, expect } from 'vitest';
import {
  assemblePdfLines,
  detectSourceFormat,
  extractDocumentText,
  DocumentExtractionError,
  PdfTextItem,
} from '@/services/import/documentTextExtractor';
import { parseCorrespondence } from '@/services/import/correspondenceParser';
import { generateDocxBlob } from '@/lib/docx-generator';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { FormData, ParagraphData } from '@/types';

async function makePdf(lines: string[]): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  lines.forEach((line, i) => {
    if (line) page.drawText(line, { x: 72, y: 720 - i * 18, size: 12, font });
  });
  const bytes = await pdf.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function item(str: string, x: number, y: number, width = 0): PdfTextItem {
  return { str, transform: [1, 0, 0, 1, x, y], width };
}

describe('detectSourceFormat', () => {
  const empty = new ArrayBuffer(0);

  it('detects by extension', () => {
    expect(detectSourceFormat('letter.docx', empty)).toBe('docx');
    expect(detectSourceFormat('LETTER.PDF', empty)).toBe('pdf');
  });

  it('sniffs magic bytes when the extension is unknown', () => {
    const pdfBytes = new TextEncoder().encode('%PDF-1.7').buffer as ArrayBuffer;
    const zipBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]).buffer as ArrayBuffer;
    expect(detectSourceFormat('upload.bin', pdfBytes)).toBe('pdf');
    expect(detectSourceFormat('upload.bin', zipBytes)).toBe('docx');
    expect(detectSourceFormat('upload.txt', empty)).toBeNull();
  });

  it('extractDocumentText rejects unsupported types with a user-facing error', async () => {
    await expect(extractDocumentText(empty, 'notes.txt')).rejects.toThrow(DocumentExtractionError);
    await expect(extractDocumentText(empty, 'notes.txt')).rejects.toThrow(/not a supported file type/);
  });
});

describe('assemblePdfLines', () => {
  it('groups items on the same baseline into one line, top of page first', () => {
    const lines = assemblePdfLines([
      item('Subj:', 72, 700, 30),
      item('TEST SUBJECT', 110, 700.5, 80),
      item('From: CO', 72, 720, 60),
    ]);
    expect(lines).toEqual(['From: CO', 'Subj: TEST SUBJECT']);
  });

  it('does not inject a space into a word split across adjacent items', () => {
    const lines = assemblePdfLines([
      item('G-', 72, 700, 12),
      item('1', 84, 700, 6),
    ]);
    expect(lines).toEqual(['G-1']);
  });

  it('inserts a space across a horizontal gap', () => {
    const lines = assemblePdfLines([
      item('16', 72, 700, 12),
      item('Feb', 90, 700, 20),
      item('26', 116, 700, 12),
    ]);
    expect(lines).toEqual(['16 Feb 26']);
  });

  it('sorts items on a line by x position and skips whitespace-only items', () => {
    const lines = assemblePdfLines([
      item(' ', 100, 700, 5),
      item('World', 120, 700, 40),
      item('Hello', 72, 700, 40),
    ]);
    expect(lines).toEqual(['Hello World']);
  });

  it('returns no lines for a page with no text items', () => {
    expect(assemblePdfLines([])).toEqual([]);
  });
});

describe('pdf extraction (pdf-lib generated fixture)', () => {
  it('extracts a text-layer PDF and parses its fields', async () => {
    const data = await makePdf([
      'UNITED STATES MARINE CORPS',
      '3D MARINE DIVISION',
      '5216',
      'G-1',
      '16 Feb 26',
      '',
      'From: Commanding Officer',
      'To: Commanding General',
      'Subj: PDF TEST SUBJECT',
      '',
      '1. Body paragraph one.',
    ]);
    const text = await extractDocumentText(data, 'letter.pdf');
    expect(text.sourceFormat).toBe('pdf');
    expect(text.warnings).toEqual([]);

    const result = parseCorrespondence(text);
    expect(result.fields.headerType?.value).toBe('USMC');
    expect(result.fields.line1?.value).toBe('3D MARINE DIVISION');
    expect(result.fields.ssic?.value).toBe('5216');
    expect(result.fields.originatorCode?.value).toBe('G-1');
    expect(result.fields.date?.value).toBe('16 Feb 26');
    expect(result.fields.subj?.value).toBe('PDF TEST SUBJECT');
    expect(result.paragraphs).toEqual([{ id: 1, level: 1, content: 'Body paragraph one.' }]);
  });

  it('rejects a PDF with no text layer (scanned image) with a clear error', async () => {
    const data = await makePdf([]);
    await expect(extractDocumentText(data, 'scan.pdf')).rejects.toThrow(/scanned image/);
  });

  it('rejects a corrupt PDF with a user-facing error', async () => {
    const junk = new TextEncoder().encode('%PDF-1.7 not really a pdf').buffer as ArrayBuffer;
    await expect(extractDocumentText(junk, 'broken.pdf')).rejects.toThrow(DocumentExtractionError);
  });
});

describe('docx round trip (generate → extract → parse)', () => {
  const FORM_DATA: FormData = {
    documentType: 'basic',
    ssic: '5216',
    originatorCode: 'G-1',
    date: '16 Feb 26',
    from: 'Commanding Officer, 3d Marine Division',
    to: 'Commanding General, III Marine Expeditionary Force',
    subj: 'ROUND TRIP FIXTURE LETTER',
    sig: 'I. M. MARINE',
    delegationText: 'By direction',
    line1: '3D MARINE DIVISION',
    line1b: '',
    line2: 'UNIT 38410',
    line3: 'FPO AP 96602-8410',
    endorsementLevel: '',
    basicLetterReference: '',
    referenceWho: '',
    referenceType: '',
    referenceDate: '',
    startingReferenceLevel: '',
    startingEnclosureNumber: '',
    startingPageNumber: 1,
    previousPackagePageCount: 0,
    headerType: 'USMC',
    bodyFont: 'times',
    accentColor: 'black',
  };
  const PARAGRAPHS: ParagraphData[] = [
    { id: 1, level: 1, content: 'This is the first paragraph of the letter body.' },
    { id: 2, level: 1, content: 'This is the second paragraph.' },
    { id: 3, level: 2, content: 'This is a subparagraph.' },
    { id: 4, level: 3, content: 'This is a sub-subparagraph.' },
  ];
  const VIAS = ['Chief of Staff'];
  const REFERENCES = ['MCO 5215.1K', 'SECNAV M-5216.5'];
  const ENCLOSURES = ['Sample Enclosure One'];
  const COPY_TOS = ['CMC (ARDB)', 'CG, MCIPAC'];

  it('recovers the fields the app itself exported', async () => {
    const blob = await generateDocxBlob(FORM_DATA, VIAS, REFERENCES, ENCLOSURES, COPY_TOS, PARAGRAPHS, []);
    const data = await blob.arrayBuffer();

    const text = await extractDocumentText(data, 'round-trip.docx');
    expect(text.sourceFormat).toBe('docx');

    const result = parseCorrespondence(text);
    expect(result.fields.headerType?.value).toBe('USMC');
    expect(result.fields.line1?.value).toBe('3D MARINE DIVISION');
    expect(result.fields.line2?.value).toBe('UNIT 38410');
    expect(result.fields.line3?.value).toBe('FPO AP 96602-8410');
    expect(result.fields.ssic?.value).toBe('5216');
    expect(result.fields.originatorCode?.value).toBe('G-1');
    expect(result.fields.date?.value).toBe('16 Feb 26');
    expect(result.fields.from?.value).toBe(FORM_DATA.from);
    expect(result.fields.to?.value).toBe(FORM_DATA.to);
    expect(result.fields.subj?.value).toBe(FORM_DATA.subj);
    expect(result.fields.sig?.value).toBe(FORM_DATA.sig);
    expect(result.fields.delegationText?.value).toBe('By direction');
    expect(result.vias).toEqual(VIAS);
    expect(result.references).toEqual(REFERENCES);
    expect(result.enclosures).toEqual(ENCLOSURES);
    expect(result.copyTos).toEqual(COPY_TOS);
    expect(result.paragraphs.map(p => p.level)).toEqual([1, 1, 2, 3]);
    expect(result.paragraphs.map(p => p.content)).toEqual(PARAGRAPHS.map(p => p.content));
  });

  it('recovers the optional unit sub-name (line1b)', async () => {
    const withSubName: FormData = {
      ...FORM_DATA,
      line1: '3D MARINE LOGISTICS GROUP',
      line1b: 'COMBAT LOGISTICS REGIMENT 35',
    };
    const blob = await generateDocxBlob(withSubName, [], [], [], [], PARAGRAPHS.slice(0, 1), []);
    const text = await extractDocumentText(await blob.arrayBuffer(), 'sub-name.docx');
    const result = parseCorrespondence(text);
    expect(result.fields.line1?.value).toBe('3D MARINE LOGISTICS GROUP');
    expect(result.fields.line1b?.value).toBe('COMBAT LOGISTICS REGIMENT 35');
    expect(result.fields.line2?.value).toBe('UNIT 38410');
    expect(result.fields.line3?.value).toBe('FPO AP 96602-8410');
  });
});
