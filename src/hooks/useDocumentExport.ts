'use client';

import { DOCUMENT_TYPES } from '@/lib/schemas';
import { getExportBlockers, secnavPageCapIssue } from '@/lib/letter-validators';
import { getExportFilename, mergeAdminSubsections } from '@/lib/naval-format-utils';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { downloadDocument } from '@/services/export/index';
import type { DocumentDataSlices } from './useLivePreview';

interface UseDocumentExportArgs {
  data: DocumentDataSlices;
  applySignatureFields: (blob: Blob) => Promise<Blob>;
}

/**
 * Document export orchestration: the hard export gate, the SECNAV
 * page-cap check, format routing (PDF/DOCX/I-Type), and the download.
 */
export function useDocumentExport({ data, applySignatureFields }: UseDocumentExportArgs) {
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
