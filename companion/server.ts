/**
 * The companion's HTTP surface.
 *
 * Bound to 127.0.0.1 by default and carrying no authentication, because
 * the only caller it is designed for is another process on the same
 * machine: an EDMS worker, a script, an agent runner. COMPANION_HOST
 * widens the bind, and widening it publishes an unauthenticated document
 * renderer to whatever the new address reaches. Put a reverse proxy with
 * authentication in front of it before doing that.
 *
 * Routes:
 *   GET  /health          liveness, version, and the document type count
 *   GET  /document-types  every type with the formats it exports
 *   POST /validate        {document}
 *   POST /render          {document, format, edms?, out?, acknowledgeSensitive?}
 *
 * No CORS headers are sent. A browser page from another origin has no
 * business calling this, and the absence of the headers is the control.
 */
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { version as APP_VERSION } from '../package.json';
import type { EdmsContext } from '@/lib/edms-mode';
import { CompanionError, errorPayload, errorStatus } from './errors';
import { maxBodyBytes, readBodyWithCap, renderTimeoutMs, withTimeout } from './limits';
import { outputDir, writeOutput } from './output';
import {
  getDocumentSchema,
  listDocumentTypes,
  renderDocument,
  validateDocument,
  type CompanionFormat,
} from './handler';

export const DEFAULT_PORT = 7719;
export const DEFAULT_HOST = '127.0.0.1';

export function companionPort(): number {
  const raw = process.env.COMPANION_PORT;
  if (raw === undefined || raw.trim() === '') return DEFAULT_PORT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65535) return DEFAULT_PORT;
  return parsed;
}

