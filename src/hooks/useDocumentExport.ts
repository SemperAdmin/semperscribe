'use client';

import { DOCUMENT_TYPES } from '@/lib/schemas';
import { getExportBlockers, secnavPageCapIssue } from '@/lib/letter-validators';
import { getExportFilename, mergeAdminSubsections } from '@/lib/naval-format-utils';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { downloadDocument } from '@/services/export/index';
import type { DocumentDataSlices } from './useLivePreview';
import type { EnclosureAttachment, EnclosureRow } from '@/lib/enclosure-attachments';
import { getClassification, bannerText } from '@/lib/classification';

interface UseDocumentExportArgs {
  data: DocumentDataSlices;
  applySignatureFields: (blob: Blob) => Promise<Blob>;
  /** ENC: enclosure rows + files - bound files merge into PDF exports
   * at their row-derived numbers. */
  enclosureRows?: EnclosureRow[];
  enclosureFiles?: ReadonlyMap<string, EnclosureAttachment>;
  attachmentCoverPages?: boolean;
  /** XFA: surfaces the Adobe-only note when the official form exports. */
  toast?: (opts: { title: string; description: string }) => void;
}

/**
 * Document export orchestration: the hard export gate, the SECNAV
 * page-cap check, format routing (PDF/DOCX/I-Type), and the download.
 */
export function useDocumentExport({ data, applySignatureFields, enclosureRows, enclosureFiles, attachmentCoverPages, toast }: UseDocumentExportArgs) {
  const { formData, vias, references, enclosures, copyTos, paragraphs, distList } = data;

  const generateDocument = async (format: 'docx' | 'pdf') => {
    // HARD EXPORT GATE (M-5216.5 Fig 7-3; audit line 69): window
    // envelope violations refuse export — a validator, not a warning.
    const blockers = getExportBlockers(formData, vias, references, paragraphs);
    if (blockers.length > 0) {
      alert(
        'Export blocked:\n\n' +
        blockers.map((b) => `- ${b.rule}\n  ${b.detail}\n  [${b.citation}]`).join('\n'),
      );
      return;
    }
    try {
      // Route I-Type documents through unified export
      if (formData.documentType === 'i-type') {
        await downloadDocument(formData.documentType, formData, format);
        return;
      }

      // P4.3 — SECNAV 5-page text cap, HARD BLOCK (SECNAV M-5215.1;
      // audit lines 85, 115). The PDF engine is the shared paginator:
      // its page count is the verdict for BOTH formats — DOCX is not
      // re-counted (divergence guard). The counted blob is reused for
      // PDF export so the gated artifact is the downloaded artifact.
      let secnavCountedBlob: Blob | null = null;
      if (formData.documentType === 'secnav-instruction' || formData.documentType === 'secnav-notice') {
        secnavCountedBlob = await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList });
        const { getPDFPageCount } = await import('@/lib/pdf-generator');
        const capIssue = secnavPageCapIssue(formData.documentType, await getPDFPageCount(secnavCountedBlob));
        if (capIssue) {
          alert(`Export blocked:\n\n- ${capIssue.rule}\n  ${capIssue.detail}\n  [${capIssue.citation}]`);
          return;
        }
      }

      // XFA (Stephen's 2026-07-17 ruling): unsigned FORMS export onto
      // the OFFICIAL NAVMC form - fillable in Adobe, not a flattened
      // redraw. Signature fields or bound enclosure files force the
      // flattened path: the dynamic-XFA renderer ignores drawn
      // annotations and appended pages, so they would silently vanish.
      if (
        format === 'pdf' &&
        (formData.documentType === 'aa-form' || formData.documentType === 'page11' || formData.documentType === 'navmc10922')
      ) {
        const signatureFields = (formData.signatureFields as unknown[] | undefined) ?? [];
        const hasBoundFiles = Boolean(enclosureRows?.some(r => r.fileId && enclosureFiles?.has(r.fileId)));
        // START (10922): the checkbox is unbindable in the XFA datasets,
        // so a START application routes to the flattened redraw where
        // the box CAN be checked (build plan Phase 5 routing).
        const startNeedsFlattened =
          formData.documentType === 'navmc10922' && formData.reason === 'start';
        if (signatureFields.length === 0 && !hasBoundFiles && !startNeedsFlattened) {
          const { exportOfficialForm } = await import('@/lib/xfa-form-fill');
          const formBlob = await exportOfficialForm({ formData, vias, references, enclosures, copyTos, paragraphs });
          const url = window.URL.createObjectURL(formBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = getExportFilename(formData, format);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          // The CUI line reports the FORM'S OWN artwork - the app adds
          // no markings (spec constraint 5; the blank carries
          // "CUI (when filled in)" / PRVCY in its template). START
          // applications never reach this branch - they route to the
          // flattened redraw above.
          const startNote =
            formData.documentType === 'navmc10922'
              ? ' The official form\'s own artwork marks it CUI (when filled in) - handle the filled file accordingly.'
              : '';
          toast?.({
            title: 'Official Form Exported',
            description:
              'This is the fillable NAVMC form - open it in Adobe Acrobat or Reader. Browsers show a placeholder page. Add signature fields to export a flattened print PDF instead.' +
              startNote,
          });
          return;
        }
      }

      // Route other document types through existing pipeline
      let blob: Blob;

      if (format === 'pdf') {
        blob = await applySignatureFields(
          secnavCountedBlob ?? await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList })
        );
      } else {
        const features = DOCUMENT_TYPES[formData.documentType]?.features;
        const paragraphsToRender = features?.isDirective
          ? mergeAdminSubsections(paragraphs, formData.adminSubsections)
          : paragraphs;

        const { generateDocxBlob } = await import('@/lib/docx-generator');
        blob = await generateDocxBlob(formData, vias, references, enclosures, copyTos, paragraphsToRender, distList);
      }

      // ENC: merge bound enclosure files into the export (PDF only; the
      // panel states DOCX exports exclude them). Numbers derive from
      // row position - computeMergeItems is the single source.
      if (format === 'pdf' && enclosureRows && enclosureFiles) {
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

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = getExportFilename(formData, format);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Error generating ${format.toUpperCase()}:`, error);
      alert(`Failed to generate ${format.toUpperCase()}. Please check the console for details.`);
    }
  };

  return { generateDocument };
}
