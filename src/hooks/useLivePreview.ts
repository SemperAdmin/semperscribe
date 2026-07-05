'use client';

import { useState, useEffect, useCallback } from 'react';
import { FormData, ParagraphData, SignaturePosition } from '@/types';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';

/** The document state slices every PDF surface renders from. */
export interface DocumentDataSlices {
  formData: FormData;
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  paragraphs: ParagraphData[];
  distList: string[];
}

/**
 * Live PDF preview: debounced regeneration on document changes, blob
 * URL lifecycle, and the signature-field overlay shared with export.
 */
export function useLivePreview(data: DocumentDataSlices) {
  const { formData, vias, references, enclosures, copyTos, paragraphs, distList } = data;

  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // S2f: configured signature fields ride EVERY PDF surface — preview,
  // export, and the ceremony save all show the same boxes (Stephen's
  // directive: the signer opens the link and sees the PDF with the
  // box ready). Annotation-only (S1), so layout and pagination are
  // untouched.
  const applySignatureFields = useCallback(async (blob: Blob): Promise<Blob> => {
    const fields = (formData.signatureFields as SignaturePosition[] | undefined) ?? [];
    if (fields.length === 0) return blob;
    const { addMultipleSignatureFields } = await import('@/lib/pdf-signature-field');
    const bytes = await addMultipleSignatureFields(await blob.arrayBuffer(), fields.map(f => ({
      page: f.page, x: f.x, y: f.y, width: f.width, height: f.height,
      signerName: f.signerName, reason: f.reason, contactInfo: f.contactInfo,
    })));
    return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  }, [formData.signatureFields]);

  // Manual Preview Generation
  const updatePreview = useCallback(async () => {
    setIsGeneratingPreview(true);
    try {
      const features = DOCUMENT_TYPES[formData.documentType]?.features;
      const isStaffingPaper = features?.category === 'staffing-papers';
      if (features?.pdfPipeline === 'standard' && !isStaffingPaper && !formData.subj && !formData.from) {
        setIsGeneratingPreview(false);
        return;
      }

      const blob = await applySignatureFields(
        await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList })
      );

      const url = URL.createObjectURL(blob);
      setPreviewUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      console.error("Preview generation failed", e);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [formData, vias, references, enclosures, copyTos, paragraphs, distList, applySignatureFields]);

  // Auto-refresh preview when form data changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      updatePreview();
    }, 1500);
    return () => clearTimeout(timer);
  }, [updatePreview]);

  return { previewUrl, isGeneratingPreview, updatePreview, applySignatureFields };
}
