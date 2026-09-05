/**
 * B.1 (HARDENING_PLAN_2026-09): the DoD and Navy letterhead seals as
 * static files under public/seals/, fetched on first use.
 *
 * They used to live in src/lib/dod-seal-data.ts as two base64 strings,
 * 3.85 MB of JavaScript in a lazy chunk. As PNG files the same pixels are
 * 2.9 MB of binary, decoded once by the browser, served with the other
 * stable assets under the service worker's network-first rule, and out
 * of the JavaScript budget entirely.
 *
 * Both consumers want different shapes: @react-pdf's <Image> takes a
 * data URL string, the docx ImageRun takes an ArrayBuffer. Both come from
 * one cached byte load per seal.
 *
 * Node has no same-origin fetch, so a test or script registers a loader
 * which reads public/ from disk (tests/setup.ts does this). A registered
 * loader always wins over fetch.
 */
import { getBasePath } from '@/lib/path-utils';

export type SealKind = 'dod' | 'navy';

/** Paths relative to public/. Byte-identical to the former base64 data. */
export const SEAL_FILES: Record<SealKind, string> = {
  dod: 'seals/dod-seal.png',
  navy: 'seals/navy-seal.png',
};

export type SealLoader = (relativePath: string) => Promise<Uint8Array>;

let registeredLoader: SealLoader | null = null;
const byteCache = new Map<SealKind, Promise<Uint8Array>>();
const dataUrlCache = new Map<SealKind, Promise<string>>();

/** Override the fetch-based loader (Node tests, scripts). Pass null to restore. */
export function registerSealLoader(loader: SealLoader | null): void {
  registeredLoader = loader;
  byteCache.clear();
  dataUrlCache.clear();
}

async function fetchFromOrigin(relativePath: string): Promise<Uint8Array> {
  const url = `${getBasePath()}/${relativePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Seal asset ${url} returned HTTP ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/** Raw PNG bytes for a seal, loaded once and shared. */
export function loadSealBytes(kind: SealKind): Promise<Uint8Array> {
  let pending = byteCache.get(kind);
  if (!pending) {
    const load = registeredLoader ?? fetchFromOrigin;
    pending = load(SEAL_FILES[kind]);
    byteCache.set(kind, pending);
    // A failed load must not poison the cache for the next attempt.
    pending.catch(() => byteCache.delete(kind));
  }
  return pending;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  // btoa needs a binary string; build it in chunks to stay under the
  // argument-count limit of String.fromCharCode.apply on large inputs.
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

/** The seal as a PNG data URL, the shape @react-pdf's <Image> consumes. */
export function loadSealDataUrl(kind: SealKind): Promise<string> {
  let pending = dataUrlCache.get(kind);
  if (!pending) {
    pending = loadSealBytes(kind).then(bytes => `data:image/png;base64,${toBase64(bytes)}`);
    dataUrlCache.set(kind, pending);
    pending.catch(() => dataUrlCache.delete(kind));
  }
  return pending;
}
