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
 * Usage: node scripts/serve-out.mjs [port] [basePath]
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';

const port = Number(process.argv[2] ?? process.env.PORT ?? 4173);
const basePath = (process.argv[3] ?? process.env.BASE_PATH ?? '/semperscribe').replace(/\/$/, '');
const root = resolve(process.cwd(), 'out');

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

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);

  if (pathname === '/' || pathname === basePath) {
    res.writeHead(302, { Location: `${basePath}/` });
    res.end();
    return;
  }
  if (!pathname.startsWith(`${basePath}/`)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found (outside base path)');
    return;
  }
  pathname = pathname.slice(basePath.length);

  let filePath = normalize(join(root, pathname));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = join(filePath, 'index.html');
  } else if (!existsSync(filePath) && existsSync(`${filePath}.html`)) {
    filePath = `${filePath}.html`;
  }
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`Not found: ${pathname}`);
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[serve-out] http://127.0.0.1:${port}${basePath}/ -> ${root}`);
});
