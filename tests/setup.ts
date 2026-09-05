import '@testing-library/jest-dom';

// Polyfill Promise.withResolvers for Node.js < 22 (CI reads .nvmrc, now
// 22, but a contributor on 20 still runs the suite; pdfjs-dist needs it).
// Mirrors the polyfill in next.config.ts.
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

// Static assets (fonts, seals, form blanks, NAVMC template pages) are
// fetched from the origin in the browser. Node has no origin to fetch
// from, so the suite reads public/ from disk through the asset seam in
// src/lib/assets.ts. The same registration is what the headless
// companion performs.
import { registerNodeAssets } from './node-assets';

registerNodeAssets();
