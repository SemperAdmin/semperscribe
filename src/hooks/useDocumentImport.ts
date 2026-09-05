'use client';

import { useCallback, useState } from 'react';
import {
  ExtractedText,
  ExtractionResult,
  ImportPayload,
  toImportPayload,
} from '@/services/import/extractionTypes';
import { linesFromText, parseCorrespondence } from '@/services/import/correspondenceParser';
import { detectDocumentType, DocTypeDetection } from '@/services/import/docTypeDetector';
import { extractDocumentText, DocumentExtractionError } from '@/services/import/documentTextExtractor';
import { debugUserAction } from '@/lib/console-utils';

interface UseDocumentImportDeps {
  /** Applies the reviewed payload — reset current document, then import. */
  applyImport: (payload: ImportPayload) => void;
  toast: (opts: { title: string; description: string; variant?: 'default' | 'destructive' }) => void;
}

/**
 * Orchestrates the document import flow:
 * file → extract text (in-browser) → detect type → parse fields →
 * review modal → apply through the normal import path.
 *
 * R11 (D.7) adds pasted text as a second source. Extraction was already
 * separate from file reading, so the paste path skips the extractor and
 * joins the pipeline at the same detect-and-parse step, landing on the
 * same review-fields modal.
 */
export function useDocumentImport({ applyImport, toast }: UseDocumentImportDeps) {
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

  /**
   * The half of the pipeline both sources share: detect the type, parse
   * the fields, and open the review modal on the result. A file has been
   * through the extractor by this point. Pasted text arrives already in
   * this shape.
   */
  const review = useCallback((text: ExtractedText, label: string) => {
    const detected = detectDocumentType(text);
    const parsed = parseCorrespondence(text, detected.documentType);
    parsed.warnings = [...detected.warnings, ...parsed.warnings.filter(w => !detected.warnings.includes(w))];
    setExtractedText(text);
    setDetection(detected);
    setResult(parsed);
    setFileName(label);
    setIsOpen(true);
    debugUserAction('Document Import Extracted', { source: text.sourceFormat });
  }, []);

  /** R11: opens the review modal on its paste step, with no source yet. */
  const startPasteImport = useCallback(() => {
    setResult(null);
    setDetection(null);
    setExtractedText(null);
    setFileName('');
    setIsOpen(true);
  }, []);

  /**
   * R11: raw pasted text through the same parse as a file. Normalising
   * with linesFromText is what the .docx and .pdf extractors do to their
   * own output, so the parser sees one shape whatever the source was.
   */
  const importFromText = useCallback((raw: string) => {
    const lines = linesFromText(raw);
    if (lines.length === 0) {
      toast({
        title: 'Nothing to import',
        description: 'Paste the text of a letter, then read it.',
        variant: 'destructive',
      });
      return;
    }
    review({ lines, sourceFormat: 'text', warnings: [] }, 'pasted text');
  }, [review, toast]);

  const startImport = useCallback(async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);
    // Extraction lazy-loads mammoth/pdfjs and can take a few seconds on
    // large files — give immediate feedback before the modal can open.
    toast({ title: 'Reading document…', description: file.name });
    try {
      const data = await file.arrayBuffer();
      const text = await extractDocumentText(data, file.name);
      review(text, file.name);
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
  }, [toast, reset, review]);

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
    startPasteImport,
    importFromText,
    changeDocumentType,
    confirmImport,
    cancelImport: reset,
  };
}
