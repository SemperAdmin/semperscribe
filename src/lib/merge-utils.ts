/**
 * Mail Merge Utilities
 *
 * Detects {{FIELD}} merge tokens in form data and paragraph content,
 * exports CSV templates, imports filled CSVs, and substitutes values.
 */

import { FormData, ParagraphData } from '@/types';

// ─── Merge Token Detection ─────────────────────────────────────────────────

/** Regex that matches {{FIELD_NAME}} tokens (case-insensitive contents). */
const MERGE_TOKEN_RE = /\{\{([A-Za-z0-9_ ]+?)\}\}/g;

/** Extract all unique merge field names from a single string. */
export function extractTokens(text: string): string[] {
  const tokens = new Set<string>();
  let match;
  while ((match = MERGE_TOKEN_RE.exec(text)) !== null) {
    tokens.add(match[1].trim().toUpperCase());
  }
  MERGE_TOKEN_RE.lastIndex = 0; // reset global regex
  return Array.from(tokens);
}

/** Well-known top-level form fields that can be used as merge columns. */
export const MERGEABLE_FORM_FIELDS: { key: string; label: string; description: string }[] = [
  { key: 'to', label: 'TO', description: 'Addressee (To line)' },
  { key: 'from', label: 'FROM', description: 'Originator (From line)' },
  { key: 'subj', label: 'SUBJECT', description: 'Subject line' },
  { key: 'date', label: 'DATE', description: 'Letter date (DD Mmm YY)' },
  { key: 'ssic', label: 'SSIC', description: 'Standard Subject ID Code' },
  { key: 'originatorCode', label: 'ORIGINATOR_CODE', description: 'Office code (e.g., G-1)' },
  { key: 'sig', label: 'SIGNATURE', description: 'Signature block name' },
  { key: 'sigTitle', label: 'SIG_TITLE', description: 'Signer title / rank' },
  { key: 'name', label: 'NAME', description: 'Service member name (Page 11)' },
  { key: 'edipi', label: 'EDIPI', description: 'DoD ID Number (Page 11)' },
  { key: 'title', label: 'TITLE', description: 'Document title (MCO, Bulletin, Papers)' },
  { key: 'purpose', label: 'PURPOSE', description: 'Purpose (Papers)' },
  { key: 'background', label: 'BACKGROUND', description: 'Background (Papers)' },
  { key: 'discussion', label: 'DISCUSSION', description: 'Discussion (Papers)' },
  { key: 'recommendation', label: 'RECOMMENDATION', description: 'Recommendation (Papers)' },
];

/**
 * Maps document types to their relevant merge fields.
 * This determines which fields are shown in the batch generate UI.
 */
export const DOCUMENT_TYPE_FIELDS: Record<string, string[]> = {
  // Standard Letters (to, from, subj, date, ssic, originatorCode, sig, sigTitle)
  'basic': ['to', 'from', 'subj', 'date', 'ssic', 'originatorCode', 'sig', 'sigTitle'],
  'multiple-address': ['from', 'subj', 'date', 'ssic', 'originatorCode', 'sig', 'sigTitle'],
  'endorsement': ['to', 'from', 'subj', 'date', 'ssic', 'originatorCode', 'sig', 'sigTitle'],
  'business-letter': ['to', 'from', 'subj', 'date', 'ssic', 'originatorCode', 'sig', 'sigTitle'],

  // Forms
  'aa-form': ['to', 'from', 'subj', 'date', 'sig'],
  'page11': ['name', 'edipi', 'date'],

  // Orders & Directives (title, date, sig)
  'mco': ['title', 'date', 'from', 'subj'],
  'bulletin': ['title', 'date', 'from', 'subj'],

  // Memos (to, from, date, subj)
  'mfr': ['from', 'subj', 'date'],
  'from-to-memo': ['to', 'from', 'subj', 'date'],
  'letterhead-memo': ['to', 'from', 'subj', 'date', 'sig', 'sigTitle'],
  'executive-correspondence': ['to', 'from', 'subj', 'date', 'sig', 'sigTitle'],

  // Special documents
  'coordination-page': ['title', 'from', 'date'],
  'moa': ['title', 'date', 'sig', 'sigTitle'],
  'mou': ['title', 'date', 'sig', 'sigTitle'],

  // Papers (title, purpose, background, discussion, recommendation)
  'position-paper': ['title', 'purpose', 'background', 'discussion', 'recommendation', 'date'],
  'information-paper': ['title', 'purpose', 'background', 'discussion', 'date'],
  'decision-paper': ['title', 'purpose', 'background', 'discussion', 'recommendation', 'date'],

  // AMHS
  'amhs': ['to', 'from', 'subj', 'date'],
};

