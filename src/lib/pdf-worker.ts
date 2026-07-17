import { version as pdfjsVersion } from 'pdfjs-dist';
import { resolvePublicPath } from './path-utils';

/**
 * Same-origin URL of the pdfjs worker vendored in public/. Serving it
 * locally instead of from a CDN keeps PDF features working on networks
 * that block unpkg/jsdelivr (common on government networks) and
 * preserves the local-first posture. The copy must match the installed
 * pdfjs-dist version exactly — tests/pdf-worker-sync.test.ts enforces
 * byte equality with node_modules/pdfjs-dist/build/pdf.worker.min.mjs.
 *
 * The ?v= query is load-bearing, not decoration. The cloud.gov MIME
 * incident cached an octet-stream copy of the un-versioned URL in
 * THREE layers (browser HTTP cache via heuristic freshness, service
 * worker cache, any edge cache), and the SW's revalidation fetch reads
 * through the HTTP cache, so the poison self-renewed even after the
 * server was fixed. Versioning the URL changes the cache key in every
 * layer at once, and a pdfjs upgrade re-busts automatically. The path
 * is also forced absolute: with an empty basePath the resolver returns
 * a bare relative name, which breaks off the root route.
 */
export function getPdfWorkerSrc(): string {
  const path = resolvePublicPath('pdf.worker.min.mjs');
  const absolute = path.startsWith('/') || /^https?:\/\//.test(path) ? path : `/${path}`;
  return `${absolute}?v=${pdfjsVersion}`;
}
