// @vitest-environment node
/**
 * The companion's four operations, called directly. No socket, no stdio.
 *
 * The sensitive-data pair is the important one: the headless surface has
 * no dialog to put in front of a Marine, so the refusal and the explicit
 * acknowledgement are the whole gate.
 */
import { describe, it, expect } from 'vitest';
import { createNLDPFile } from '@/lib/nldp-utils';
import type { FormData, ParagraphData } from '@/types';
import { CompanionError } from '../../companion/errors';
import {
  getDocumentSchema,
  listDocumentTypes,
  renderDocument,
  validateDocument,
} from '../../companion/handler';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_PARAGRAPHS,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
} from '../golden/fixture';

const PDF_MAGIC = '%PDF-';
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

async function fixturePackage(
  overrides: Partial<FormData> = {},
  paragraphs: ParagraphData[] = FIXTURE_PARAGRAPHS,
) {
  return createNLDPFile(
    { ...FIXTURE_FORM_DATA, ...overrides },
    FIXTURE_VIAS,
    FIXTURE_REFERENCES,
    FIXTURE_ENCLOSURES,
    FIXTURE_COPY_TOS,
    paragraphs,
  );
}

describe('listDocumentTypes', () => {
  it('reports every type the application defines', () => {
    const types = listDocumentTypes();
    expect(types.length).toBeGreaterThan(20);
    const ids = types.map((t) => t.id);
    expect(ids).toContain('basic');
    expect(ids).toContain('mco');
    expect(ids).toContain('amhs');
  });

  it('separates the formats the companion renders from the ones the app offers', () => {
    const types = listDocumentTypes();
    const basic = types.find((t) => t.id === 'basic');
    expect(basic?.companionFormats).toEqual(['pdf', 'docx']);
    // AMHS exports as message text, which is neither PDF nor DOCX.
    const amhs = types.find((t) => t.id === 'amhs');
    expect(amhs?.exportFormats).toEqual(['amhs-text']);
    expect(amhs?.companionFormats).toEqual([]);
  });
});

describe('getDocumentSchema', () => {
  it('describes the formData from the application zod schema', () => {
    const schema = getDocumentSchema('basic');
    expect(schema.id).toBe('basic');
    const properties = (schema.formData as { properties?: Record<string, unknown> }).properties;
    expect(properties).toBeDefined();
    expect(Object.keys(properties ?? {})).toContain('subj');
    expect(schema.fields.length).toBeGreaterThan(0);
    expect(schema.fields.some((f) => f.name === 'subj')).toBe(true);
  });

  it('describes the NLDP envelope the formData sits inside', () => {
    const envelope = getDocumentSchema('mco').envelope as {
      properties: { format: { const: string }; data: { properties: Record<string, unknown> } };
    };
    expect(envelope.properties.format.const).toBe('NLDP');
    expect(Object.keys(envelope.properties.data.properties)).toContain('paragraphs');
  });

  it('refuses an unknown type', () => {
    expect(() => getDocumentSchema('not-a-type')).toThrowError(CompanionError);
    try {
      getDocumentSchema('not-a-type');
    } catch (error) {
      expect((error as CompanionError).code).toBe('unknown_document_type');
      expect((error as CompanionError).status).toBe(400);
    }
  });
});