/**
 * Get the mergeable fields relevant to a specific document type.
 * Falls back to standard letter fields if document type not found.
 */
export function getMergeableFieldsForDocType(documentType: string): typeof MERGEABLE_FORM_FIELDS {
  const relevantKeys = DOCUMENT_TYPE_FIELDS[documentType] || ['to', 'from', 'subj', 'date', 'sig', 'sigTitle'];
  return MERGEABLE_FORM_FIELDS.filter(f => relevantKeys.includes(f.key));
}

export interface MergeField {
  name: string;       // e.g. "RANK_NAME"
  source: 'form' | 'paragraph' | 'custom';
  formKey?: string;    // e.g. "to" — only for form-level fields
  description?: string;
}

/**
 * Scan the entire document (form data + paragraphs) and return all detected
 * merge fields — both from {{TOKEN}} patterns and selected form fields.
 */
export function detectMergeFields(
  formData: FormData,
  paragraphs: ParagraphData[],
  selectedFormFields: string[] = []
): MergeField[] {
  const fields: MergeField[] = [];
  const seen = new Set<string>();

  // 1. Add selected top-level form fields
  for (const key of selectedFormFields) {
    const def = MERGEABLE_FORM_FIELDS.find(f => f.key === key);
    if (def && !seen.has(def.label)) {
      seen.add(def.label);
      fields.push({ name: def.label, source: 'form', formKey: key, description: def.description });
    }
  }

  // 2. Scan all string values in formData for {{TOKEN}} patterns
  for (const [, value] of Object.entries(formData)) {
    if (typeof value === 'string') {
      for (const token of extractTokens(value)) {
        if (!seen.has(token)) {
          seen.add(token);
          fields.push({ name: token, source: 'form' });
        }
      }
    }
  }

  // 3. Scan all paragraph content
  for (const para of paragraphs) {
    if (para.content) {
      for (const token of extractTokens(para.content)) {
        if (!seen.has(token)) {
          seen.add(token);
          fields.push({ name: token, source: 'paragraph' });
        }
      }
    }
  }

  return fields;
}

// ─── CSV Template Export ────────────────────────────────────────────────────

