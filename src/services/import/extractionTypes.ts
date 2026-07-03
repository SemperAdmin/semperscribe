import { ParagraphData } from '@/types';

/**
 * Shared types for the Word/PDF document import pipeline.
 *
 * documentTextExtractor produces ExtractedText, correspondenceParser turns it
 * into an ExtractionResult, and toImportPayload converts a (possibly
 * user-edited) result into the shape consumed by handleImport in
 * useImportExport.
 */

export type Confidence = 'high' | 'low';

export type SourceFormat = 'docx' | 'pdf' | 'text';

export interface ExtractedText {
  /** Normalized lines: trimmed, whitespace collapsed, blank runs collapsed. */
  lines: string[];
  sourceFormat: SourceFormat;
  warnings: string[];
}

export interface ExtractedField {
  value: string;
  /** 'low' values are flagged for user review in the import modal. */
  confidence: Confidence;
  /** 0-based indices into ExtractedText.lines the value was read from. */
  sourceLines: number[];
}

export type ExtractedFieldName =
  | 'ssic'
  | 'originatorCode'
  | 'date'
  | 'from'
  | 'to'
  | 'subj'
  | 'headerType'
  | 'line1'
  | 'line1b'
  | 'line2'
  | 'line3'
  | 'sig'
  | 'delegationText';

export type ExtractedFieldMap = Partial<Record<ExtractedFieldName, ExtractedField>>;

export interface ExtractionResult {
  documentType: string;
  fields: ExtractedFieldMap;
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  distList: string[];
  paragraphs: ParagraphData[];
  /** Non-blank source lines no rule claimed — shown so nothing is silently dropped. */
  unmatchedText: string[];
  warnings: string[];
}

export interface ImportPayload {
  formData: { documentType: string; [key: string]: unknown };
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  distList: string[];
  paragraphs: ParagraphData[];
}

/**
 * Converts an extraction result into the object shape accepted by
 * handleImport (useImportExport). Arrays are always present so that
 * importing replaces the pending document even when the source had none.
 */
export function toImportPayload(result: ExtractionResult): ImportPayload {
  const formData: ImportPayload['formData'] = { documentType: result.documentType };
  for (const [name, field] of Object.entries(result.fields)) {
    if (field) formData[name] = field.value;
  }
  return {
    formData,
    vias: [...result.vias],
    references: [...result.references],
    enclosures: [...result.enclosures],
    copyTos: [...result.copyTos],
    distList: [...result.distList],
    paragraphs: result.paragraphs.length > 0
      ? result.paragraphs.map(p => ({ ...p }))
      : [{ id: 1, level: 1, content: '' }],
  };
}
