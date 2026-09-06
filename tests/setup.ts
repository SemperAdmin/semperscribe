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

// jsdom has no ResizeObserver. Several Radix primitives (Checkbox among
// them, via @radix-ui/react-use-size) call it in a layout effect on mount,
// which throws ReferenceError in any test that renders one, whether or not
// the test cares about sizing. No test exercised that mount path before the
// NAVMC 10132 stage-visibility tests, which are the first to render the
// appeal section's checkbox field.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub;
}
// Static assets (fonts, seals, form blanks, NAVMC template pages) are
// fetched from the origin in the browser. Node has no origin to fetch
// from, so the suite reads public/ from disk through the asset seam in
// src/lib/assets.ts. The same registration is what the headless
// companion performs.
import { registerNodeAssets } from './node-assets';

registerNodeAssets();
