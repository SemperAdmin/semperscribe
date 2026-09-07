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
import http from 'node:http';
import net from 'node:net';
import { createNLDPFile } from '@/lib/nldp-utils';
import type { ParagraphData } from '@/types';
import {
  assertStartupSecurity,
  isLoopbackHost,
  startCompanionServer,
  type StartedCompanion,
} from '../../companion/server';
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

interface RawResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

/**
 * fetch rewrites the Host header to match the URL, so a request carrying
 * an arbitrary Host has to go through http.request.
 */
function rawGet(port: number, route: string, headers: http.OutgoingHttpHeaders): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: route, method: 'GET', headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    req.on('error', reject);
    req.end();
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

/**
 * AUDIT P2-3. Without a Host check, a DNS name an attacker controls can be
 * rebound to 127.0.0.1 and a page from that name becomes same-origin with
 * the companion. The Host header is the one thing the browser sends that
 * the rebinding cannot forge, so a request whose Host is not the loopback
 * address the companion sits on is refused before any route runs. The
 * Origin header, when a browser sends one, is checked the same way.
 */
describe('Host and Origin checks', () => {
  it('refuses a request whose Host is not loopback with 403 forbidden_host', async () => {
    const res = await rawGet(companion.port, '/health', { Host: 'evil.example.com' });
    expect(res.status).toBe(403);
    expect(JSON.parse(res.body).error).toBe('forbidden_host');
  });

  it('refuses a loopback Host carrying the wrong port', async () => {
    const res = await rawGet(companion.port, '/health', {
      Host: `127.0.0.1:${companion.port + 1}`,
    });
    expect(res.status).toBe(403);
    expect(JSON.parse(res.body).error).toBe('forbidden_host');
  });

  it('refuses a request with no Host at all', async () => {
    // http.request fills in a default Host, so this one goes over a raw socket.
    const status = await new Promise<number>((resolve, reject) => {
      const socket = net.connect(companion.port, '127.0.0.1', () => {
        socket.write('GET /health HTTP/1.0\r\n\r\n');
      });
      let text = '';
      socket.on('data', (c) => (text += c.toString()));
      socket.on('end', () => resolve(Number(/^HTTP\/1\.[01] (\d{3})/.exec(text)?.[1] ?? 0)));
      socket.on('error', reject);
    });
    expect(status).toBe(403);
  });

  it('accepts 127.0.0.1, localhost, and [::1] on the bound port', async () => {
    for (const host of ['127.0.0.1', 'localhost', 'LOCALHOST', '[::1]']) {
      const res = await rawGet(companion.port, '/health', { Host: `${host}:${companion.port}` });
      expect(res.status, host).toBe(200);
    }
  });

  it('refuses a non-loopback Origin with 403 forbidden_origin', async () => {
    const res = await fetch(`${origin}/health`, {
      headers: { Origin: 'https://evil.example.com' },
    });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('forbidden_origin');
  });

  it('refuses an opaque "null" Origin', async () => {
    const res = await fetch(`${origin}/health`, { headers: { Origin: 'null' } });
    expect(res.status).toBe(403);
  });

  it('accepts a loopback Origin on any port', async () => {
    for (const o of ['http://localhost:3000', 'http://127.0.0.1:7719', 'http://[::1]:5173']) {
      const res = await fetch(`${origin}/health`, { headers: { Origin: o } });
      expect(res.status, o).toBe(200);
    }
  });

  it('applies the Host check to every route, POST included', async () => {
    const res = await new Promise<RawResponse>((resolve, reject) => {
      const req = http.request(
        {
          host: '127.0.0.1',
          port: companion.port,
          path: '/validate',
          method: 'POST',
          headers: { Host: 'evil.example.com', 'Content-Type': 'application/json' },
        },
        (r) => {
          const chunks: Buffer[] = [];
          r.on('data', (c: Buffer) => chunks.push(c));
          r.on('end', () =>
            resolve({ status: r.statusCode ?? 0, headers: r.headers, body: Buffer.concat(chunks).toString() }),
          );
        },
      );
      req.on('error', reject);
      req.end(JSON.stringify({ document: { format: 'NOPE' } }));
    });
    expect(res.status).toBe(403);
  });
});

/**
 * AUDIT P2-4. COMPANION_TOKEN turns on a bearer credential for every
 * route except the liveness probe. A wider-than-loopback bind without
 * the token refuses to start, since that combination publishes an
 * unauthenticated renderer to the network.
 */
