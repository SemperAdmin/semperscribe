/**
 * PDF Signature Field Utility (S1, SIGNATURE_COLLECTION_PLAN.md)
 *
 * Adds empty AcroForm digital-signature fields for CAC/PKI signing in
 * Adobe Acrobat/Reader. ANNOTATION-ONLY by design: the page content
 * stream is never touched. The "sign here" cue lives in the widget's
 * normal appearance stream (/AP /N), which Acrobat REPLACES with the
 * signature appearance at signing time — so the placeholder vanishes
 * from the signed artifact. The pre-S1 implementation drew the cue
 * into the page content itself, leaving permanent ink on official
 * correspondence (defect logged 2026-06-10; Stephen's first CAC-signed
 * export carries it).
 *
 * Signature format expectation: CMS PKCS#7 detached over ByteRange
 * (adbe.pkcs7.detached), per DoDI 8520.02 — verified against a real
 * CAC-signed export (DOD EMAIL CA-70 -> DoD Root CA 6) 2026-06-10.
 */

import { PDFDocument, PDFPage, PDFDict, PDFArray, PDFRawStream, decodePDFRawStream, PDFName, PDFString, PDFNumber, PDFRef, StandardFonts } from 'pdf-lib';
import { PDF_INDENTS, PDF_MARGINS } from './pdf-settings';

// Signature field dimensions in points (1 inch = 72 points)
const SIGNATURE_FIELD = {
  width: 108,          // 1.5 inches
  height: 36,          // ~0.5 inches (2 lines at ~18pt)
  xOffset: PDF_MARGINS.left + PDF_INDENTS.signature,  // Page margin + signature indent (aligned with signature block)
  yAboveName: 24,      // Points to shift up from the signature name position
};

// Default Y position as percentage from bottom if text search fails
const DEFAULT_Y_RATIO = 0.35;

/**
 * Configuration for signature field placement
 */
export interface SignatureFieldConfig {
  /** Y position from bottom of page in points (if known) */
  yPosition?: number;
  /** Signer's name to search for in the PDF to determine positioning */
  signerName?: string;
}

/**
 * User-specified signature position from the placement modal
 */
export interface ManualSignaturePosition {
  /** Page number (1-indexed) */
  page: number;
  /** X position from left edge in points */
  x: number;
  /** Y position from bottom edge in points */
  y: number;
  /** Width in points */
  width: number;
  /** Height in points */
  height: number;
  /** Name of the signer (for display and tooltip) */
  signerName?: string;
  /** Reason for signing */
  reason?: string;
  /** Contact info for the signer */
  contactInfo?: string;
}

/**
 * S1 — deterministic per-signer field names so multi-signer routing
 * (endorsement chains, by-direction) addresses fields by name.
 * Format: Signature_<n>_<SIGNER_SLUG>, or Signature_<n> without a name.
 */
