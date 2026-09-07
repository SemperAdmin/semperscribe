// @vitest-environment node
/**
 * The service worker's fetch handler, run under Node in a vm context with
 * a stub `self`. The worker registers its listeners on `self`, so the
 * test captures them and dispatches hand-built fetch events.
 *
 * AUDIT P6-12. The navigation branch used to cache whatever the network
 * returned as the offline app shell, with no status check and outside
 * waitUntil, so a 503 during a rollout became the app every offline
 * visit thereafter.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SW_SOURCE = readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf8');
const ORIGIN = 'https://semperscribe.test';
const SCOPE = `${ORIGIN}/`;

type Listener = (event: FetchEventStub) => void;

interface FetchEventStub {
  request: RequestStub;
  respondWith: (p: Promise<Response> | Response) => void;
  waitUntil: (p: Promise<unknown>) => void;
}

interface RequestStub {
  method: string;
  url: string;
  mode: string;
}

interface CacheStub {
  puts: Array<[unknown, Response]>;
  put: (key: unknown, value: Response) => Promise<void>;
  match: (key: unknown) => Promise<Response | undefined>;
}

interface Harness {
  listeners: Record<string, Listener[]>;
  cache: CacheStub;
  setFetch: (fn: (request: RequestStub) => Promise<Response>) => void;
}

function loadWorker(): Harness {
  const listeners: Record<string, Listener[]> = {};
  const cache: CacheStub = {
    puts: [],
    async put(key, value) {
      this.puts.push([key, value]);
    },
    async match() {
      return undefined;
    },
  };
  let fetchImpl: (request: RequestStub) => Promise<Response> = async () => new Response('');
  const self = {
    registration: { scope: SCOPE },
    location: { href: SCOPE, origin: ORIGIN },
    addEventListener(name: string, fn: Listener) {
      (listeners[name] ??= []).push(fn);
    },
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  const context = vm.createContext({
    self,
    caches: {
      open: async () => cache,
      keys: async () => [],
      delete: async () => true,
      match: (key: unknown) => cache.match(key),
    },
    fetch: (request: RequestStub) => fetchImpl(request),
    Response,
    URL,
    Promise,
    console,
  });
  vm.runInContext(SW_SOURCE, context, { filename: 'sw.js' });
  return {
    listeners,
    cache,
    setFetch: (fn) => {
      fetchImpl = fn;
    },
  };
}

/** Dispatches one navigation and settles both the response and waitUntil. */
async function navigate(harness: Harness) {
  const waited: Promise<unknown>[] = [];
  let responded: Promise<Response> | Response | undefined;
  const event: FetchEventStub = {
    request: { method: 'GET', url: `${ORIGIN}/`, mode: 'navigate' },
    respondWith: (p) => {
      responded = p;
    },
    waitUntil: (p) => {
      waited.push(p);
    },
  };
  for (const fn of harness.listeners.fetch ?? []) fn(event);
  const response = await responded;
  await Promise.allSettled(waited);
  // Anything written outside waitUntil lands on a later tick; let it.
  await new Promise((r) => setTimeout(r, 5));
  return { response, waited };
}

let harness: Harness;

beforeEach(() => {
  harness = loadWorker();
});

describe('service worker navigation branch', () => {
  it('registers a fetch listener', () => {
    expect(harness.listeners.fetch?.length).toBe(1);
  });

  it('does not cache a 503 as the offline shell', async () => {
    harness.setFetch(async () => new Response('down for rollout', { status: 503 }));
    const { response } = await navigate(harness);
    expect(response?.status).toBe(503);
    expect(harness.cache.puts).toEqual([]);
  });

  it('does not cache a 404 or a redirect as the offline shell', async () => {
    for (const status of [404, 302]) {
      harness = loadWorker();
      harness.setFetch(async () => new Response('', { status, headers: { Location: '/' } }));
      await navigate(harness);
      expect(harness.cache.puts, String(status)).toEqual([]);
    }
  });

  it('does not cache an opaque or error-typed response', async () => {
    harness.setFetch(async () => Response.error());
    // Response.error() rejects nothing; it resolves with type "error".
    const { response } = await navigate(harness);
    // The fetch resolved, so the worker's catch branch did not run and the
    // error response is what comes back; the cache must not take it.
    expect(response?.type).toBe('error');
    expect(harness.cache.puts).toEqual([]);
  });

  it('caches a 200 basic response as the shell, inside waitUntil', async () => {
    harness.setFetch(async () => {
      const res = new Response('<html>app</html>', { status: 200 });
      Object.defineProperty(res, 'type', { value: 'basic' });
      return res;
    });
    const { response, waited } = await navigate(harness);
    expect(response?.status).toBe(200);
    expect(harness.cache.puts.length).toBe(1);
    expect(harness.cache.puts[0][0]).toBe('/');
    expect(waited.length).toBeGreaterThan(0);
  });

  it('serves the cached shell when the network fails', async () => {
    const shell = new Response('<html>cached</html>', { status: 200 });
    harness.cache.match = async () => shell;
    harness.setFetch(async () => {
      throw new TypeError('offline');
    });
    const { response } = await navigate(harness);
    expect(response).toBe(shell);
  });
});