describe('validateDocument', () => {
  it('accepts a well-formed package and reports the rule findings as warnings', async () => {
    const result = await validateDocument(await fixturePackage());
    expect(result.ok).toBe(true);
    expect(result.documentType).toBe('basic');
    expect(result.errors).toEqual([]);
    expect(result.findings).toEqual([]);
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it('takes the package as JSON text as well as an object', async () => {
    const result = await validateDocument(JSON.stringify(await fixturePackage()));
    expect(result.ok).toBe(true);
  });

  it('rejects a package which is not NLDP', async () => {
    const result = await validateDocument({ format: 'SOMETHING', version: '9.9' });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('Invalid format');
  });

  it('rejects text which is not JSON', async () => {
    const result = await validateDocument('{ not json');
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('not valid JSON');
  });

  it('reports the sensitive-data findings without failing the document', async () => {
    const paragraphs: ParagraphData[] = [
      { id: 1, level: 1, content: 'The member SSN 123-45-6789 is recorded here.' },
    ];
    const result = await validateDocument(await fixturePackage({}, paragraphs));
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.ok).toBe(true);
  });
});

describe('renderDocument', () => {
  it('renders a PDF and names it the way the editor would', async () => {
    const result = await renderDocument({ document: await fixturePackage(), format: 'pdf' });
    expect(Buffer.from(result.bytes.subarray(0, 5)).toString('latin1')).toBe(PDF_MAGIC);
    expect(result.contentType).toBe('application/pdf');
    expect(result.filename).toMatch(/\.pdf$/);
    expect(result.documentType).toBe('basic');
    expect(result.findings).toEqual([]);
  });

  it('renders a DOCX', async () => {
    const result = await renderDocument({ document: await fixturePackage(), format: 'docx' });
    expect(Array.from(result.bytes.subarray(0, 4))).toEqual(ZIP_MAGIC);
    expect(result.filename).toMatch(/\.docx$/);
  });

  it('names the file by the EDMS convention when an EDMS context is given', async () => {
    const result = await renderDocument({
      document: await fixturePackage(),
      format: 'pdf',
      edms: { requestId: 'R-42', ruc: '12345', ssic: '1000', docType: 'basic' },
    });
    expect(result.filename).toMatch(/^SS_R-42_1000_\d{8}_basic_DRAFT\.pdf$/);
  });

  it('refuses a document with sensitive data and names the findings', async () => {
    const paragraphs: ParagraphData[] = [
      { id: 1, level: 1, content: 'The member SSN 123-45-6789 is recorded here.' },
    ];
    const document = await fixturePackage({}, paragraphs);
    await expect(renderDocument({ document, format: 'pdf' })).rejects.toThrowError(CompanionError);
    try {
      await renderDocument({ document, format: 'pdf' });
    } catch (error) {
      const companion = error as CompanionError;
      expect(companion.code).toBe('sensitive_data');
      expect(companion.status).toBe(422);
      expect(companion.details.findings).toEqual(['Possible SSN detected']);
    }
  });

  it('renders the same document once the caller acknowledges the findings', async () => {
    const paragraphs: ParagraphData[] = [
      { id: 1, level: 1, content: 'The member SSN 123-45-6789 is recorded here.' },
    ];
    const result = await renderDocument({
      document: await fixturePackage({}, paragraphs),
      format: 'pdf',
      acknowledgeSensitive: true,
    });
    expect(Buffer.from(result.bytes.subarray(0, 5)).toString('latin1')).toBe(PDF_MAGIC);
    expect(result.findings).toEqual(['Possible SSN detected']);
  });

  it('refuses a format the document type does not export', async () => {
    const document = await fixturePackage({ documentType: 'amhs' });
    try {
      await renderDocument({ document, format: 'pdf' });
      throw new Error('expected the render to be refused');
    } catch (error) {
      expect((error as CompanionError).code).toBe('format_not_supported');
      expect((error as CompanionError).status).toBe(422);
    }
  });

  it('refuses an unknown document type', async () => {
    const document = await fixturePackage({ documentType: 'not-a-type' });
    try {
      await renderDocument({ document, format: 'pdf' });
      throw new Error('expected the render to be refused');
    } catch (error) {
      expect((error as CompanionError).code).toBe('unknown_document_type');
    }
  });

  it('refuses a package which fails NLDP validation', async () => {
    try {
      await renderDocument({ document: { format: 'NOPE' }, format: 'pdf' });
      throw new Error('expected the render to be refused');
    } catch (error) {
      expect((error as CompanionError).code).toBe('validation_failed');
      expect((error as CompanionError).status).toBe(422);
    }
  });

  it('refuses a format it does not know at all', async () => {
    try {
      await renderDocument({
        document: await fixturePackage(),
        format: 'txt' as unknown as 'pdf',
      });
      throw new Error('expected the render to be refused');
    } catch (error) {
      expect((error as CompanionError).code).toBe('bad_request');
      expect((error as CompanionError).status).toBe(400);
    }
  });
});
