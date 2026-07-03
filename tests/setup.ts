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
