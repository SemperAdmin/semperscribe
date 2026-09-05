// @vitest-environment node
/**
 * The HTTP surface, against a real listener on an ephemeral port.
 *
 * Every route is exercised over a socket rather than by calling the
 * handler, because the parts most likely to break are the ones the
 * handler never sees: the media-type check, the body cap, the status
 * codes, and the binary response headers an EDMS reads.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { createNLDPFile } from '@/lib/nldp-utils';
import type { ParagraphData } from '@/types';
import { startCompanionServer, type StartedCompanion } from '../../companion/server';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_PARAGRAPHS,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
} from '../golden/fixture';

let companion: StartedCompanion;
let origin: string;

async function fixturePackage(paragraphs: ParagraphData[] = FIXTURE_PARAGRAPHS) {
  return createNLDPFile(
    FIXTURE_FORM_DATA,
    FIXTURE_VIAS,
    FIXTURE_REFERENCES,
    FIXTURE_ENCLOSURES,
    FIXTURE_COPY_TOS,
    paragraphs,
  );
}

function postJson(route: string, body: unknown): Promise<Response> {
  return fetch(`${origin}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  companion = await startCompanionServer('127.0.0.1', 0);
  origin = `http://127.0.0.1:${companion.port}`;
});

afterAll(async () => {
  await companion.close();
});

afterEach(() => {
  delete process.env.COMPANION_MAX_BODY;
});

describe('GET /health', () => {
  it('reports the version and the document type count', async () => {
    const res = await fetch(`${origin}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.version).toBe('string');
    expect(body.documentTypes).toBeGreaterThan(20);
  });

  it('sends no CORS headers', async () => {
    const res = await fetch(`${origin}/health`);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('GET /document-types', () => {
  it('lists every type', async () => {
    const res = await fetch(`${origin}/document-types`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documentTypes.map((t: { id: string }) => t.id)).toContain('basic');
  });

  it('returns one type schema with ?type=', async () => {
    const res = await fetch(`${origin}/document-types?type=basic`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('basic');
    expect(body.formData.properties.subj).toBeDefined();
  });

  it('answers 400 for a type it does not know', async () => {
    const res = await fetch(`${origin}/document-types?type=nope`);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('unknown_document_type');
  });
});

describe('POST /validate', () => {
  it('validates a well-formed package', async () => {
    const res = await postJson('/validate', { document: await fixturePackage() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.documentType).toBe('basic');
  });

  it('reports a bad package as a 200 answer, not an error', async () => {
    const res = await postJson('/validate', { document: { format: 'NOPE' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.errors.length).toBeGreaterThan(0);
  });
});

describe('POST /render', () => {
  it('returns a PDF body with the export filename attached', async () => {
    const res = await postJson('/render', { document: await fixturePackage(), format: 'pdf' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    const disposition = res.headers.get('content-disposition') ?? '';
    expect(disposition).toContain('attachment;');
    expect(disposition).toContain('.pdf');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
  });

  it('returns a DOCX body', async () => {
    const res = await postJson('/render', { document: await fixturePackage(), format: 'docx' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('wordprocessingml');
    expect(res.headers.get('content-disposition')).toContain('.docx');
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('answers 422 when a paragraph carries an SSN and nobody acknowledged it', async () => {
    const paragraphs: ParagraphData[] = [
      { id: 1, level: 1, content: 'The member SSN 123-45-6789 is recorded here.' },
    ];
    const res = await postJson('/render', {
      document: await fixturePackage(paragraphs),
      format: 'pdf',
    });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('sensitive_data');
    expect(body.details.findings).toEqual(['Possible SSN detected']);
  });

  it('answers 400 for a format it does not render', async () => {
    const res = await postJson('/render', { document: await fixturePackage(), format: 'txt' });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('bad_request');
  });
});

describe('request handling', () => {
  it('answers 415 when the body is not JSON', async () => {
    const res = await fetch(`${origin}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello',
    });
    expect(res.status).toBe(415);
    expect((await res.json()).error).toBe('unsupported_media_type');
  });

  it('answers 400 when the JSON body does not parse', async () => {
    const res = await fetch(`${origin}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    });
    expect(res.status).toBe(400);
  });

  it('answers 413 when the body passes the cap', async () => {
    process.env.COMPANION_MAX_BODY = '2048';
    const res = await fetch(`${origin}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: 'x'.repeat(64 * 1024) }),
    });
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toBe('body_too_large');
    expect(body.details.cap).toBe(2048);
  });

  it('answers 404 for an unknown route and 405 for the wrong method', async () => {
    expect((await fetch(`${origin}/nothing-here`)).status).toBe(404);
    expect((await fetch(`${origin}/health`, { method: 'POST' })).status).toBe(405);
  });
});