export function buildSignatureFieldName(index: number, signerName?: string): string {
  const slug = (signerName || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return slug ? `Signature_${index}_${slug}` : `Signature_${index}`;
}

/** Escape a string for a PDF literal string inside an appearance stream. */
function escapePdfText(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * S1 — widget normal appearance (/AP /N): dashed box + gray cue text,
 * rendered as a Form XObject on the ANNOTATION. Zero page-content
 * writes. Acrobat substitutes the signature appearance when signed.
 */
function createWidgetAppearance(
  pdfDoc: PDFDocument,
  helveticaRef: PDFRef,
  width: number,
  height: number,
  label: string,
): PDFRef {
  const ops = [
    'q',
    '[3 3] 0 d',
    '0.45 0.45 0.65 RG',
    '0.75 w',
    `0.5 0.5 ${(width - 1).toFixed(2)} ${(height - 1).toFixed(2)} re`,
    'S',
    'BT',
    '0.35 0.35 0.55 rg',
    '/F0 7 Tf',
    `3 ${(height - 11).toFixed(2)} Td`,
    `(${escapePdfText(label)}) Tj`,
    'ET',
    'Q',
  ].join('\n');
  const stream = pdfDoc.context.stream(ops, {
    Type: 'XObject',
    Subtype: 'Form',
    BBox: [0, 0, width, height],
    Resources: { Font: { F0: helveticaRef } },
  });
  return pdfDoc.context.register(stream);
}

function getDecodedContent(page: PDFPage): string | undefined {
  try {
    const rawContent = page.node.Contents();
    if (!rawContent) return undefined;

    let contentBytes: Uint8Array | undefined;

    if (rawContent instanceof PDFRawStream) {
      contentBytes = decodePDFRawStream(rawContent).decode();
    } else if (rawContent instanceof PDFArray) {
      const chunks: Uint8Array[] = [];
      for (let i = 0; i < rawContent.size(); i++) {
        const stream = rawContent.lookup(i);
        if (stream instanceof PDFRawStream) {
          chunks.push(decodePDFRawStream(stream).decode());
        }
      }
      if (chunks.length > 0) {
        const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        contentBytes = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          contentBytes.set(chunk, offset);
          offset += chunk.length;
        }
      }
    }

    if (!contentBytes || contentBytes.length === 0) return undefined;
    return new TextDecoder('latin1').decode(contentBytes);
  } catch {
    return undefined;
  }
}

/**
 * Finds text positioned at the signature X coordinate.
 * The signature block has a unique X position (PDF_MARGINS.left + PDF_INDENTS.signature),
 * so we can find it by looking for text at that position.
 *
 * Strategy: Collect all text positions, then find the lowest one in the signature X range.
 * The signature is typically the last (lowest) content on the page in that column.
 *
 * @param page - The PDF page to search
 * @returns Y position if signature-positioned text is found, undefined otherwise
 */
function findSignatureYPosition(page: PDFPage): number | undefined {
  try {
    const contentStr = getDecodedContent(page);
    if (!contentStr) return undefined;

    // The signature X position range (generous tolerance for different renderers)
    const signatureX = SIGNATURE_FIELD.xOffset;
    const minX = signatureX - 20;
    const maxX = signatureX + 50;

    // Track current position - handle both Tm (absolute) and Td (relative)
    let currentX = 0;
    let currentY = 0;

    // Collect all positions that could be signature text
    const signaturePositions: number[] = [];

    // Combined regex to match Tm and Td operators
    const posRegex = /(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+Tm|(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+T[dD]/g;

    let match;
    while ((match = posRegex.exec(contentStr)) !== null) {
      if (match[6] !== undefined) {
        // Tm operator - absolute positioning
        currentX = parseFloat(match[5]);
        currentY = parseFloat(match[6]);
      } else if (match[8] !== undefined) {
        // Td/TD operator - relative positioning
        currentX += parseFloat(match[7]);
        currentY += parseFloat(match[8]);
      }

      // Check if this position is in the signature X range
      if (currentX >= minX && currentX <= maxX && currentY > 0 && currentY < 700) {
        signaturePositions.push(currentY);
      }
    }

    // Return the lowest Y position in the signature range (lowest on page = smallest Y)
    if (signaturePositions.length > 0) {
      return Math.min(...signaturePositions);
    }

    return undefined;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error finding signature position:', error);
    }
    return undefined;
  }
}

/**
 * Attempts to find text in a PDF page and return its Y position.
 * Searches through the page's content stream for text operations.
 * Handles compressed streams (FlateDecode) used by React-PDF.
 *
 * @param page - The PDF page to search
 * @param searchText - Text to search for (case-insensitive)
 * @returns Y position if found, undefined otherwise
 */
function findTextYPosition(page: PDFPage, searchText: string): number | undefined {
  try {
    const contentStr = getDecodedContent(page);
    if (!contentStr) return undefined;

    const searchUpper = searchText.toUpperCase();

    // Track current Y position from positioning operators
    let currentY = 0;
    let foundY: number | undefined;

    // Combined regex to match operators in order
    const operatorRegex = /(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+Tm|(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+T[dD]|\(([^)]*)\)\s*Tj|\[([^\]]*)\]\s*TJ/g;

    let match;
    while ((match = operatorRegex.exec(contentStr)) !== null) {
      if (match[6] !== undefined) {
        currentY = parseFloat(match[6]);
      } else if (match[8] !== undefined) {
        currentY += parseFloat(match[8]);
      } else if (match[9] !== undefined) {
        if (currentY > 0 && match[9].toUpperCase().includes(searchUpper)) {
          foundY = currentY;
        }
      } else if (match[10] !== undefined) {
        const tjText = match[10].replace(/\([^)]*\)/g, (m) => m.slice(1, -1)).toUpperCase();
        if (currentY > 0 && tjText.includes(searchUpper)) {
          foundY = currentY;
        }
      }
    }

    return foundY;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error parsing PDF content to find text position:', error);
    }
    return undefined;
  }
}

/**
 * Adds an empty signature field on the page containing the signature
 * block. Users click the field in Adobe Acrobat/Reader and sign with
 * their CAC. Annotation-only: no page content is drawn.
 *
 * @param pdfBytes - The PDF as a Uint8Array or ArrayBuffer
 * @param config - Optional configuration for field placement
 * @returns The modified PDF as Uint8Array
 */
