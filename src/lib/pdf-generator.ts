import { pdf } from '@react-pdf/renderer';
import { FormData, ParagraphData } from '@/types';
import { registerPDFFonts } from './pdf-fonts';
import { preloadPDFSeal } from './pdf-seal';
import NavalLetterPDF from '@/components/pdf/NavalLetterPDF';
import React from 'react';
import { openBlobInNewTab } from './blob-utils';
import { addSignatureField, addSignatureFieldAtPosition, addMultipleSignatureFields, ManualSignaturePosition } from './pdf-signature-field';
import { logError } from './console-utils';

// Re-export for convenience
export type { ManualSignaturePosition };

// Track if fonts have been registered
let fontsRegistered = false;

/**
 * Helper to ensure fonts are registered
 */
function ensureFontsRegistered() {
  if (!fontsRegistered) {
    registerPDFFonts();
    fontsRegistered = true;
  }
}

/**
 * Generate a base PDF blob without signature field (for preview/placement)
 */
export async function generateBasePDFBlob(
  formData: FormData,
  vias: string[],
  references: string[],
  enclosures: string[],
  copyTos: string[],
  paragraphs: ParagraphData[],
  distList: string[] = []
): Promise<Blob> {
  ensureFontsRegistered();
  await preloadPDFSeal();

  const document = React.createElement(NavalLetterPDF, {
    formData,
    vias,
    references,
    enclosures,
    copyTos,
    paragraphs,
    distList,
  });

  return pdf(document as any).toBlob();
}

/**
 * Get the number of pages in a PDF blob
 */
export async function getPDFPageCount(blob: Blob): Promise<number> {
  const { PDFDocument } = await import('pdf-lib');
  const pdfBytes = await blob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(pdfBytes);
  return pdfDoc.getPageCount();
}

/**
 * Add a signature field to a PDF at a manually specified position
 */
export async function addSignatureToBlob(
  blob: Blob,
  position: ManualSignaturePosition
): Promise<Blob> {
  const pdfBytes = await blob.arrayBuffer();
  const signedPdfBytes = await addSignatureFieldAtPosition(pdfBytes, position);
  return new Blob([new Uint8Array(signedPdfBytes)], { type: 'application/pdf' });
}

/**
 * Add multiple signature fields to a PDF at specified positions
 */
export async function addMultipleSignaturesToBlob(
  blob: Blob,
  positions: ManualSignaturePosition[]
): Promise<Blob> {
  const pdfBytes = await blob.arrayBuffer();
  const signedPdfBytes = await addMultipleSignatureFields(pdfBytes, positions);
  return new Blob([new Uint8Array(signedPdfBytes)], { type: 'application/pdf' });
}

/**
 * Generate a PDF blob from the naval letter data
 * Includes a digital signature field for CAC/PKI signing in Adobe Reader
 *
 * @param manualPosition - If provided, places signature at this position instead of auto-detecting
 */
export async function generatePDFBlob(
  formData: FormData,
  vias: string[],
  references: string[],
  enclosures: string[],
  copyTos: string[],
  paragraphs: ParagraphData[],
  distList: string[] = [],
  manualPosition?: ManualSignaturePosition
): Promise<Blob> {
  ensureFontsRegistered();
  await preloadPDFSeal();

  // Create the PDF document element
  const document = React.createElement(NavalLetterPDF, {
    formData,
    vias,
    references,
    enclosures,
    copyTos,
    paragraphs,
    distList,
  });

  // Generate initial PDF blob
  const initialBlob = await pdf(document as any).toBlob();

  // Try to add digital signature field for CAC signing
  try {
    const pdfBytes = await initialBlob.arrayBuffer();

    let signedPdfBytes: Uint8Array;

    if (manualPosition) {
      // Use manually specified position
      console.log('Adding signature at manual position:', manualPosition);
      signedPdfBytes = await addSignatureFieldAtPosition(pdfBytes, manualPosition);
      console.log('Signature field added successfully, bytes:', signedPdfBytes.length);
    } else {
      // Auto-detect position based on signer name
      signedPdfBytes = await addSignatureField(pdfBytes, {
        signerName: formData.sig,
      });
    }

    return new Blob([new Uint8Array(signedPdfBytes)], { type: 'application/pdf' });
  } catch (error) {
    // If signature field addition fails, return the original PDF
    console.error('PDF Signature Field Error:', error);
    logError('PDF Signature Field', error);
    return initialBlob;
  }
}

/**
 * Generate and download a PDF file
 *
 * @param manualPosition - If provided, places signature at this position instead of auto-detecting
 */
export async function downloadPDF(
  formData: FormData,
  vias: string[],
  references: string[],
  enclosures: string[],
  copyTos: string[],
  paragraphs: ParagraphData[],
  distList: string[] = [],
  manualPosition?: ManualSignaturePosition
): Promise<void> {
  const blob = await generatePDFBlob(
    formData,
    vias,
    references,
    enclosures,
    copyTos,
    paragraphs,
    distList,
    manualPosition
  );

  // Create filename (same convention as Word but with .pdf)
  let filename: string;
  if (formData.documentType === 'endorsement') {
    filename = `${formData.endorsementLevel}_ENDORSEMENT_on_${formData.subj || 'letter'}_Page${formData.startingPageNumber}.pdf`;
  } else {
    filename = `${formData.subj || 'NavalLetter'}.pdf`;
  }

  // Open in new tab for download with proper filename
  openBlobInNewTab(blob, filename);
}
