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
}

/**
 * Orchestrates the Word/PDF document import flow:
 * file → extract text (in-browser) → detect type → parse fields →
 * review modal → apply through the normal import path.
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

  const startImport = useCallback(async (file: File) => {
    setIsProcessing(true);
    setFileName(file.name);
    try {
      const data = await file.arrayBuffer();
      const text = await extractDocumentText(data, file.name);
      const detected = detectDocumentType(text);
      const parsed = parseCorrespondence(text, detected.documentType);
      parsed.warnings = [...detected.warnings, ...parsed.warnings.filter(w => !detected.warnings.includes(w))];
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
  }, [toast, reset]);

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
