/**
 * Static asset seam (companion PR 1).
 *
 * Every file the export pipelines read from public/ (fonts, seals, form
 * blanks, NAVMC template pages) goes through this module, so one
 * registration decides where the bytes come from:
 *
 * - Browser, nothing registered: same-origin fetch under the deployment
 *   base path, exactly what the generators did before.
 * - Node (tests, the headless companion): a registered loader reads the
 *   files from disk, and a registered path resolver turns a public/
 *   relative path into an absolute file path for consumers which take a
 *   path rather than bytes (@react-pdf font registration).
 *
 * Paths are always relative to public/ with no leading slash, e.g.
 * `fonts/LiberationSerif-Regular.ttf`. A registered loader always wins
 * over fetch, and a registered resolver always wins over the URL builder.
 */
import { getBasePath } from '@/lib/path-utils';

export type AssetLoader = (relativePath: string) => Promise<Uint8Array>;
export type AssetPathResolver = (relativePath: string) => string;

let registeredLoader: AssetLoader | null = null;
let registeredResolver: AssetPathResolver | null = null;

/** Override the fetch-based loader (Node tests, scripts). Pass null to restore. */
export function registerAssetLoader(loader: AssetLoader | null): void {
  registeredLoader = loader;
}

/** Override the URL builder for path consumers. Pass null to restore. */
export function registerAssetPathResolver(resolver: AssetPathResolver | null): void {
  registeredResolver = resolver;
}

/** True when a loader is registered, so callers know fetch is not in play. */
export function hasAssetLoader(): boolean {
  return registeredLoader !== null;
}

function normalise(relativePath: string): string {
  return relativePath.replace(/^\/+/, '');
}

/**
 * The URL the browser fetches an asset from: base path plus the relative
 * path, origin-relative. Used by the default loader and by callers which
 * hand a URL to something else (the official-form path helpers).
 */
export function assetUrl(relativePath: string): string {
  return `${getBasePath()}/${normalise(relativePath)}`;
}

/**
 * A path a file consumer accepts. In the browser this is the absolute URL
 * (origin plus base path); under a registered resolver it is whatever the
 * resolver returns (an absolute file path on disk for the companion and
 * the test suite). Without either, the origin-relative URL is returned,
 * which is what the pre-seam code did when window was undefined.
 */
export function resolveAssetPath(relativePath: string): string {
  const rel = normalise(relativePath);
  if (registeredResolver) return registeredResolver(rel);
  if (typeof window !== 'undefined') return `${window.location.origin}${assetUrl(rel)}`;
  return assetUrl(rel);
}

async function fetchFromOrigin(relativePath: string): Promise<Uint8Array> {
  const url = assetUrl(relativePath);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Asset ${url} returned HTTP ${res.status}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/** Raw bytes of an asset. Throws when the asset cannot be read. */
export function loadAssetBytes(relativePath: string): Promise<Uint8Array> {
  const rel = normalise(relativePath);
  const load = registeredLoader ?? fetchFromOrigin;
  return load(rel);
}

/**
 * Raw bytes of an asset, or null when it cannot be read. For assets the
 * output degrades without rather than fails on (the I-Type seal, the
 * NAVMC 10922 background pages).
 */
export async function loadOptionalAssetBytes(relativePath: string): Promise<Uint8Array | null> {
  try {
    return await loadAssetBytes(relativePath);
  } catch {
    return null;
  }
}
