'use client';

import { useCallback, useState } from 'react';
import {
  ExtractedText,
  ExtractionResult,
  ImportPayload,
  toImportPayload,
} from '@/services/import/extractionTypes';
import { parseCorrespondence } from '@/services/import/correspondenceParser';
import { detectDocumentType, DocTypeDetection } from '@/services/import/docTypeDetector';
import { extractDocumentText, DocumentExtractionError } from '@/services/import/documentTextExtractor';
import { debugUserAction } from '@/lib/console-utils';
import { isNavmc10132Pdf, loadNavmc10132FromPdf } from '@/lib/navmc10132-pdf-load';

interface UseDocumentImportDeps {
  /** Applies the reviewed payload — reset current document, then import. */
  applyImport: (payload: ImportPayload) => void;
  toast: (opts: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
  /**
   * What the clerk currently has open, so the review modal can say what
   * confirming will DESTROY rather than only what it will create.
   *
   * Applying an import calls `resetDocumentState`, which builds a fresh
   * formData with no spread of the previous one. For a plain letter that is
   * a fair trade the user can see: the text in front of them replaces the
   * text behind them. For a NAVMC form it is not, because the structured
   * case behind them, offenses, punishments, suspensions, victims,
   * vacations and the stage, exists nowhere in the document being imported
   * and cannot be got back from it.
   */
  currentDocumentType?: string;
  /**
   * The open document, read only, so a loaded NAVMC 10132 can be compared
   * against it and disagreements flagged. See navmc10132-pdf-to-form.ts.
   */
  currentFormData?: Record<string, unknown>;
  /**
   * Applies a NAVMC 10132 read out of a PDF: merges the patch and records
   * the report. Separate from `applyImport`, which RESETS the document
   * first; this one must NOT, because the whole point is to carry the
   * open case forward with what the file adds.
   */
  applyNavmc10132?: (
    patch: Record<string, unknown>,
    report: unknown,
    /** The file's own bytes, kept as the base every later export writes into. */
    bytes: ArrayBuffer,
    fileName: string,
  ) => void;
}

/**
 * The NAVMC forms whose state cannot be reconstructed from imported text,
 * with the parts of the case that would be lost.
 *
 * KEYED BY THE DOCUMENT_TYPES REGISTRY ID, which is not the same as the form
 * number and does not follow one convention: NAVMC 10274 is `aa-form` and
 * NAVMC 118(11) is `page11`, while the other two are `navmc…`. A key that
 * does not exist in the registry produces NO warning rather than a wrong
 * one, which fails quiet, so a meta guard in the tests asserts every key
 * here is a real registry id.
 */
export const STRUCTURED_FORMS: Record<string, string> = {
  navmc10132:
    'Unit Punishment Book, including its offenses, punishments, suspensions, victims and any vacation records',
  navmc10922: 'Dependency Application (NAVMC 10922)',
  'aa-form': 'Administrative Action form (NAVMC 10274)',
  page11: 'Page 11 entry (NAVMC 118(11))',
};

function replacementWarning(currentDocumentType?: string): string | null {
  const described = currentDocumentType ? STRUCTURED_FORMS[currentDocumentType] : undefined;
  if (!described) return null;
  return (
    `Confirming will DISCARD the ${described} you have open. None of it is in the file ` +
    'being imported, so it cannot be recovered afterwards. Save it to the library first if ' +
    'you want to keep it.'
  );
}

/**
 * Orchestrates the Word/PDF document import flow:
 * file → extract text (in-browser) → detect type → parse fields →
 * review modal → apply through the normal import path.
 *
 * ONE MENU ITEM, TWO DESTINATIONS. A NAVMC 10132 PDF is recognized by its
 * AcroForm field names and routed to `loadNavmc10132FromPdf` BEFORE the text
 * extractor runs, because that extractor reads the page content stream and
 * can see none of a form's values. That path merges into the open document
 * rather than replacing it, which is the opposite of what `applyImport`
 * does and the reason it is a separate callback.
 */
export function useDocumentImport({
  applyImport,
  toast,
  currentDocumentType,
  currentFormData,
  applyNavmc10132,
}: UseDocumentImportDeps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [extractedText, setExtractedText] = useState<ExtractedText | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [detection, setDetection] = useState<DocTypeDetection | null>(null);

  const reset = useCallback(() => {
    setIsOpen(false);
    setResult(null);
    setDetection(null);
    setExtractedText(null);
    setFileName('');
  }, []);

  const startImport = useCallback(async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);
    // Extraction lazy-loads mammoth/pdfjs and can take a few seconds on
    // large files — give immediate feedback before the modal can open.
    toast({ title: 'Reading document…', description: file.name });
    try {
      const data = await file.arrayBuffer();
      // BEFORE THE TEXT EXTRACTOR RUNS, because a UPB has nothing the text
      // extractor can use and everything the AcroForm reader needs. Field
      // names are the form's identity: the text layer is the blank's
      // boilerplate whether the file is empty or fully filled.
      //
      // This is what lets one menu item serve both. Stephen asked whether
      // the existing import function could carry this, and it can: the app
      // decides by opening the file rather than making a clerk choose.
      if (applyNavmc10132 && (await isNavmc10132Pdf(data))) {
        const { patch, report } = await loadNavmc10132FromPdf(
          data,
          (currentFormData ?? {}) as never,
          file.name,
        );
        applyNavmc10132(patch, report, data, file.name);
        const conflictCount = report.conflicts.length;
        toast({
          title: 'Unit Punishment Book loaded',
          description:
            `${report.signedSignatures.length} signature(s) found, ${report.lockedFieldCount} ` +
            `fields closed. The form is now at ${String(report.stage)}. ` +
            (conflictCount > 0
              ? `${conflictCount} difference(s) flagged, see the panel above the form.`
              : 'No differences to flag.'),
        });
        debugUserAction('NAVMC 10132 Loaded', { stage: report.stage, conflicts: conflictCount });
        reset();
        return;
      }

      const text = await extractDocumentText(data, file.name);
      const detected = detectDocumentType(text);

      // REFUSED, AND NOTHING IS APPLIED. Detection can decide a file must
      // not be imported at all rather than imported badly, and today that
      // is exactly one class: a NAVMC form, whose field values this reader
      // cannot see and whose import would call resetDocumentState and
      // destroy whatever the clerk has open. Stopping here means the review
      // modal never opens, so the destructive confirm button is not
      // reachable. See the module comment in docTypeDetector.ts.
      if (detected.refuse) {
        toast({
          title: `Cannot import ${detected.refuse.label}`,
          description: detected.refuse.reason,
          variant: 'destructive',
        });
        debugUserAction('Document Import Refused', { label: detected.refuse.label });
        reset();
        return;
      }

      const parsed = parseCorrespondence(text, detected.documentType);
      parsed.warnings = [...detected.warnings, ...parsed.warnings.filter(w => !detected.warnings.includes(w))];

      // NAMED, NOT GENERIC. "This will replace your document" is true of
      // every import and reads as boilerplate. Naming the form makes the
      // cost specific, and it is only shown when the cost is real.
      const replacing = replacementWarning(currentDocumentType);
      if (replacing) parsed.warnings = [replacing, ...parsed.warnings];
      setExtractedText(text);
      setDetection(detected);
      setResult(parsed);
      setIsOpen(true);
      debugUserAction('Document Import Extracted', { source: text.sourceFormat });
    } catch (err) {
      const description =
        err instanceof DocumentExtractionError
          ? err.message
          : `Could not read "${file.name}". ${err instanceof Error ? err.message : ''}`.trim();
      toast({ title: 'Import failed', description, variant: 'destructive' });
      reset();
    } finally {
      setIsProcessing(false);
    }
  }, [toast, reset, currentDocumentType, currentFormData, applyNavmc10132]);

  /** User overrode the detected type in the modal — re-run the parse. */
  const changeDocumentType = useCallback((documentType: string) => {
    if (!extractedText) return;
    setResult(parseCorrespondence(extractedText, documentType));
  }, [extractedText]);

  const confirmImport = useCallback((edited: ExtractionResult) => {
    applyImport(toImportPayload(edited));
    reset();
    toast({
      title: 'Document imported',
      description: 'The extracted content replaced your document. Review it, then export when ready.',
    });
    debugUserAction('Document Import Applied', { documentType: edited.documentType });
  }, [applyImport, toast, reset]);

  return {
    isOpen,
    isProcessing,
    fileName,
    result,
    detection,
    startImport,
    changeDocumentType,
    confirmImport,
    cancelImport: reset,
  };
}
