/**
 * The companion's HTTP surface.
 *
 * Bound to 127.0.0.1 by default, because the only caller it is designed
 * for is another process on the same machine: an EDMS worker, a script,
 * an agent runner. Three controls sit in front of every route:
 *
 *   Host check (AUDIT P2-3). A request whose Host header is not the
 *   loopback address on the bound port is refused with 403. DNS
 *   rebinding points an attacker's name at 127.0.0.1 and makes a page
 *   from that name same-origin with the companion; the Host header is the
 *   one thing the rebinding cannot forge. A request carrying an Origin
 *   header is held to the same rule.
 *
 *   Bearer token (AUDIT P2-4). COMPANION_TOKEN, when set, is required as
 *   `Authorization: Bearer <token>` on every route except GET /health.
 *   COMPANION_HOST wider than loopback without a token refuses to start:
 *   that combination publishes an unauthenticated document renderer to
 *   whatever the address reaches.
 *
 *   No CORS headers. A browser page from another origin has no business
 *   calling this, and the absence of the headers is the control.
 *
 * Routes:
 *   GET  /health          liveness, version, and the document type count
 *   GET  /document-types  every type with the formats it exports
 *   POST /validate        {document}
 *   POST /render          {document, format, edms?, out?, acknowledgeSensitive?}
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { version as APP_VERSION } from '../package.json';
import { PATTERNS as EDMS_PATTERNS } from '@/lib/edms-handoff';
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

/** COMPANION_TOKEN, or undefined when no credential is configured. */
export function companionToken(): string | undefined {
  const raw = process.env.COMPANION_TOKEN;
  return raw !== undefined && raw.trim() !== '' ? raw.trim() : undefined;
}

/** Strips one pair of IPv6 brackets: "[::1]" -> "::1". */
function unbracket(host: string): string {
  return host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
}

/** The loopback names a Host or Origin may carry: 127/8, ::1, localhost. */
export function isLoopbackHost(host: string): boolean {
  const name = unbracket(host.trim()).toLowerCase();
  if (name === 'localhost' || name === '::1' || name === '::ffff:127.0.0.1') return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(name);
}

/** A bind address which listens on every interface. */
function isWildcardHost(host: string): boolean {
  const name = unbracket(host.trim());
  return name === '0.0.0.0' || name === '::';
}

/**
 * Refuses the one configuration which publishes an unauthenticated
 * renderer: a bind wider than loopback with no token. Runs before the
 * socket opens.
 */
export function assertStartupSecurity(host: string, token: string | undefined): void {
  if (isLoopbackHost(host)) return;
  if (token !== undefined && token !== '') return;
  throw new Error(
    `COMPANION_HOST is ${host}, which is not a loopback address, and COMPANION_TOKEN is not set. ` +
      'Binding wider than loopback publishes the companion to the network, so a bearer token is ' +
      'required. Set COMPANION_TOKEN, or leave COMPANION_HOST unset to bind 127.0.0.1.',
  );
}

/** Splits "host:port" / "[v6]:port" / "host" into its parts. Port is null when absent. */
function splitHostPort(value: string): { host: string; port: number | null } | null {
  const text = value.trim();
  if (text === '') return null;
  const match = /^(\[[^\]]+\]|[^:]+)(?::(\d{1,5}))?$/.exec(text);
  if (!match) return null;
  const port = match[2] === undefined ? null : Number(match[2]);
  if (port !== null && (port < 1 || port > 65535)) return null;
  return { host: match[1], port };
}

/** Options for one server instance. Both default to the environment. */
export interface CompanionServerOptions {
  /** Bearer token required on every route except GET /health. */
  token?: string;
  /** The configured bind address; a non-loopback one is also an accepted Host. */
  host?: string;
}

/**
 * The Host check. Allowed: a loopback name on the bound port; the
 * configured bind address itself, on the bound port, when it is not
 * loopback; and, for a wildcard bind (which is only reachable with a
 * token), any host on the bound port, since the address a client used
 * is not knowable from a 0.0.0.0 listener.
 */
function assertAllowedHost(req: http.IncomingMessage, configuredHost: string): void {
  const raw = req.headers.host;
  const parts = typeof raw === 'string' ? splitHostPort(raw) : null;
  if (!parts) {
    throw new CompanionError('forbidden_host', 403, 'Request carries no usable Host header');
  }
  const boundPort = req.socket.localPort ?? -1;
  // A Host with no port names port 80, which is never this listener
  // unless it was bound there.
  const requestPort = parts.port ?? 80;
  if (requestPort !== boundPort) {
    throw new CompanionError('forbidden_host', 403, 'Host header does not name this listener', {
      host: parts.host,
    });
  }
  if (isLoopbackHost(parts.host)) return;
  if (isWildcardHost(configuredHost)) return;
  if (!isLoopbackHost(configuredHost) && unbracket(parts.host).toLowerCase() === unbracket(configuredHost).toLowerCase()) {
    return;
  }
  throw new CompanionError('forbidden_host', 403, 'Host header does not name this listener', {
    host: parts.host,
  });
}

