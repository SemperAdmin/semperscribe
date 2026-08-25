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
 */
export function useDocumentImport({ applyImport, toast, currentDocumentType }: UseDocumentImportDeps) {
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
  }, [toast, reset, currentDocumentType]);

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
