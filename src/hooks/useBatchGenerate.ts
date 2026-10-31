'use client';

import { useState, useCallback } from 'react';
import { FormData, ParagraphData } from '@/types';
import {
  MergeField,
  applyMergeRecord,
  generateCsvTemplate,
  mergedRowProblems,
  parseCsv,
  validateCsvColumns,
  CsvParseResult,
} from '@/lib/merge-utils';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { getExportFilename } from '@/lib/naval-format-utils';
import { clearedForExport } from '@/lib/export-gate';
import { getExportBlockers } from '@/lib/letter-validators';

export type BatchStatus = 'idle' | 'generating' | 'done' | 'error';

export interface BatchProgress {
  current: number;
  total: number;
  currentLabel: string;
  errors: { row: number; label: string; error: string }[];
}

export function useBatchGenerate() {
  const [status, setStatus] = useState<BatchStatus>('idle');
  const [progress, setProgress] = useState<BatchProgress>({ current: 0, total: 0, currentLabel: '', errors: [] });

  /**
   * Export a CSV template for the given merge fields.
   */
  const exportCsvTemplate = useCallback((mergeFields: MergeField[]) => {
    const csv = generateCsvTemplate(mergeFields);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'merge_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, []);

  /**
   * Import and parse a roster: a CSV, or an Excel .xlsx workbook.
   */
  const importCsv = useCallback(async (file: File): Promise<CsvParseResult> => {
    const name = file.name.toLowerCase();
    // An Excel workbook reads from its first sheet (src/lib/xlsx-reader.ts).
    if (name.endsWith('.xlsx')) {
      const { parseXlsx } = await import('@/lib/xlsx-reader');
      return parseXlsx(await file.arrayBuffer());
    }
    if (name.endsWith('.xls')) {
      return {
        headers: [], rows: [],
        errors: ['The older Excel format (.xls) is not read. In Excel, use File > Save As > Excel Workbook (.xlsx) or CSV UTF-8.'],
      };
    }
    const text = await file.text();
    return parseCsv(text);
  }, []);

  /**
   * Validate imported CSV against expected merge fields.
   */
  const validateImport = useCallback((
    csvHeaders: string[],
    mergeFields: MergeField[]
  ) => {
    return validateCsvColumns(csvHeaders, mergeFields);
  }, []);

  /**
   * Run the batch: for each row in the CSV, substitute merge fields,
   * generate a PDF, and bundle everything into a ZIP.
   */
  const runBatch = useCallback(async (
    templateFormData: FormData,
    templateParagraphs: ParagraphData[],
    vias: string[],
    references: string[],
    enclosures: string[],
    copyTos: string[],
    distList: string[],
    mergeFields: MergeField[],
    rows: Record<string, string>[],
  ): Promise<void> => {
    // M-5216.5 export gate, HARD BLOCK, over the TEMPLATE. `block`
    // severity is documented as "export must refuse", and the batch
    // path ran only the sensitive-data scan, so one unresolved
    // window-envelope violation shipped as a ZIP of a hundred copies
    // of it. The template carries the rules a merge row cannot change:
    // the window-envelope controls, the addressee counts and the
    // classification are all template state.
    const blockers = getExportBlockers(templateFormData, vias, references, templateParagraphs);
    if (blockers.length > 0) {
      setStatus('error');
      setProgress({
        current: 0,
        total: rows.length,
        currentLabel:
          `Export blocked by ${blockers.length} compliance rule${blockers.length === 1 ? '' : 's'}: `
          + blockers.map((b) => `${b.rule} (${b.citation})`).join(', ')
          + '. Clear them on the document, then run the batch again.',
        errors: [],
      });
      return;
    }

    // Pre-export sensitive-data check over the template AND every merge
    // row. Merge values (names, EDIPIs, case numbers) are exactly where
    // identifiers arrive in a batch, so the template alone is not enough.
    const cleared = await clearedForExport({
      formData: templateFormData,
      paragraphs: templateParagraphs,
      vias,
      references,
      enclosures,
      copyTos,
      distList,
      rows,
    });
    if (!cleared) {
      return;
    }

    setStatus('generating');
    setProgress({ current: 0, total: rows.length, currentLabel: 'Starting...', errors: [] });

    // jszip (and its pako inflater) load with the first batch run, not
    // with the page (B.4, HARDENING_PLAN_2026-09).
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const errors: { row: number; label: string; error: string }[] = [];
    // Two Marines can share a last name and a session date, which is the
    // whole of a counseling worksheet's file name, so every name in the
    // ZIP is made unique rather than letting one row overwrite another.
    const usedNames = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const record = rows[i];

      // Use the addressee or the Marine as a label for the filename
      const label = record['TO'] || record['NAME']
        || [record['LAST_NAME'], record['FIRST_NAME']].filter(Boolean).join(', ')
        || record['SIGNATURE'] || `row_${i + 1}`;
      const safeLabel = label.replace(/[^A-Za-z0-9_\- ]/g, '').replace(/\s+/g, '_').slice(0, 60);

      setProgress(prev => ({
        ...prev,
        current: i,
        currentLabel: `Generating: ${label} (${i + 1}/${rows.length})`,
      }));

      try {
        // Apply merge substitutions
        const { formData: mergedFormData, paragraphs: mergedParagraphs } = applyMergeRecord(
          templateFormData,
          templateParagraphs,
          record,
          mergeFields,
        );

        // A row whose merged document is unusable (a Page 11 without a
        // 10-digit DoD ID) is reported and skipped, never printed.
        const problems = mergedRowProblems(mergedFormData);
        if (problems.length > 0) {
          errors.push({ row: i + 1, label, error: problems.join('; ') });
          continue;
        }

        // Generate PDF via unified pipeline
        const blob = await generatePdfForDocType({
          formData: mergedFormData,
          vias,
          references,
          enclosures,
          copyTos,
          paragraphs: mergedParagraphs,
          distList,
        });

        // Determine filename
        const baseFilename = getExportFilename(mergedFormData, 'pdf').replace('.pdf', '');
        let filename = `${baseFilename}_${safeLabel}.pdf`;
        for (let n = 2; usedNames.has(filename); n++) filename = `${baseFilename}_${safeLabel}_${n}.pdf`;
        usedNames.add(filename);

        // Add to ZIP
        const arrayBuffer = await blob.arrayBuffer();
        zip.file(filename, arrayBuffer);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push({ row: i + 1, label, error: errorMsg });
      }
    }

    setProgress(prev => ({
      ...prev,
      current: rows.length,
      currentLabel: 'Creating ZIP archive...',
      errors,
    }));

    if (errors.length === rows.length) {
      setStatus('error');
      setProgress(prev => ({ ...prev, currentLabel: 'No documents generated: every row had errors.' }));
      return;
    }

    try {
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `batch_export_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setStatus('done');
      setProgress(prev => ({ ...prev, currentLabel: `Done! ${rows.length - errors.length} of ${rows.length} documents generated.` }));
    } catch (err) {
      setStatus('error');
      setProgress(prev => ({ ...prev, currentLabel: `ZIP creation failed: ${err}` }));
    }
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress({ current: 0, total: 0, currentLabel: '', errors: [] });
  }, []);

  return {
    status,
    progress,
    exportCsvTemplate,
    importCsv,
    validateImport,
    runBatch,
    reset,
  };
}
