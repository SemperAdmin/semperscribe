/**
 * The companion's operations. Pure functions: document in, answer out.
 * Nothing here opens a socket, reads argv, or writes a file, so the HTTP
 * routes in server.ts and the MCP tools in mcp.ts are two thin skins over
 * the same four calls.
 *
 * Everything the app does before a download happens here in the same
 * order, because the point of the companion is to produce the file the
 * app would have produced:
 *
 *   1. NLDP structure and integrity (lib/nldp-utils).
 *   2. The letter validators (lib/letter-validators), reported but not
 *      enforced, exactly as the editor reports them.
 *   3. The sensitive-data gate (lib/export-gate). Findings REFUSE the
 *      render unless the caller acknowledges them, which is the headless
 *      form of the dialog the browser shows.
 *   4. The SECNAV five page cap, a hard block in the app and a hard
 *      block here.
 *   5. The same pipeline selection the editor's export uses, including
 *      the official NAVMC form fills and the I-Type route.
 */
import { z } from 'zod';
import { DOCUMENT_TYPES, type ExportFormat } from '@/lib/schemas';
import type { FormData, ParagraphData } from '@/types';
import type { NLDPData } from '@/lib/nldp-format';
import { importNLDPFile, validateNLDPFile } from '@/lib/nldp-utils';
import {
  runLetterValidators,
  secnavPageCapIssue,
  type ValidationIssue,
} from '@/lib/letter-validators';
import { exportFindings } from '@/lib/export-gate';
import { getExportFilename, mergeAdminSubsections } from '@/lib/naval-format-utils';
import { edmsBaseFilename, type EdmsContext } from '@/lib/edms-mode';
import { generatePdfForDocType } from '@/services/export/pdfPipelineService';
import { registerCompanionAssets } from './assets';
import { CompanionError } from './errors';

export const COMPANION_FORMATS = ['pdf', 'docx'] as const;
export type CompanionFormat = (typeof COMPANION_FORMATS)[number];

export const CONTENT_TYPES: Record<CompanionFormat, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

// --- Document types -------------------------------------------------

export interface DocumentTypeSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  /** Formats the app itself offers for the type, 'amhs-text' included. */
  exportFormats: ExportFormat[];
  /** Subset of exportFormats the companion renders. */
  companionFormats: CompanionFormat[];
  pdfPipeline: string;
  isDirective: boolean;
}

function summarise(id: string): DocumentTypeSummary {
  const def = DOCUMENT_TYPES[id];
  const features = def.features;
  return {
    id,
    name: def.name,
    description: def.description,
    category: features.category,
    exportFormats: features.exportFormats,
    companionFormats: COMPANION_FORMATS.filter((f) => features.exportFormats.includes(f)),
    pdfPipeline: features.pdfPipeline,
    isDirective: features.isDirective,
  };
}

/** Every document type the app knows, with the formats each supports. */
export function listDocumentTypes(): DocumentTypeSummary[] {
  return Object.keys(DOCUMENT_TYPES).map(summarise);
}

function requireDefinition(type: string, status: number) {
  const def = DOCUMENT_TYPES[type];
  if (!def) {
    throw new CompanionError(
      'unknown_document_type',
      status,
      `Unknown document type "${type}". Call list_document_types for the current list.`,
      { documentType: type },
    );
  }
  return def;
}

/**
 * The NLDP envelope, described once. Every type shares it; only the
 * `data.formData` object differs, and that half comes from the type's own
 * zod schema.
 */
const NLDP_ENVELOPE = {
  type: 'object',
  required: ['format', 'version', 'metadata', 'integrity', 'data'],
  properties: {
    format: { type: 'string', const: 'NLDP' },
    version: { type: 'string', enum: ['1.0', '1.1'] },
    metadata: {
      type: 'object',
      properties: {
        createdAt: { type: 'string', description: 'ISO 8601 timestamp' },
        formatVersion: { type: 'string' },
        createdBy: { type: 'string' },
        generator: { type: 'object' },
        author: { type: 'object' },
        package: { type: 'object' },
      },
    },
    integrity: {
      type: 'object',
      required: ['dataHash', 'crc32', 'recordCount'],
      description:
        'SHA-256 of JSON.stringify(data), CRC32 of the same text, and the ' +
        'count of paragraphs, references, enclosures, vias, and copy-tos. ' +
        'A mismatch is reported as a warning, never as a refusal.',
      properties: {
        dataHash: { type: 'string' },
        crc32: { type: 'string' },
        recordCount: { type: 'integer' },
      },
    },
    data: {
      type: 'object',
      required: ['formData', 'paragraphs', 'references', 'enclosures'],
      properties: {
        formData: {
          type: 'object',
          description: 'Per document type. See formData below.',
        },
        paragraphs: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'level', 'content'],
            properties: {
              id: { type: 'integer' },
              level: { type: 'integer', minimum: 1, maximum: 8 },
              content: { type: 'string' },
              title: { type: 'string' },
              isMandatory: { type: 'boolean' },
              designator: { type: 'string' },
            },
          },
        },
        references: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, order: { type: 'integer' } } } },
        enclosures: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, order: { type: 'integer' } } } },
        vias: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, order: { type: 'integer' } } } },
        copyTos: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, order: { type: 'integer' } } } },
        directiveMetadata: { type: 'object', properties: { status: { type: 'string' } } },
      },
    },
  },
} as const;

