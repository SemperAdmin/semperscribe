#!/usr/bin/env node
/**
 * Static server for the built export, used by the Playwright smoke test.
 *
 * Serves out/ under the GitHub Pages base path (/semperscribe/) so the
 * test exercises the same asset prefix production uses. Directory
 * requests resolve to index.html (next.config.ts sets trailingSlash).
 * Missing files return a real 404 rather than the app shell, so a broken
 * chunk reference fails loudly instead of loading HTML as JavaScript.
 *
 * 2026-09-09: this server now also mirrors the cloud.gov response
 * headers (public/nginx/conf/includes/security-headers.conf), applied
 * to every response the same way nginx's `always` does - 200s, the
 * base-path redirect, and every error response alike. A 2026-09-08 CSP
 * shipped to cloud.gov and broke the deployed signature-field preview
 * ("Failed to load PDF file.", pdfjs blocked by connect-src) while
 * passing every gate here, because this server sent no headers at all
 * and so never exercised the policy the suite was meant to guard. Set
 * SERVE_OUT_NO_HEADERS=1 to serve without them for a differential run.
 *
 * Usage: node scripts/serve-out.mjs [port] [basePath]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const basePath = (process.argv[3] ?? process.env.BASE_PATH ?? '/semperscribe').replace(/\/$/, '');
const root = resolve(process.cwd(), 'out');
const SECURITY_HEADERS_PATH = 'public/nginx/conf/includes/security-headers.conf';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.nldp': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
};

if (!existsSync(join(root, 'index.html'))) {
  console.error(`[serve-out] ${root}/index.html not found. Run \`npm run build\` first.`);
  process.exit(1);
}

/**
 * Reads public/nginx/conf/includes/security-headers.conf (relative to
 * process.cwd(), same as nginx's location_include resolves it at
 * deploy time) and parses every `add_header NAME "VALUE" always;` line
 * into a [name, value] pair, unescaping `\"`. Comment lines (`#`) and
 * blank lines are ignored.
 *
 * Missing file: not an error (a bare checkout without the conf, or a
 * differential run) - logs and returns no headers. Present but zero
 * headers parsed: that is a syntax slip in the conf that would
 * silently drop production headers from the suite, so it exits 1
 * instead.
 */
function loadProductionHeaders() {
  const confPath = resolve(process.cwd(), SECURITY_HEADERS_PATH);
  if (!existsSync(confPath)) {
    console.log('[serve-out] no security-headers.conf, serving without production headers');
    return [];
  }
  const content = readFileSync(confPath, 'utf8');
  const headerLineRe = /^add_header\s+(\S+)\s+"((?:[^"\\]|\\.)*)"\s+always;$/;
  const headers = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = headerLineRe.exec(line);
    if (!match) continue;
    const [, name, rawValue] = match;
    headers.push([name, rawValue.replace(/\\"/g, '"')]);
  }
  if (headers.length === 0) {
    console.error(
      `[serve-out] ${SECURITY_HEADERS_PATH} exists but no add_header lines parsed - ` +
        'check its syntax against the regex in loadProductionHeaders (scripts/serve-out.mjs).',
    );
    process.exit(1);
  }
  return headers;
}

const noHeaders = process.env.SERVE_OUT_NO_HEADERS === '1';
let productionHeaders = [];
if (noHeaders) {
  console.log('[serve-out] SERVE_OUT_NO_HEADERS=1, serving without production headers');
} else {
  productionHeaders = loadProductionHeaders();
  if (productionHeaders.length > 0) {
    console.log(
      `[serve-out] ${productionHeaders.length} production headers applied from ${SECURITY_HEADERS_PATH}`,
    );
  }
}

/** Folds the production headers into a per-response headers object. */
function withProductionHeaders(headers) {
  if (productionHeaders.length === 0) return headers;
  const merged = { ...headers };
  for (const [name, value] of productionHeaders) merged[name] = value;
  return merged;
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/' || pathname === basePath) {
    res.writeHead(302, withProductionHeaders({ Location: `${basePath}/` }));
    res.end();
    return;
  }
  if (!pathname.startsWith(`${basePath}/`)) {
    res.writeHead(404, withProductionHeaders({ 'Content-Type': 'text/plain' }));
    res.end('Not found (outside base path)');
    return;
  }
  pathname = pathname.slice(basePath.length);

  let filePath = normalize(join(root, pathname));
  if (!filePath.startsWith(root)) {
    res.writeHead(403, withProductionHeaders({}));
    res.end();
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  } else if (!existsSync(filePath) && existsSync(`${filePath}.html`)) {
    filePath = `${filePath}.html`;
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.writeHead(404, withProductionHeaders({ 'Content-Type': 'text/plain' }));
    res.end(`Not found: ${pathname}`);
    return;
  }
  res.writeHead(200, withProductionHeaders({
    'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  }));
  createReadStream(filePath).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[serve-out] http://127.0.0.1:${port}${basePath}/ -> ${root}`);
});
