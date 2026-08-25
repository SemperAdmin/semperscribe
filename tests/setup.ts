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
