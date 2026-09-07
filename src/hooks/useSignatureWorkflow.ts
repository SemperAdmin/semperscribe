'use client';

import { useState, useCallback } from 'react';
import { FormData, SignaturePosition } from '@/types';
import { getExportBlockers } from '@/lib/letter-validators';
import { generateEncryptedShareUrl, copyToClipboard } from '@/lib/url-state';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { getClassification, bannerText } from '@/lib/classification';
import { clearedForExport } from '@/lib/export-gate';
import { isEdmsMode } from '@/lib/edms-mode';
import { MIN_SHARE_PASSWORD_LENGTH, type ShareLinkOptions } from '@/components/ShareLinkDialog';
import type { useToast } from '@/hooks/use-toast';
import type { DocumentDataSlices } from './useLivePreview';
import type { EnclosureAttachment, EnclosureRow } from '@/lib/enclosure-rows';

interface UseSignatureWorkflowArgs {
  data: DocumentDataSlices;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  applySignatureFields: (blob: Blob) => Promise<Blob>;
  toast: ReturnType<typeof useToast>['toast'];
  /** ENC: bound files shown (not signable) in the placement modal and
   * merged into the sign-ready download. */
  enclosureRows?: EnclosureRow[];
  enclosureFiles?: ReadonlyMap<string, EnclosureAttachment>;
  attachmentCoverPages?: boolean;
}

/**
 * P2-1: how a signature request link is protected. The password is
 * REQUIRED. A request link carries the whole letter plus a routing slip
 * telling the recipient to sign it, and the plaintext share format
 * (`#s=`, formerly `?share=`) would let it travel unprotected and let
 * anyone construct one. There is no opt-out here, unlike the plain
 * share dialog, because the request link was the one path which
 * bypassed both the password default and the EDMS lock.
 */
export type SignatureRequestLinkOptions = ShareLinkOptions;

/**
 * Signature ceremony: placement modal state, field persistence (S2c),
 * the sign-ready blob builder, and the request-link copy path (S2e).
 */
