import '@testing-library/jest-dom';

// Polyfill Promise.withResolvers for Node.js < 22 (CI pins Node 20 via
// .nvmrc; pdfjs-dist needs it). Mirrors the polyfill in next.config.ts.
if (!('withResolvers' in Promise)) {
  // @ts-expect-error polyfill
  Promise.withResolvers = function <T>() {
    let resolve: (value: T | PromiseLike<T>) => void;
    let reject: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve: resolve!, reject: reject! };
  };
}

// B.1 (HARDENING_PLAN_2026-09): the letterhead seals are static files under
// public/seals/, fetched from the origin in the browser. Node has no origin
// to fetch from, so the suite reads them from disk through the loader hook.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { registerSealLoader } from '@/lib/seal-assets';

registerSealLoader(async (relativePath) => {
  const bytes = await readFile(path.join(process.cwd(), 'public', relativePath));
  return new Uint8Array(bytes);
});
