'use client';

import { useState, useEffect, useCallback } from 'react';
import { FormData, ParagraphData, SignaturePosition } from '@/types';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { getClassification, bannerText } from '@/lib/classification';
import type { EnclosureAttachment, EnclosureRow } from '@/lib/enclosure-rows';
import { isSamePageEndorsement } from '@/lib/same-page-endorsement';
import type { SamePageStatus } from '@/lib/same-page-host';

/** E.3: the bytes of the letter a same-page endorsement is added to, or null. */
export type SamePageHostResolver = () => Promise<Uint8Array | null>;

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
export function useLivePreview(
  data: DocumentDataSlices,
  enclosureArgs: PreviewEnclosureArgs = {},
  resolveSamePageHost?: SamePageHostResolver,
) {
  const { formData, vias, references, enclosures, copyTos, paragraphs, distList } = data;
  const { enclosureRows, enclosureFiles, attachmentCoverPages } = enclosureArgs;

  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  // E.3: where the same-page endorsement landed on the last render.
  // Null for every other document.
  const [samePageStatus, setSamePageStatus] = useState<SamePageStatus | null>(null);

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
      // Eager preview: render on any change, no subject-or-from gate
      // (Stephen 2026-08: the preview should appear as soon as any field is set).
      const ctx = { formData, vias, references, enclosures, copyTos, paragraphs, distList };
      let blob: Blob;
      let status: SamePageStatus | null = null;
      // E.3 (M-5216.5 9-1, Figure 9-1): a same-page endorsement with the
      // letter attached previews as that letter with the endorsement on
      // its signature page, or appended as a new-page endorsement when
      // it does not fit. Signature fields are placed on the block's own
      // page coordinates, so they are not carried onto the composed
      // page; the block alone still takes them.
      const hostBytes = isSamePageEndorsement(formData) && resolveSamePageHost ? await resolveSamePageHost() : null;
      if (hostBytes) {
        const { renderSamePageWithHost } = await import('@/lib/same-page-host');
        const endorsed = await renderSamePageWithHost(ctx, generatePdfForDocType, hostBytes);
        blob = new Blob([new Uint8Array(endorsed.bytes)], { type: 'application/pdf' });
        status = endorsed.placement;
      } else {
        blob = await applySignatureFields(await generatePdfForDocType(ctx));
        if (isSamePageEndorsement(formData)) status = { status: 'no-host' };
      }

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
      setSamePageStatus(status);
    } catch (e) {
      console.error("Preview generation failed", e);
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [formData, vias, references, enclosures, copyTos, paragraphs, distList, applySignatureFields, enclosureRows, enclosureFiles, attachmentCoverPages, resolveSamePageHost]);

  // Auto-refresh preview when form data changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      updatePreview();
    }, 1500);
    return () => clearTimeout(timer);
  }, [updatePreview]);

  return { previewUrl, isGeneratingPreview, updatePreview, applySignatureFields, samePageStatus };
}