describe('bearer token', () => {
  let guarded: StartedCompanion;
  let guardedOrigin: string;
  const TOKEN = 'correct-horse-battery-staple';

  beforeAll(async () => {
    guarded = await startCompanionServer('127.0.0.1', 0, { token: TOKEN });
    guardedOrigin = `http://127.0.0.1:${guarded.port}`;
  });

  afterAll(async () => {
    await guarded.close();
  });

  it('leaves GET /health open', async () => {
    const res = await fetch(`${guardedOrigin}/health`);
    expect(res.status).toBe(200);
  });

  it('answers 401 unauthorized on every other route without the token', async () => {
    const res = await fetch(`${guardedOrigin}/document-types`);
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toMatch(/^Bearer/);
    expect((await res.json()).error).toBe('unauthorized');

    const post = await fetch(`${guardedOrigin}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document: { format: 'NOPE' } }),
    });
    expect(post.status).toBe(401);
  });

  it('answers 401 for the wrong token, a token of another length, and a non-Bearer scheme', async () => {
    for (const auth of [
      'Bearer wrong-horse-battery-staple',
      'Bearer short',
      `Basic ${Buffer.from(`x:${TOKEN}`).toString('base64')}`,
      TOKEN,
    ]) {
      const res = await fetch(`${guardedOrigin}/document-types`, {
        headers: { Authorization: auth },
      });
      expect(res.status, auth).toBe(401);
    }
  });

  it('serves the route with the right token', async () => {
    const res = await fetch(`${guardedOrigin}/document-types`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    expect(res.status).toBe(200);
  });

  it('the unguarded server carries no credential requirement', async () => {
    const res = await fetch(`${origin}/document-types`);
    expect(res.status).toBe(200);
  });
});

describe('startup guard', () => {
  it('knows the loopback addresses', () => {
    for (const h of ['127.0.0.1', '127.0.0.2', 'localhost', '::1', '[::1]', '::ffff:127.0.0.1']) {
      expect(isLoopbackHost(h), h).toBe(true);
    }
    for (const h of ['0.0.0.0', '::', '10.0.0.5', 'evil.example.com', '']) {
      expect(isLoopbackHost(h), h).toBe(false);
    }
  });

  it('refuses a non-loopback bind without a token', () => {
    expect(() => assertStartupSecurity('0.0.0.0', undefined)).toThrow(/COMPANION_TOKEN/);
    expect(() => assertStartupSecurity('10.0.0.5', '')).toThrow(/COMPANION_TOKEN/);
  });

  it('allows a loopback bind without a token and a non-loopback bind with one', () => {
    expect(() => assertStartupSecurity('127.0.0.1', undefined)).not.toThrow();
    expect(() => assertStartupSecurity('0.0.0.0', 'a-token')).not.toThrow();
  });

  it('startCompanionServer refuses a non-loopback bind without a token before listening', async () => {
    await expect(startCompanionServer('0.0.0.0', 0, { token: undefined })).rejects.toThrow(
      /COMPANION_TOKEN/,
    );
  });
});

/** AUDIT P2-9. DOCUMENT_TYPES is a plain object; a prototype name is not a type. */
describe('prototype names as document types', () => {
  it('answers 400 unknown_document_type for constructor and __proto__', async () => {
    for (const type of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const res = await fetch(`${origin}/document-types?type=${type}`);
      expect(res.status, type).toBe(400);
      expect((await res.json()).error, type).toBe('unknown_document_type');
    }
  });
});

/** AUDIT P2-10. The EDMS context reaches the filename, so it takes the handoff shapes. */
describe('POST /render edms validation', () => {
  it('answers 400 invalid_edms for a requestId carrying a path', async () => {
    const res = await postJson('/render', {
      document: await fixturePackage(),
      format: 'pdf',
      edms: { requestId: '../x', ruc: '12345', ssic: '1000', docType: 'basic' },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid_edms');
    expect(body.details.field).toBe('requestId');
  });

  it('answers 400 invalid_edms for a bad ruc, ssic, docType, section, or a non-object', async () => {
    const good = { ruc: '12345', ssic: '1000', docType: 'basic' };
    const cases: Array<[string, unknown]> = [
      ['ruc', { ...good, ruc: '../..' }],
      ['ssic', { ...good, ssic: 'abc' }],
      ['docType', { ...good, docType: 'Basic/../x' }],
      ['section', { ...good, section: 'S-1/../../etc' }],
      ['ruc', { ssic: '1000', docType: 'basic' }],
      ['edms', 'not an object'],
      ['edms', ['array']],
    ];
    for (const [field, edms] of cases) {
      const res = await postJson('/render', { document: await fixturePackage(), format: 'pdf', edms });
      expect(res.status, JSON.stringify(edms)).toBe(400);
      const body = await res.json();
      expect(body.error, JSON.stringify(edms)).toBe('invalid_edms');
      expect(body.details.field, JSON.stringify(edms)).toBe(field);
    }
  });

  it('still renders with a well-formed EDMS context and names the file by it', async () => {
    const res = await postJson('/render', {
      document: await fixturePackage(),
      format: 'pdf',
      edms: { requestId: '482', ruc: '12345', ssic: '1000', docType: 'basic', section: 'S-1' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toMatch(/SS_482_1000_\d{8}_basic_DRAFT\.pdf/);
  });
});