/**
 * The Origin check. A browser sends Origin on cross-origin and on every
 * non-GET request; a page which is not on loopback (or on the configured
 * non-loopback address) is refused whatever the Host said.
 */
function assertAllowedOrigin(req: http.IncomingMessage, configuredHost: string): void {
  const raw = req.headers.origin;
  if (raw === undefined) return;
  let host: string | null = null;
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') host = url.hostname;
  } catch {
    host = null;
  }
  if (host !== null) {
    if (isLoopbackHost(host)) return;
    if (!isLoopbackHost(configuredHost) && !isWildcardHost(configuredHost) &&
      unbracket(host).toLowerCase() === unbracket(configuredHost).toLowerCase()) {
      return;
    }
  }
  throw new CompanionError('forbidden_origin', 403, 'Origin is not a loopback origin', {
    origin: raw,
  });
}

/** Constant-time equality over the two SHA-256 digests, so length leaks nothing either. */
function tokensMatch(presented: string, expected: string): boolean {
  const a = createHash('sha256').update(presented).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function assertAuthorized(req: http.IncomingMessage, token: string | undefined): void {
  if (token === undefined) return;
  const header = req.headers.authorization;
  const match = typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header.trim()) : null;
  if (match && tokensMatch(match[1], token)) return;
  throw new CompanionError('unauthorized', 401, 'A valid Authorization: Bearer token is required');
}

/**
 * Validates the optional EDMS context against the handoff shapes
 * (AUDIT P2-10). The context reaches the returned filename, so a
 * requestId carrying a path separator is refused here rather than
 * discovered in a Content-Disposition.
 */
export function edmsContextFromInput(input: unknown): EdmsContext | undefined {
  if (input === undefined || input === null) return undefined;
  const fail = (field: string, why: string): never => {
    throw new CompanionError('invalid_edms', 400, `edms.${field} ${why}`, { field });
  };
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new CompanionError('invalid_edms', 400, 'edms must be an object', { field: 'edms' });
  }
  const record = input as Record<string, unknown>;
  const required = (field: 'ruc' | 'ssic' | 'docType'): string => {
    const value = record[field];
    if (typeof value !== 'string' || value === '') return fail(field, 'is required');
    if (!EDMS_PATTERNS[field].test(value)) return fail(field, 'has an invalid shape');
    return value;
  };
  const optional = (field: 'requestId' | 'section'): string | undefined => {
    const value = record[field];
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') return fail(field, 'must be a string');
    if (!EDMS_PATTERNS[field].test(value)) return fail(field, 'has an invalid shape');
    return value;
  };
  const ctx: EdmsContext = {
    ruc: required('ruc'),
    ssic: required('ssic'),
    docType: required('docType'),
  };
  const requestId = optional('requestId');
  if (requestId !== undefined) ctx.requestId = requestId;
  const section = optional('section');
  if (section !== undefined) ctx.section = section;
  return ctx;
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
  const status = errorStatus(error);
  if (status === 401) res.setHeader('WWW-Authenticate', 'Bearer realm="semperscribe-companion"');
  sendJson(res, status, errorPayload(error));
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
  const edms = edmsContextFromInput(body.edms);

  const result = await withTimeout(
    renderDocument({
      document: body.document,
      format: format as CompanionFormat,
      edms,
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

async function route(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  options: CompanionServerOptions,
): Promise<void> {
  const configuredHost = options.host ?? DEFAULT_HOST;
  assertAllowedHost(req, configuredHost);
  assertAllowedOrigin(req, configuredHost);

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

  // Every route past the liveness probe takes the credential.
  assertAuthorized(req, options.token);

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

/**
 * The server, unstarted. Tests listen on port 0; the script listens on
 * 7719. The token and host default to the environment; an explicit
 * `token: undefined` in the options still means "no token".
 */
export function createCompanionServer(options?: CompanionServerOptions): http.Server {
  const resolved: CompanionServerOptions = {
    token: options && 'token' in options ? options.token : companionToken(),
    host: options?.host ?? companionHost(),
  };
  return http.createServer((req, res) => {
    route(req, res, resolved).catch((error) => {
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
  options: CompanionServerOptions = {},
): Promise<StartedCompanion> {
  const token = 'token' in options ? options.token : companionToken();
  try {
    assertStartupSecurity(host, token);
  } catch (error) {
    return Promise.reject(error);
  }
  const server = createCompanionServer({ token, host });
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
    process.stdout.write(
      `  bearer token: ${companionToken() === undefined ? 'off (set COMPANION_TOKEN to require one)' : 'required'}\n`,
    );
    if (!isLoopbackHost(started.host)) {
      process.stderr.write(
        `WARNING: bound to ${started.host}, not loopback. Every route except GET /health ` +
          'requires the COMPANION_TOKEN bearer token; keep the token out of shell history and logs.\n',
      );
    }
  }).catch((error) => {
    process.stderr.write(`Companion failed to start: ${(error as Error).message}\n`);
    process.exitCode = 1;
  });
}
