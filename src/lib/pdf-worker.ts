import { resolvePublicPath } from './path-utils';

/**
 * Same-origin URL of the pdfjs worker vendored in public/. Serving it
 * locally instead of from a CDN keeps PDF features working on networks
 * that block unpkg/jsdelivr (common on government networks) and
 * preserves the local-first posture. The copy must match the installed
 * pdfjs-dist version exactly — tests/pdf-worker-sync.test.ts enforces
 * byte equality with node_modules/pdfjs-dist/build/pdf.worker.min.mjs.
 */
export function getPdfWorkerSrc(): string {
  return resolvePublicPath('pdf.worker.min.mjs');
}