export function companionHost(): string {
  const raw = process.env.COMPANION_HOST;
  return raw !== undefined && raw.trim() !== '' ? raw.trim() : DEFAULT_HOST;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

function sendError(res: http.ServerResponse, error: unknown): void {
  sendJson(res, errorStatus(error), errorPayload(error));
}

/**
 * Content-Disposition for a naval filename, which routinely carries
 * spaces, parentheses, and hyphens. The quoted form covers every client,
 * and the RFC 5987 form carries the exact bytes for the ones which read
 * it.
 */
export function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const type = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') {
    throw new CompanionError(
      'unsupported_media_type',
      415,
      'Content-Type must be application/json',
      { received: type },
    );
  }
  const cap = maxBodyBytes();
  // Declared length first, so an oversized body is refused before a byte
  // of it is read. Chunked bodies declare nothing and fall to the counter
  // in readBodyWithCap.
  const declared = Number(req.headers['content-length'] ?? NaN);
  if (Number.isFinite(declared) && declared > cap) {
    throw new CompanionError('body_too_large', 413, `Request body exceeds the ${cap} byte cap`, {
      cap,
    });
  }
  const raw = await readBodyWithCap(req, cap);
  if (raw.byteLength === 0) {
    throw new CompanionError('bad_request', 400, 'Request body is empty');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString('utf8'));
  } catch (error) {
    throw new CompanionError('bad_request', 400, `Request body is not valid JSON: ${(error as Error).message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CompanionError('bad_request', 400, 'Request body must be a JSON object');
  }
  return parsed as Record<string, unknown>;
}

async function handleValidate(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const result = await withTimeout(
    validateDocument(body.document),
    renderTimeoutMs(),
    'Validation',
  );
  sendJson(res, 200, result);
}

async function handleRender(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const body = await readJsonBody(req);
  const format = body.format;
  if (format !== 'pdf' && format !== 'docx') {
    throw new CompanionError('bad_request', 400, 'format must be "pdf" or "docx"', { format });
  }
  const out = body.out;
  if (out !== undefined && typeof out !== 'string') {
    throw new CompanionError('bad_request', 400, 'out must be a string path');
  }

  const result = await withTimeout(
    renderDocument({
      document: body.document,
      format: format as CompanionFormat,
      edms: body.edms as EdmsContext | undefined,
      acknowledgeSensitive: body.acknowledgeSensitive === true,
    }),
    renderTimeoutMs(),
    'Render',
  );

  if (typeof out === 'string') {
    const written = await writeOutput(out, result.bytes);
    sendJson(res, 200, {
      path: written,
      filename: result.filename,
      contentType: result.contentType,
      documentType: result.documentType,
      bytes: result.bytes.byteLength,
      findings: result.findings,
    });
    return;
  }

  res.writeHead(200, {
    'Content-Type': result.contentType,
    'Content-Length': result.bytes.byteLength,
    'Content-Disposition': contentDisposition(result.filename),
    'Cache-Control': 'no-store',
  });
  res.end(Buffer.from(result.bytes));
}

async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://companion.invalid');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method ?? 'GET';

  if (pathname === '/health') {
    if (method !== 'GET') throw new CompanionError('method_not_allowed', 405, 'Use GET /health');
    sendJson(res, 200, {
      ok: true,
      version: APP_VERSION,
      documentTypes: listDocumentTypes().length,
    });
    return;
  }

  if (pathname === '/document-types') {
    if (method !== 'GET') {
      throw new CompanionError('method_not_allowed', 405, 'Use GET /document-types');
    }
    const type = url.searchParams.get('type');
    if (type !== null) {
      sendJson(res, 200, getDocumentSchema(type));
      return;
    }
    sendJson(res, 200, { documentTypes: listDocumentTypes() });
    return;
  }

  if (pathname === '/validate') {
    if (method !== 'POST') throw new CompanionError('method_not_allowed', 405, 'Use POST /validate');
    await handleValidate(req, res);
    return;
  }

  if (pathname === '/render') {
    if (method !== 'POST') throw new CompanionError('method_not_allowed', 405, 'Use POST /render');
    await handleRender(req, res);
    return;
  }

  throw new CompanionError('not_found', 404, `No route for ${method} ${pathname}`);
}

/** The server, unstarted. Tests listen on port 0; the script listens on 7719. */
export function createCompanionServer(): http.Server {
  return http.createServer((req, res) => {
    route(req, res).catch((error) => {
      // Drain whatever is still arriving. A body refused part way through
      // leaves the socket full, and a client which cannot finish its send
      // never gets to read the status explaining why.
      if (!req.readableEnded) req.resume();
      if (res.headersSent) {
        res.destroy();
        return;
      }
      sendError(res, error);
    });
  });
}

export interface StartedCompanion {
  server: http.Server;
  host: string;
  port: number;
  close: () => Promise<void>;
}

export function startCompanionServer(
  host: string = companionHost(),
  port: number = companionPort(),
): Promise<StartedCompanion> {
  const server = createCompanionServer();
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      const address = server.address() as AddressInfo;
      resolve({
        server,
        host,
        port: address.port,
        close: () =>
          new Promise<void>((done, fail) => {
            server.close((err) => (err ? fail(err) : done()));
          }),
      });
    });
  });
}

// Started only when this file is the process entry point, so importing it
// from a test never opens a socket. process.argv is used rather than
// require.main because this file runs as CommonJS under tsx and as an ES
// module under vitest.
const entry = process.argv[1] ?? '';
if (/companion[\\/]server\.ts$/.test(entry)) {
  void startCompanionServer().then((started) => {
    const out = outputDir();
    process.stdout.write(
      `SemperScribe companion ${APP_VERSION} listening on http://${started.host}:${started.port}\n` +
        `  document types: ${listDocumentTypes().length}\n` +
        `  output directory: ${out ?? 'off (set COMPANION_OUT_DIR to turn it on)'}\n` +
        `  body cap: ${maxBodyBytes()} bytes, render timeout: ${renderTimeoutMs()} ms\n`,
    );
    if (started.host !== DEFAULT_HOST) {
      process.stderr.write(
        `WARNING: bound to ${started.host}, not loopback. The companion has no ` +
          'authentication and will render documents for anyone who reaches this address.\n',
      );
    }
  }).catch((error) => {
    process.stderr.write(`Companion failed to start: ${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
