'use client';

import { useState, useEffect, useCallback } from 'react';
import { FormData, ParagraphData, SignaturePosition } from '@/types';
import { DOCUMENT_TYPES } from '@/lib/schemas';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { getClassification, bannerText } from '@/lib/classification';
import type { EnclosureAttachment, EnclosureRow } from '@/lib/enclosure-attachments';

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

/** ENC: bound enclosure files merged into the preview (Stephen's
 * 2026-07-16 ruling: the preview shows the full package, WYSIWYG with
 * the export). Optional - callers without files pass nothing. */
export interface PreviewEnclosureArgs {
  enclosureRows?: EnclosureRow[];
  enclosureFiles?: ReadonlyMap<string, EnclosureAttachment>;
  attachmentCoverPages?: boolean;
}

/**
 * Live PDF preview: debounced regeneration on document changes, blob
 * URL lifecycle, and the signature-field overlay shared with export.
 */
export function useLivePreview(data: DocumentDataSlices, enclosureArgs: PreviewEnclosureArgs = {}) {
  const { formData, vias, references, enclosures, copyTos, paragraphs, distList } = data;
  const { enclosureRows, enclosureFiles, attachmentCoverPages } = enclosureArgs;

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

      let blob = await applySignatureFields(
        await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList })
      );

      // ENC: merge bound enclosure files behind the letter - the SAME
      // order and options as export (signature fields first, merge
      // after), so the preview IS the export.
      if (enclosureRows && enclosureFiles) {
        const { mergeAttachmentsIntoPdf, computeMergeItems } = await import('@/lib/enclosure-attachments');
        const startingNumber = parseInt(formData.startingEnclosureNumber || '1', 10);
        const items = computeMergeItems(enclosureRows, enclosureFiles, startingNumber);
        if (items.length > 0) {
          const cls = getClassification(formData);
          const mergedBytes = await mergeAttachmentsIntoPdf(await blob.arrayBuffer(), items, {
            coverPages: attachmentCoverPages ?? false,
            bannerText: cls.enabled ? bannerText(cls) : undefined,
          });
          blob = new Blob([new Uint8Array(mergedBytes)], { type: 'application/pdf' });
        }
      }

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
  }, [formData, vias, references, enclosures, copyTos, paragraphs, distList, applySignatureFields, enclosureRows, enclosureFiles, attachmentCoverPages]);

  // Auto-refresh preview when form data changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      updatePreview();
    }, 1500);
    return () => clearTimeout(timer);
  }, [updatePreview]);

  return { previewUrl, isGeneratingPreview, updatePreview, applySignatureFields };
}