export async function addSignatureField(
  pdfBytes: Uint8Array | ArrayBuffer,
  config: SignatureFieldConfig = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  // Find the page containing the signature and its Y position
  let targetPage = pages[pages.length - 1]; // Default to last page
  let pageNumber = pages.length;
  let yPosition = config.yPosition;

  // Search all pages for signature (starting from last page, most likely location)
  if (yPosition === undefined) {
    for (let i = pages.length - 1; i >= 0; i--) {
      // Primary method: find text at the signature X coordinate
      let textY = findSignatureYPosition(pages[i]);

      // Fallback: search for signer's name in text content
      if (textY === undefined && config.signerName) {
        textY = findTextYPosition(pages[i], config.signerName);
      }

      if (textY !== undefined) {
        targetPage = pages[i];
        pageNumber = i + 1;
        // Position the signature box directly above the signer's name
        yPosition = textY + SIGNATURE_FIELD.yAboveName;
        break;
      }
    }
  }

  const { height } = targetPage.getSize();
  if (yPosition === undefined) {
    yPosition = height * DEFAULT_Y_RATIO;
  }

  await createSignatureField(pdfDoc, targetPage, {
    page: pageNumber,
    x: SIGNATURE_FIELD.xOffset,
    y: yPosition,
    width: SIGNATURE_FIELD.width,
    height: SIGNATURE_FIELD.height,
    signerName: config.signerName,
  }, buildSignatureFieldName(1, config.signerName));

  return pdfDoc.save();
}

/**
 * Creates a PDF AcroForm signature field signable with PKI/CAC.
 * Annotation + appearance stream only; the page content stream is
 * never modified (S1 acceptance criterion).
 */
async function createSignatureField(
  pdfDoc: PDFDocument,
  targetPage: PDFPage,
  position: ManualSignaturePosition,
  fieldName: string
): Promise<PDFRef> {
  const context = pdfDoc.context;

  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const label = position.signerName ? `Sign here: ${position.signerName}` : 'Sign here (CAC)';
  const apRef = createWidgetAppearance(pdfDoc, helvetica.ref, position.width, position.height, label);

  // Create the signature field dictionary
  const sigFieldDict = context.obj({
    FT: PDFName.of('Sig'),           // Field Type: Signature
    T: PDFString.of(fieldName),      // Field name
    TU: position.signerName ? PDFString.of(`Signer: ${position.signerName}`) : undefined, // Tooltip
    Ff: PDFNumber.of(0),             // Field flags
    Type: PDFName.of('Annot'),
    Subtype: PDFName.of('Widget'),
    Rect: [
      PDFNumber.of(position.x),
      PDFNumber.of(position.y),
      PDFNumber.of(position.x + position.width),
      PDFNumber.of(position.y + position.height),
    ],
    AP: { N: apRef },                // S1: cue lives on the widget, not the page
    F: PDFNumber.of(4),              // Print flag
    P: targetPage.ref,               // Page reference
  });

  const sigFieldRef = context.register(sigFieldDict);

  // Get or create the AcroForm - use get() to safely check existence
  const acroFormRef = pdfDoc.catalog.get(PDFName.of('AcroForm'));

  if (acroFormRef) {
    const acroForm = context.lookup(acroFormRef) as PDFDict;
    const fieldsRef = acroForm.get(PDFName.of('Fields'));
    if (fieldsRef) {
      const fields = context.lookup(fieldsRef) as PDFArray;
      fields.push(sigFieldRef);
    } else {
      acroForm.set(PDFName.of('Fields'), context.obj([sigFieldRef]));
    }
    // SigFlags 3 = SignaturesExist | AppendOnly
    acroForm.set(PDFName.of('SigFlags'), PDFNumber.of(3));
  } else {
    const newAcroForm = context.obj({
      Fields: [sigFieldRef],
      SigFlags: PDFNumber.of(3),
    });
    pdfDoc.catalog.set(PDFName.of('AcroForm'), newAcroForm);
  }

  // Add the widget annotation to the page - use get() to safely check existence
  const annotsRef = targetPage.node.get(PDFName.of('Annots'));
  if (annotsRef) {
    const annots = context.lookup(annotsRef) as PDFArray;
    annots.push(sigFieldRef);
  } else {
    targetPage.node.set(PDFName.of('Annots'), context.obj([sigFieldRef]));
  }

  return sigFieldRef;
}

/**
 * Adds a signature field at a user-specified position (placement
 * modal path). Annotation-only.
 */
export async function addSignatureFieldAtPosition(
  pdfBytes: Uint8Array | ArrayBuffer,
  position: ManualSignaturePosition
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  const pageIndex = Math.max(0, Math.min(position.page - 1, pages.length - 1));
  const targetPage = pages[pageIndex];

  await createSignatureField(pdfDoc, targetPage, position, buildSignatureFieldName(1, position.signerName));

  return pdfDoc.save();
}

/**
 * Adds multiple signature fields at user-specified positions, with
 * unique deterministic names. Annotation-only.
 */
export async function addMultipleSignatureFields(
  pdfBytes: Uint8Array | ArrayBuffer,
  positions: ManualSignaturePosition[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  for (let index = 0; index < positions.length; index++) {
    const position = positions[index];
    const pageIndex = Math.max(0, Math.min(position.page - 1, pages.length - 1));
    const targetPage = pages[pageIndex];
    await createSignatureField(pdfDoc, targetPage, position, buildSignatureFieldName(index + 1, position.signerName));
  }

  return pdfDoc.save();
}