export interface DocumentSchemaField {
  name: string;
  label: string;
  control: string;
  section: string;
  required: boolean;
  description?: string;
  options?: string[];
}

export interface DocumentSchemaResult {
  id: string;
  name: string;
  description: string;
  exportFormats: ExportFormat[];
  companionFormats: CompanionFormat[];
  /** JSON Schema for data.formData, generated from the type's zod schema. */
  formData: Record<string, unknown>;
  /** The editor's own field list, which carries labels the schema has not. */
  fields: DocumentSchemaField[];
  /** The envelope the formData sits inside. */
  envelope: Record<string, unknown>;
}

/**
 * A JSON-schema-ish description of the NLDP a type accepts. The formData
 * half is generated from the zod schema in lib/schemas.ts, so it cannot
 * drift from what the app validates. `unrepresentable: 'any'` keeps the
 * hand-written superRefine validators (SSIC digits, date shapes) from
 * failing the conversion; those rules are reported by validate_document
 * instead.
 */
export function getDocumentSchema(type: string): DocumentSchemaResult {
  const def = requireDefinition(type, 400);
  const summary = summarise(type);
  const formData = z.toJSONSchema(def.schema, {
    io: 'input',
    unrepresentable: 'any',
  }) as Record<string, unknown>;

  const fields: DocumentSchemaField[] = [];
  for (const section of def.sections) {
    for (const field of section.fields) {
      fields.push({
        name: field.name,
        label: field.label,
        control: field.type,
        section: section.title,
        required: field.required === true,
        ...(field.description ? { description: field.description } : {}),
        ...(field.options ? { options: field.options.map((o) => o.value) } : {}),
      });
    }
  }

  return {
    id: type,
    name: def.name,
    description: def.description,
    exportFormats: summary.exportFormats,
    companionFormats: summary.companionFormats,
    formData,
    fields,
    envelope: NLDP_ENVELOPE as unknown as Record<string, unknown>,
  };
}

// --- Validation -----------------------------------------------------

/** The five arrays every pipeline takes, unpacked from an NLDP package. */
export interface DocumentSlices {
  formData: FormData;
  vias: string[];
  references: string[];
  enclosures: string[];
  copyTos: string[];
  paragraphs: ParagraphData[];
  distList: string[];
}

function textList(items: Array<{ text?: string }> | undefined): string[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => (typeof item?.text === 'string' ? item.text : ''));
}

function toSlices(data: NLDPData): DocumentSlices {
  const formData = (data.formData ?? {}) as unknown as FormData;
  const paragraphs: ParagraphData[] = (Array.isArray(data.paragraphs) ? data.paragraphs : []).map(
    (p) => ({
      id: p.id,
      level: p.level,
      content: p.content ?? '',
      ...(p.title !== undefined ? { title: p.title } : {}),
      ...(p.isMandatory !== undefined ? { isMandatory: p.isMandatory } : {}),
    }),
  );
  const rawDist = (formData as unknown as { distList?: unknown }).distList;
  return {
    formData,
    vias: textList(data.vias),
    references: textList(data.references),
    enclosures: textList(data.enclosures),
    copyTos: textList(data.copyTos),
    paragraphs,
    distList: Array.isArray(rawDist) ? (rawDist as string[]).map(String) : [],
  };
}

function issueText(issue: ValidationIssue): string {
  return `${issue.rule}: ${issue.detail} [${issue.citation}]`;
}

export interface ValidateResult {
  ok: boolean;
  documentType: string | null;
  /** Structural failures plus block-severity rule violations. */
  errors: string[];
  /** Integrity notes plus fail-severity and warn-severity violations. */
  warnings: string[];
  /** Sensitive-data hits from the export gate. Never a failure on its own. */
  findings: string[];
  /** The rule violations in full, for a caller which wants the citations. */
  issues: ValidationIssue[];
}

