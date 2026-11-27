// @vitest-environment node
/**
 * public/chunk-reload-guard.js, run under Node in a vm context with a stub
 * `window`. The script registers its listeners on `window`, so the test
 * captures them and dispatches hand-built events.
 *
 * After a deploy, tabs still running the old build request script chunks
 * the new build no longer has. The guard reloads once; it must not loop.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SOURCE = readFileSync(path.join(process.cwd(), 'public', 'chunk-reload-guard.js'), 'utf8');

type Handler = (event: Record<string, unknown>) => void;

interface Harness {
  reloads: number;
  store: Map<string, string>;
  fire: (type: 'error' | 'unhandledrejection', event: Record<string, unknown>) => void;
}

function load(opts: { storageThrows?: boolean; now?: () => number } = {}): Harness {
  const handlers: Record<string, Handler[]> = {};
  const store = new Map<string, string>();
  const harness: Harness = {
    reloads: 0,
    store,
    fire: (type, event) => (handlers[type] ?? []).forEach((h) => h(event)),
  };
  const sessionStorage = {
    getItem(key: string) {
      if (opts.storageThrows) throw new Error('denied');
      return store.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (opts.storageThrows) throw new Error('denied');
      store.set(key, value);
    },
  };
  const window = {
    addEventListener(type: string, fn: Handler) {
      (handlers[type] ??= []).push(fn);
    },
    sessionStorage,
    location: {
      reload() {
        harness.reloads += 1;
      },
    },
  };
  const clock = opts.now ?? (() => 1_000_000);
  const DateStub = { now: clock };
  vm.runInContext(SOURCE, vm.createContext({ window, Date: DateStub, Number, String, RegExp }), {
    filename: 'chunk-reload-guard.js',
  });
  return harness;
}

const script = (src: string) => ({ target: { tagName: 'SCRIPT', src } });

describe('chunk-reload-guard', () => {
  it('reloads when a /_next/static/ script fails to load', () => {
    const h = load();
    h.fire('error', script('https://x.test/_next/static/chunks/abc.js'));
    expect(h.reloads).toBe(1);
  });

  it('reloads when a /_next/static/ stylesheet fails to load', () => {
    const h = load();
    h.fire('error', { target: { tagName: 'LINK', rel: 'stylesheet', href: '/_next/static/css/a.css' } });
    expect(h.reloads).toBe(1);
  });

  it('reloads on a ChunkLoadError rejection', () => {
    const h = load();
    h.fire('unhandledrejection', { reason: { name: 'ChunkLoadError', message: 'x' } });
    expect(h.reloads).toBe(1);
  });

  it('reloads on a dynamic import failure message', () => {
    const h = load();
    h.fire('unhandledrejection', { reason: new Error('Failed to fetch dynamically imported module: /a.js') });
    expect(h.reloads).toBe(1);
  });

  it('ignores an unrelated script error and an unrelated element', () => {
    const h = load();
    h.fire('error', script('https://x.test/analytics.js'));
    h.fire('error', { target: { tagName: 'IMG', src: '/_next/static/a.png' } });
    h.fire('error', { message: 'boom' });
    expect(h.reloads).toBe(0);
  });

  it('ignores an unrelated rejection', () => {
    const h = load();
    h.fire('unhandledrejection', { reason: new Error('network down') });
    h.fire('unhandledrejection', { reason: undefined });
    expect(h.reloads).toBe(0);
  });

  it('does not reload twice within 60 seconds, but does after', () => {
    let t = 1_000_000;
    const h = load({ now: () => t });
    h.fire('error', script('/_next/static/chunks/a.js'));
    t += 59_000;
    h.fire('error', script('/_next/static/chunks/b.js'));
    expect(h.reloads).toBe(1);
    t += 2_000;
    h.fire('error', script('/_next/static/chunks/c.js'));
    expect(h.reloads).toBe(2);
  });

  it('does not reload when sessionStorage throws, and does not throw', () => {
    const h = load({ storageThrows: true });
    expect(() => h.fire('error', script('/_next/static/chunks/a.js'))).not.toThrow();
    expect(h.reloads).toBe(0);
  });
});
