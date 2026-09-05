'use client';

import { DOCUMENT_TYPES } from '@/lib/schemas';
import { getExportBlockers, secnavPageCapIssue } from '@/lib/letter-validators';
import type { ValidationIssue } from '@/lib/letter-validators';
import { getExportFilename, mergeAdminSubsections } from '@/lib/naval-format-utils';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { downloadDocument } from '@/services/export/index';
import type { DocumentDataSlices, SamePageHostResolver } from './useLivePreview';
import { isSamePageEndorsement } from '@/lib/same-page-endorsement';
import type { EnclosureAttachment, EnclosureRow } from '@/lib/enclosure-rows';
import { getClassification, bannerText } from '@/lib/classification';
import { getEdmsContext, edmsBaseFilename } from '@/lib/edms-mode';
import { clearedForExport } from '@/lib/export-gate';

interface UseDocumentExportArgs {
  data: DocumentDataSlices;
  applySignatureFields: (blob: Blob) => Promise<Blob>;
  /** ENC: enclosure rows + files - bound files merge into PDF exports
   * at their row-derived numbers. */
  enclosureRows?: EnclosureRow[];
  enclosureFiles?: ReadonlyMap<string, EnclosureAttachment>;
  attachmentCoverPages?: boolean;
  /** E.3: the letter a same-page endorsement is added to, when attached. */
  resolveSamePageHost?: SamePageHostResolver;
  /** XFA: surfaces the Adobe-only note when the official form exports. */
  toast?: (opts: { title: string; description: string }) => void;
  /**
   * Called with the block-severity issues when the export gate refuses.
   * page.tsx opens the compliance dialog on it. The hook stays free of
   * UI: it reports the refusal and the owner of the dialog shows it.
   * With no callback wired the refusal still holds, and the toast, when
   * one is supplied, carries the reason.
   */
  onBlocked?: (issues: ValidationIssue[]) => void;
}

/**
 * Document export orchestration: the hard export gate, the SECNAV
 * page-cap check, format routing (PDF/DOCX/I-Type), and the download.
 */
export function useDocumentExport({ data, applySignatureFields, enclosureRows, enclosureFiles, attachmentCoverPages, resolveSamePageHost, toast, onBlocked }: UseDocumentExportArgs) {
  const { formData, vias, references, enclosures, copyTos, paragraphs, distList } = data;

  /**
   * Single delivery point. Both the XFA official-form branch and the main
   * pipeline end here, so the M-5216.5 export gate and the SECNAV page cap
   * above cannot be routed around by adding a second download.
   *
   * In EDMS mode the file is named by the EDMS convention rather than the
   * app's own. The Power App's upload guardrail keys on the SS_<rid>_
   * prefix to warn when a letter is attached to the wrong request.
   */
  const deliver = (blob: Blob, format: 'docx' | 'pdf') => {
    const ctx = getEdmsContext();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = ctx
      ? edmsBaseFilename(ctx, 'DRAFT') + '.' + format
      : getExportFilename(formData, format);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const generateDocument = async (format: 'docx' | 'pdf') => {
    try {
      // M-5216.5 export gate, HARD BLOCK. `block` severity is
      // documented as "export must refuse", and until now the only
      // caller was the signature ceremony: the ordinary PDF and DOCX
      // downloads ran the sensitive-data scan and nothing else, so a
      // window-envelope violation exported without complaint. Sits
      // above every branch below, the same place the scan sits, so no
      // download path routes around it.
      const blockers = getExportBlockers(formData, vias, references, paragraphs);
      if (blockers.length > 0) {
        onBlocked?.(blockers);
        toast?.({
          title: 'Export blocked',
          description:
            `${blockers.length} rule${blockers.length === 1 ? '' : 's'} must be cleared first. `
            + 'The Compliance Issues dialog lists them.',
        });
        return;
      }

      // Pre-export sensitive-data check. Sits above every branch below
      // (I-Type, SECNAV cap, official XFA form, standard pipeline) so no
      // download path skips it. A hit prompts, it does not block.
      const cleared = await clearedForExport({ formData, vias, references, enclosures, copyTos, paragraphs, distList });
      if (!cleared) {
        return;
      }

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
          // Was a native alert(): unstyled, uncopyable, naming no field
          // and offering no way back to the document (UX audit finding
          // 8). It routes through the compliance dialog now, the same
          // surface every other blocking rule reports to.
          onBlocked?.([capIssue]);
          toast?.({
            title: 'Export blocked',
            description: `${capIssue.rule}. ${capIssue.detail}`,
          });
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
          deliver(formBlob, format);
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
        // E.3 (M-5216.5 9-1): a same-page endorsement with the letter
        // attached exports as that letter with the endorsement placed,
        // the same render the preview showed.
        const hostBytes = isSamePageEndorsement(formData) && resolveSamePageHost ? await resolveSamePageHost() : null;
        if (hostBytes) {
          const { renderSamePageWithHost, describePlacement } = await import('@/lib/same-page-host');
          const endorsed = await renderSamePageWithHost(
            { formData, vias, references, enclosures, copyTos, paragraphs, distList },
            generatePdfForDocType,
            hostBytes,
          );
          blob = new Blob([new Uint8Array(endorsed.bytes)], { type: 'application/pdf' });
          toast?.({
            title: endorsed.placement.status === 'fits' ? 'Same-page endorsement placed' : 'Exported as a new-page endorsement',
            description: describePlacement(endorsed.placement),
          });
        } else {
          blob = await applySignatureFields(
            secnavCountedBlob ?? await generatePdfForDocType({ formData, vias, references, enclosures, copyTos, paragraphs, distList })
          );
        }
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

      deliver(blob, format);

      // NAVMC 10132 needs no branch of its own above. It is a plain
      // AcroForm, so PIPELINE_MAP.navmc10132 already returns the OFFICIAL
      // blank filled and still editable - unlike the XFA forms, where the
      // pipeline returns a flattened redraw and the official form has to be
      // fetched on a separate path. Routing it through the standard path
      // keeps the signature-field pass and the enclosure merge, both of
      // which are safe on an AcroForm. Only the note differs.
      if (format === 'pdf' && formData.documentType === 'navmc10132') {
        toast?.({
          title: 'Official Form Exported',
          description:
            'This is the official NAVMC 10132, filled and still editable in Adobe Acrobat or Reader. '
            + 'The seven signature blocks are left open so items 9 and 16 take a CAC signature. '
            + "Adobe's usage-rights signature was removed - it goes void the moment the file changes, "
            + 'and an invalid signature reads as tampering. Filling and signing are unaffected.',
        });
      }
    } catch (error) {
      console.error(`Error generating ${format.toUpperCase()}:`, error);
      toast?.({
        title: `${format.toUpperCase()} export failed`,
        description: 'The document did not render. The browser console carries the detail.',
      });
    }
  };

  return { generateDocument };
}