/** Escape a value for CSV (wrap in quotes if it contains commas, quotes, or newlines). */
function csvEscape(val: string): string {
  if (/[",\n\r]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/**
 * Generate a CSV template string with column headers for the given merge fields.
 * Includes an example row showing expected format.
 */
export function generateCsvTemplate(fields: MergeField[]): string {
  if (fields.length === 0) return '';

  const headers = fields.map(f => csvEscape(f.name));
  const examples = fields.map(f => {
    // Provide sensible example values
    const name = f.name.toUpperCase();
    if (name === 'TO') return csvEscape('Commanding Officer, 1st Bn 5th Mar');
    if (name === 'FROM') return csvEscape('Commanding General, 1st Marine Division');
    if (name === 'SUBJECT') return csvEscape('EXAMPLE SUBJECT LINE IN ALL CAPS');
    if (name === 'DATE') return csvEscape('01 Mar 26');
    if (name === 'SIGNATURE') return csvEscape('I. M. MARINE');
    if (name === 'SIG_TITLE') return csvEscape('Colonel, U.S. Marine Corps');
    if (name === 'NAME') return csvEscape('DOE, JOHN M.');
    if (name === 'EDIPI') return csvEscape('1234567890');
    if (name.includes('RANK')) return csvEscape('Cpl');
    if (name.includes('UNIT')) return csvEscape('1st Bn 5th Mar');
    if (name.includes('DATE')) return csvEscape('01 Mar 26');
    return csvEscape('(enter value)');
  });

  return [headers.join(','), examples.join(','), ''].join('\n');
}

// ─── CSV Import & Parsing ──────────────────────────────────────────────────

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

/**
 * Parse a CSV string into rows of key-value records.
 * Handles quoted fields, commas within quotes, escaped quotes, and line
 * breaks within quotes. A Page 11 entry runs to several paragraphs, so a
 * quoted cell holding one is a single field, not several rows.
 */
export function parseCsv(csvText: string): CsvParseResult {
  const errors: string[] = [];
  const records = splitCsvRecords(csvText).filter(r => r.some(v => v.trim().length > 0));

  if (records.length < 2) {
    return { headers: [], rows: [], errors: ['CSV must have at least a header row and one data row.'] };
  }

  const headers = records[0].map(h => h.trim().toUpperCase());

  if (headers.length === 0) {
    return { headers: [], rows: [], errors: ['No column headers found in CSV.'] };
  }

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < records.length; i++) {
    const values = records[i];
    if (values.length !== headers.length) {
      errors.push(`Row ${i + 1}: expected ${headers.length} columns, got ${values.length}. Skipping.`);
      continue;
    }
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = values[j];
    }
    rows.push(record);
  }

  return { headers, rows, errors };
}

/**
 * Split CSV text into records of fields, respecting quoted fields. A
 * line break (LF or CRLF) ends a record only outside quotes; inside
 * quotes it is kept as LF.
 */
function splitCsvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else if (ch === '\r' && text[i + 1] === '\n') {
        // CRLF inside a quoted field: keep one LF.
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(current);
      current = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      record.push(current);
      records.push(record);
      record = [];
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.length > 0 || record.length > 0) {
    record.push(current);
    records.push(record);
  }
  return records;
}

/**
 * Validate that the imported CSV columns match the expected merge fields.
 * Returns list of missing columns (if any).
 */
export function validateCsvColumns(
  csvHeaders: string[],
  expectedFields: MergeField[]
): { valid: boolean; missing: string[]; extra: string[] } {
  const expected = new Set(expectedFields.map(f => f.name.toUpperCase()));
  const actual = new Set(csvHeaders.map(h => h.toUpperCase()));

  const missing = [...expected].filter(e => !actual.has(e));
  const extra = [...actual].filter(a => !expected.has(a));

  return { valid: missing.length === 0, missing, extra };
}

// ─── Substitution Engine ────────────────────────────────────────────────────

/** Replace all {{TOKEN}} occurrences in a string with values from the record. */
function substituteString(template: string, record: Record<string, string>): string {
  return template.replace(MERGE_TOKEN_RE, (match, token) => {
    const key = token.trim().toUpperCase();
    return record[key] ?? match; // leave unreplaced if not in record
  });
}

/**
 * Apply a merge record to form data — returns a new FormData with all
 * {{TOKEN}} patterns replaced and form-level fields overridden.
 */
export function applyMergeRecord(
  templateFormData: FormData,
  templateParagraphs: ParagraphData[],
  record: Record<string, string>,
  mergeFields: MergeField[]
): { formData: FormData; paragraphs: ParagraphData[] } {
  // Deep clone
  const formData: FormData = JSON.parse(JSON.stringify(templateFormData));
  const paragraphs: ParagraphData[] = JSON.parse(JSON.stringify(templateParagraphs));

  // 1. Override top-level form fields
  for (const field of mergeFields) {
    if (field.source === 'form' && field.formKey && record[field.name] !== undefined) {
      (formData as Record<string, unknown>)[field.formKey] = record[field.name];
    }
  }

  // 2. Substitute {{TOKEN}} in all string form fields
  for (const [key, value] of Object.entries(formData)) {
    if (typeof value === 'string') {
      (formData as Record<string, unknown>)[key] = substituteString(value, record);
    }
  }

  // 3. Substitute {{TOKEN}} in all paragraph content
  for (const para of paragraphs) {
    if (para.content) {
      para.content = substituteString(para.content, record);
    }
  }

  return { formData, paragraphs };
}
