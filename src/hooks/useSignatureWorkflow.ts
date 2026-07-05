'use client';

import { useState, useCallback } from 'react';
import { FormData, SignaturePosition } from '@/types';
import { getExportBlockers } from '@/lib/letter-validators';
import { generateShareableUrl, copyToClipboard } from '@/lib/url-state';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import type { useToast } from '@/hooks/use-toast';
import type { DocumentDataSlices } from './useLivePreview';

interface UseSignatureWorkflowArgs {
  data: DocumentDataSlices;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  applySignatureFields: (blob: Blob) => Promise<Blob>;
  toast: ReturnType<typeof useToast>['toast'];
}

/**
 * Signature ceremony: placement modal state, field persistence (S2c),
 * the sign-ready blob builder, and the request-link copy path (S2e).
 */
export function useSignatureWorkflow({ data, setFormData, applySignatureFields, toast }: UseSignatureWorkflowArgs) {
  const { formData, vias, references, enclosures, copyTos, paragraphs, distList } = data;

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signaturePdfBlob, setSignaturePdfBlob] = useState<Blob | null>(null);
  const [signaturePdfPageCount, setSignaturePdfPageCount] = useState(1);

  // Signature placement workflow handlers
  const handleOpenSignaturePlacement = async () => {
    try {
      const blob = await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList });
      const { getPDFPageCount } = await import('@/lib/pdf-generator');
      const pageCount = await getPDFPageCount(blob);
      setSignaturePdfBlob(blob);
      setSignaturePdfPageCount(pageCount);
      setShowSignatureModal(true);
    } catch (error) {
      console.error('Error preparing signature placement:', error);
      alert('Failed to prepare PDF for signature placement.');
    }
  };

  // S2c (ruling 2026-06-10): the ORIGINATOR configures fields; confirm
  // persists them on the document — no download here. They travel with
  // the share link, drafts, and .nldp exports inside formData.
  const handleSignatureConfirm = (positions: SignaturePosition[]) => {
    setShowSignatureModal(false);
    setSignaturePdfBlob(null);
    setFormData(prev => ({ ...prev, signatureFields: positions }));
    toast({
      title: 'Signature fields saved',
      description: `${positions.length} field${positions.length === 1 ? '' : 's'} configured. Download the sign-ready PDF or copy a signature request link from the Signature Fields section.`,
    });
  };

  // S2e: one-step persist + request link from the placement modal.
  const handleSignatureConfirmAndCopy = async (positions: SignaturePosition[]) => {
    setShowSignatureModal(false);
    setSignaturePdfBlob(null);
    setFormData(prev => ({ ...prev, signatureFields: positions }));
    await handleCopySignatureRequest(positions);
  };

  // S2c: sign-ready PDF using the configured fields (falls back to the
  // auto-anchored S1 field when none are configured).
  const buildSignReadyBlob = useCallback(async (): Promise<Blob> => {
    const blockers = getExportBlockers(formData, vias, references, paragraphs);
    if (blockers.length > 0) {
      throw new Error('Export blocked: ' + blockers.map((b) => b.rule).join('; '));
    }
    const base = await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList });
    const fields = (formData.signatureFields as SignaturePosition[] | undefined) ?? [];
    if (fields.length > 0) return applySignatureFields(base);
    const { addSignatureField } = await import('@/lib/pdf-signature-field');
    const bytes = await addSignatureField(await base.arrayBuffer(), { signerName: formData.sig });
    return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  }, [formData, vias, references, enclosures, copyTos, paragraphs, distList, applySignatureFields]);

  // S2c: request link = share state v2; the e-mail carries the who/
  // when/where (ruling: no routing form fields). S2e: accepts fresh
  // positions from the placement modal so the link never trails the
  // async formData update.
  const handleCopySignatureRequest = async (freshFields?: SignaturePosition[]) => {
    const fields = freshFields ?? (formData.signatureFields as SignaturePosition[] | undefined) ?? [];
    const { url, isLong, error } = generateShareableUrl({
      formData: freshFields ? { ...formData, signatureFields: freshFields } : formData,
      paragraphs, references, enclosures, vias, copyTos, distList,
      routing: { requestedSigner: fields[0]?.signerName || formData.sig || '' },
      version: 2,
    });
    if (error && !url) {
      toast({ title: 'Failed to build link', description: error, variant: 'destructive' });
      return;
    }
    const ok = await copyToClipboard(url);
    toast(ok
      ? {
          title: 'Signature request link copied',
          description: (isLong ? 'Link is very long and may not work everywhere. ' : '') +
            'Paste it into your request e-mail. The link contains the full letter text — send it only through channels appropriate for the content.',
        }
      : { title: 'Copy failed', description: 'Could not copy to clipboard.', variant: 'destructive' });
  };

  const handleSignatureCancel = () => {
    setShowSignatureModal(false);
    setSignaturePdfBlob(null);
  };

  return {
    showSignatureModal,
    signaturePdfBlob,
    signaturePdfPageCount,
    handleOpenSignaturePlacement,
    handleSignatureConfirm,
    handleSignatureConfirmAndCopy,
    handleSignatureCancel,
    handleCopySignatureRequest,
    buildSignReadyBlob,
  };
}