/** Turns whatever the caller sent into the NLDP JSON text and its object. */
function asJsonText(document: unknown): string {
  if (typeof document === 'string') return document;
  if (document === null || document === undefined) {
    throw new CompanionError('bad_request', 400, 'No document supplied');
  }
  if (typeof document !== 'object') {
    throw new CompanionError(
      'bad_request',
      400,
      'Document must be an NLDP object or the JSON text of one',
    );
  }
  return JSON.stringify(document);
}

/**
 * Structure, integrity, rules, and the sensitive-data scan, in one pass.
 * Never throws for a bad document: a bad document is an answer, not an
 * error. It throws only when the caller sent nothing usable at all.
 */
export async function validateDocument(document: unknown): Promise<ValidateResult> {
  const text = asJsonText(document);

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return {
      ok: false,
      documentType: null,
      errors: [`Document is not valid JSON: ${(error as Error).message}`],
      warnings: [],
      findings: [],
      issues: [],
    };
  }

  const structure = validateNLDPFile(parsed);
  if (!structure.isValid) {
    return {
      ok: false,
      documentType: null,
      errors: [...structure.errors],
      warnings: [...structure.warnings],
      findings: [],
      issues: [],
    };
  }

  const imported = await importNLDPFile(text);
  if (!imported.success || !imported.data) {
    return {
      ok: false,
      documentType: null,
      errors: [imported.error ?? 'Import failed'],
      warnings: imported.warnings ?? [],
      findings: [],
      issues: [],
    };
  }

  const slices = toSlices(imported.data);
  const documentType = typeof slices.formData.documentType === 'string'
    ? slices.formData.documentType
    : null;

  const errors: string[] = [];
  const warnings: string[] = [...(imported.warnings ?? [])];
  if (documentType === null) {
    errors.push('Missing formData.documentType');
  } else if (!DOCUMENT_TYPES[documentType]) {
    errors.push(`Unknown document type "${documentType}"`);
  }

  const issues = runLetterValidators(
    slices.formData,
    slices.vias,
    slices.references,
    slices.paragraphs,
  );
  for (const issue of issues) {
    if (issue.severity === 'block') errors.push(issueText(issue));
    else warnings.push(issueText(issue));
  }

  return {
    ok: errors.length === 0,
    documentType,
    errors,
    warnings,
    findings: exportFindings(slices),
    issues,
  };
}

// --- Rendering ------------------------------------------------------

export interface RenderRequest {
  document: unknown;
  format: CompanionFormat;
  /** EDMS context. Present means the file takes the EDMS name convention. */
  edms?: EdmsContext;
  /** Proceed even though the sensitive-data scan found something. */
  acknowledgeSensitive?: boolean;
}

export interface RenderResult {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
  documentType: string;
  /** What the scan found. Non-empty here means the caller acknowledged it. */
  findings: string[];
}