export function useSignatureWorkflow({
  data, setFormData, applySignatureFields, toast,
  enclosureRows, enclosureFiles, attachmentCoverPages,
}: UseSignatureWorkflowArgs) {
  const { formData, vias, references, enclosures, copyTos, paragraphs, distList } = data;

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [signaturePdfBlob, setSignaturePdfBlob] = useState<Blob | null>(null);
  const [signaturePdfPageCount, setSignaturePdfPageCount] = useState(1);
  // ENC: pages 1..letterPageCount take signature fields; pages beyond
  // are merged enclosures, shown for context only. Fields ride request
  // LINKS, and links never carry enclosure files - a field on an
  // enclosure page would point at a page the signer's machine cannot
  // rebuild.
  const [signatureLetterPageCount, setSignatureLetterPageCount] = useState(1);

  // ENC: shared merge step - identical options to preview and export.
  const mergeEnclosuresIfAny = useCallback(async (blob: Blob): Promise<Blob> => {
    if (!enclosureRows || !enclosureFiles) return blob;
    const { mergeAttachmentsIntoPdf, computeMergeItems } = await import('@/lib/enclosure-attachments');
    const startingNumber = parseInt(formData.startingEnclosureNumber || '1', 10);
    const items = computeMergeItems(enclosureRows, enclosureFiles, startingNumber);
    if (items.length === 0) return blob;
    const cls = getClassification(formData);
    const mergedBytes = await mergeAttachmentsIntoPdf(await blob.arrayBuffer(), items, {
      coverPages: attachmentCoverPages ?? false,
      bannerText: cls.enabled ? bannerText(cls) : undefined,
    });
    return new Blob([new Uint8Array(mergedBytes)], { type: 'application/pdf' });
  }, [enclosureRows, enclosureFiles, attachmentCoverPages, formData]);

  // Signature placement workflow handlers
  const handleOpenSignaturePlacement = async () => {
    try {
      const letterBlob = await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList });
      const { getPDFPageCount } = await import('@/lib/pdf-generator');
      const letterPages = await getPDFPageCount(letterBlob);
      const merged = await mergeEnclosuresIfAny(letterBlob);
      const totalPages = merged === letterBlob ? letterPages : await getPDFPageCount(merged);
      setSignaturePdfBlob(merged);
      setSignaturePdfPageCount(totalPages);
      setSignatureLetterPageCount(letterPages);
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

  // S2e: one-step persist + request link from the placement modal. The
  // modal collects the password (P2-1) before calling this.
  const handleSignatureConfirmAndCopy = async (positions: SignaturePosition[], options: SignatureRequestLinkOptions = {}) => {
    setShowSignatureModal(false);
    setSignaturePdfBlob(null);
    setFormData(prev => ({ ...prev, signatureFields: positions }));
    await handleCopySignatureRequest(positions, options);
  };

  // S2c: sign-ready PDF using the configured fields (falls back to the
  // auto-anchored S1 field when none are configured).
  //
  // P2-6: the sign-ready PDF is a download like any other, so it runs
  // the same sensitive-data gate useDocumentExport runs, over the same
  // slices, before the PDF is generated. A refused scan toasts here and
  // rejects with an AbortError, which the ceremony panel already treats
  // as "the user backed out" rather than as a generation failure.
  const buildSignReadyBlob = useCallback(async (): Promise<Blob> => {
    const blockers = getExportBlockers(formData, vias, references, paragraphs);
    if (blockers.length > 0) {
      throw new Error('Export blocked: ' + blockers.map((b) => b.rule).join('; '));
    }
    const cleared = await clearedForExport({ formData, vias, references, enclosures, copyTos, paragraphs, distList });
    if (!cleared) {
      toast({ title: 'Sign-ready PDF not created', description: 'Review the flagged content, then try again.' });
      throw new DOMException('Sign-ready PDF refused at the sensitive-data gate', 'AbortError');
    }
    const base = await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList });
    const fields = (formData.signatureFields as SignaturePosition[] | undefined) ?? [];
    // ENC: fields apply to the letter first (letter-relative indices),
    // then enclosures merge behind - the same order as export/preview.
    if (fields.length > 0) return mergeEnclosuresIfAny(await applySignatureFields(base));
    const { addSignatureField } = await import('@/lib/pdf-signature-field');
    const bytes = await addSignatureField(await base.arrayBuffer(), { signerName: formData.sig });
    return mergeEnclosuresIfAny(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }));
  }, [formData, vias, references, enclosures, copyTos, paragraphs, distList, applySignatureFields, mergeEnclosuresIfAny, toast]);

  // S2c: request link = share state v2; the e-mail carries the who/
  // when/where (ruling: no routing form fields). S2e: accepts fresh
  // positions from the placement modal so the link never trails the
  // async formData update.
  //
  // P2-1: always the encrypted `#es=` format. Order of checks: password
  // policy first (cheap, and the user fixes it in the dialog), then the
  // sensitive-data gate over the exact state the link will carry, then
  // encryption. Nothing reaches the clipboard before all three pass.
  const handleCopySignatureRequest = async (freshFields?: SignaturePosition[], options: SignatureRequestLinkOptions = {}) => {
    const { password, expiresDays } = options;
    if (!password) {
      toast({
        title: 'Password required',
        description: isEdmsMode()
          ? 'EDMS draft. A signature request link must be password-protected; an unprotected link is not available here.'
          : 'A signature request link carries the whole letter and a request to sign it, so it is always password-protected.',
        variant: 'destructive',
      });
      return;
    }
    if (password.length < MIN_SHARE_PASSWORD_LENGTH) {
      toast({
        title: 'Password too short',
        description: `Use at least ${MIN_SHARE_PASSWORD_LENGTH} characters.`,
        variant: 'destructive',
      });
      return;
    }

    const fields = freshFields ?? (formData.signatureFields as SignaturePosition[] | undefined) ?? [];
    const linkFormData = freshFields ? { ...formData, signatureFields: freshFields } : formData;

    const cleared = await clearedForExport({ formData: linkFormData, vias, references, enclosures, copyTos, paragraphs, distList });
    if (!cleared) {
      toast({ title: 'Request link not created', description: 'Review the flagged content, then try again.' });
      return;
    }

    const { url, isLong, error } = await generateEncryptedShareUrl({
      formData: linkFormData,
      paragraphs, references, enclosures, vias, copyTos, distList,
      routing: { requestedSigner: fields[0]?.signerName || formData.sig || '' },
      expires: expiresDays ? new Date(Date.now() + expiresDays * 24 * 60 * 60 * 1000).toISOString() : undefined,
      version: 2,
    }, password);
    if (error && !url) {
      toast({ title: 'Failed to build link', description: error, variant: 'destructive' });
      return;
    }
    const ok = await copyToClipboard(url);
    toast(ok
      ? {
          title: 'Signature request link copied',
          description: (isLong ? 'Link is very long and may not work everywhere. ' : '') +
            'Paste it into your request e-mail and send the password through a separate channel. The link carries the full letter text, encrypted with that password.',
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
    signatureLetterPageCount,
    handleOpenSignaturePlacement,
    handleSignatureConfirm,
    handleSignatureConfirmAndCopy,
    handleSignatureCancel,
    handleCopySignatureRequest,
    buildSignReadyBlob,
  };
}