async function blobBytes(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * The official NAVMC blanks. The editor exports these onto the real
 * fillable form rather than a redraw whenever there is nothing to flatten
 * for, and the companion has no signature fields and no bound enclosure
 * files, so it always takes that branch. The one exception is a NAVMC
 * 10922 START application, whose checkbox has no binding in the XFA
 * datasets and which the editor routes to the flattened redraw.
 */
function usesOfficialBlank(formData: FormData): boolean {
  const type = formData.documentType;
  if (type !== 'aa-form' && type !== 'page11' && type !== 'navmc10922') return false;
  const signatureFields = (formData as unknown as { signatureFields?: unknown[] }).signatureFields;
  if (Array.isArray(signatureFields) && signatureFields.length > 0) return false;
  if (type === 'navmc10922' && (formData as unknown as { reason?: string }).reason === 'start') {
    return false;
  }
  return true;
}

async function renderPdf(slices: DocumentSlices): Promise<Uint8Array> {
  if (slices.formData.documentType === 'i-type') {
    const { exportDocument } = await import('@/services/export/index');
    const result = await exportDocument('i-type', slices.formData, 'pdf');
    return result instanceof Blob ? blobBytes(result) : new Uint8Array(result);
  }
  if (usesOfficialBlank(slices.formData)) {
    const { exportOfficialForm } = await import('@/lib/xfa-form-fill');
    return blobBytes(
      await exportOfficialForm({
        formData: slices.formData,
        vias: slices.vias,
        references: slices.references,
        enclosures: slices.enclosures,
        copyTos: slices.copyTos,
        paragraphs: slices.paragraphs,
      }),
    );
  }
  return blobBytes(
    await generatePdfForDocType({
      formData: slices.formData,
      vias: slices.vias,
      references: slices.references,
      enclosures: slices.enclosures,
      copyTos: slices.copyTos,
      paragraphs: slices.paragraphs,
      distList: slices.distList,
    }),
  );
}

async function renderDocx(slices: DocumentSlices): Promise<Uint8Array> {
  if (slices.formData.documentType === 'i-type') {
    const { exportDocument } = await import('@/services/export/index');
    const result = await exportDocument('i-type', slices.formData, 'docx');
    return result instanceof Blob ? blobBytes(result) : new Uint8Array(result);
  }
  const features = DOCUMENT_TYPES[slices.formData.documentType]?.features;
  const paragraphs = features?.isDirective
    ? mergeAdminSubsections(slices.paragraphs, slices.formData.adminSubsections)
    : slices.paragraphs;
  const { generateDocxBlob } = await import('@/lib/docx-generator');
  return blobBytes(
    await generateDocxBlob(
      slices.formData,
      slices.vias,
      slices.references,
      slices.enclosures,
      slices.copyTos,
      paragraphs,
      slices.distList,
    ),
  );
}

/**
 * The SECNAV five page cap is a hard block in the editor for both
 * formats, and the PDF paginator is the single arbiter for both, so a
 * DOCX render of a SECNAV directive pays for one PDF pass to be counted.
 */
async function enforceSecnavPageCap(
  slices: DocumentSlices,
  renderedPdf: Uint8Array | null,
): Promise<void> {
  const type = slices.formData.documentType;
  if (type !== 'secnav-instruction' && type !== 'secnav-notice') return;
  const bytes = renderedPdf ?? (await renderPdf(slices));
  const { getPDFPageCount } = await import('@/lib/pdf-generator');
  const pdf = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  const pageCount = await getPDFPageCount(pdf);
  const issue = secnavPageCapIssue(type, pageCount);
  if (issue) {
    throw new CompanionError('validation_failed', 422, issueText(issue), {
      errors: [issueText(issue)],
      pageCount,
    });
  }
}

/**
 * Renders one NLDP document. Refuses, rather than warns, in four cases:
 * the package does not parse or does not validate, the document type is
 * unknown, the type does not offer the requested format, and the
 * sensitive-data scan found something the caller has not acknowledged.
 */
export async function renderDocument(request: RenderRequest): Promise<RenderResult> {
  const format = request.format;
  if (format !== 'pdf' && format !== 'docx') {
    throw new CompanionError(
      'bad_request',
      400,
      `Format must be one of ${COMPANION_FORMATS.join(', ')}`,
      { format },
    );
  }

  const text = asJsonText(request.document);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new CompanionError('bad_request', 400, `Document is not valid JSON: ${(error as Error).message}`);
  }

  const structure = validateNLDPFile(parsed);
  if (!structure.isValid) {
    throw new CompanionError('validation_failed', 422, 'NLDP validation failed', {
      errors: structure.errors,
      warnings: structure.warnings,
    });
  }
  const imported = await importNLDPFile(text);
  if (!imported.success || !imported.data) {
    throw new CompanionError('validation_failed', 422, imported.error ?? 'Import failed', {
      errors: [imported.error ?? 'Import failed'],
      warnings: imported.warnings ?? [],
    });
  }

  const slices = toSlices(imported.data);
  const documentType = slices.formData.documentType;
  if (typeof documentType !== 'string' || documentType === '') {
    throw new CompanionError('validation_failed', 422, 'Missing formData.documentType', {
      errors: ['Missing formData.documentType'],
    });
  }
  const def = requireDefinition(documentType, 422);
  if (!def.features.exportFormats.includes(format)) {
    throw new CompanionError(
      'format_not_supported',
      422,
      `Document type "${documentType}" does not export ${format}. It offers ${def.features.exportFormats.join(', ')}.`,
      { documentType, format, exportFormats: def.features.exportFormats },
    );
  }

  const findings = exportFindings(slices);
  if (findings.length > 0 && request.acknowledgeSensitive !== true) {
    throw new CompanionError(
      'sensitive_data',
      422,
      'The document carries sensitive data. Review the findings and resend with acknowledgeSensitive set to true.',
      { findings },
    );
  }

  registerCompanionAssets();

  let bytes: Uint8Array;
  if (format === 'pdf') {
    bytes = await renderPdf(slices);
    await enforceSecnavPageCap(slices, bytes);
  } else {
    await enforceSecnavPageCap(slices, null);
    bytes = await renderDocx(slices);
  }

  const filename = request.edms
    ? `${edmsBaseFilename(request.edms, 'DRAFT')}.${format}`
    : getExportFilename(slices.formData, format);

  return {
    bytes,
    filename,
    contentType: CONTENT_TYPES[format],
    documentType,
    findings,
  };
}
