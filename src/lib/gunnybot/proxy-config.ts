import type { GunnyProviderId } from './types';

/**
 * Per-provider proxy base URL.
 *
 * WHY THIS EXISTS. api.genai.mil refuses every browser client. Measured
 * on a government workstation 2026-08-11 with two controls in place:
 * a no-cors GET and a no-cors POST both returned an opaque response, so
 * transport, TLS and the site proxy are healthy, while a cors-mode POST
 * needing a preflight failed in 212 ms and a cors-mode GET needing NO
 * preflight failed in 210 ms. Two independent gateway defects: the
 * anonymous OPTIONS is refused, and ordinary responses carry no
 * Access-Control-Allow-Origin. Until GenAI.mil fixes both, the only path
 * from a browser is a proxy the user runs. See
 * docs/GENAI_MIL_CORS_DEFECT_REPORT.md.
 *
 * WHY THIS IS NOT IN THE KEYRING. The keyring is memory-only on purpose,
 * because an API key is a secret and web storage is readable by any
 * script reaching the origin. A proxy base URL is not a secret, it is
 * workstation configuration, and holding it in memory would force the
 * user to retype it after every reload. It lives in localStorage and
 * survives the tab. Nothing sensitive goes in here.
 *
 * WHY PER PROVIDER AND NOT GLOBAL. Both adapters read
 * GunnyRequest.proxyBaseUrl. Google Gemini is proven to work
 * browser-direct from the same network, so a single global value would
 * silently reroute a working provider through an unnecessary hop.
 */

const STORAGE_KEY = 'gunnybot.proxy.v1';

type ProxyMap = Partial<Record<GunnyProviderId, string>>;

function readMap(): ProxyMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return {};
    return parsed as ProxyMap;
  } catch {
    // Storage unavailable, or the value was corrupted by hand. Treat it
    // as unset rather than throwing inside the send path.
    return {};
  }
}

function writeMap(map: ProxyMap): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Private mode or quota. The caller already updated its own state,
    // so the setting holds for this page and is forgotten on reload.
  }
}

/**
 * Validate and canonicalise a user-typed proxy base URL.
 *
 * Returns the normalised origin plus optional path prefix, or null when
 * the input is unusable. Adapters append their own route, for example
 * `/v1/chat/completions`, so the trailing slash is stripped here to keep
 * a doubled slash out of the request URL.
 *
 * A query string or fragment is rejected rather than dropped. Silently
 * discarding part of what the user typed produces a URL they did not ask
 * for and a failure they cannot read.
 *
 * NOTE ON LOOPBACK. Prefer `http://127.0.0.1:<port>` over
 * `http://localhost:<port>`. Chrome waives the mixed-content check only
 * where it identifies the destination as local BEFORE DNS resolution,
 * which an IP literal satisfies and a hostname does not. Separately,
 * Local Network Access enforcement shipped in Chrome 142, so a page on a
 * public origin reaching loopback prompts the user for permission and is
 * deniable by enterprise policy.
 */
export function normalizeProxyUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.search.length > 0 || parsed.hash.length > 0) return null;

  const path = parsed.pathname.replace(/\/+$/, '');
  return parsed.origin + path;
}

/** Stored proxy base URL for a provider, or null when none is set. */
export function getProxyUrl(provider: GunnyProviderId): string | null {
  const value = readMap()[provider];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Persist a proxy base URL. Returns the normalised value on success and
 * null when the input was rejected, in which case nothing is written.
 */
export function setProxyUrl(provider: GunnyProviderId, raw: string): string | null {
  const normalized = normalizeProxyUrl(raw);
  if (normalized === null) return null;
  const map = readMap();
  map[provider] = normalized;
  writeMap(map);
  return normalized;
}

export function clearProxyUrl(provider: GunnyProviderId): void {
  const map = readMap();
  delete map[provider];
  writeMap(map);
}

export function clearAllProxyUrls(): void {
  writeMap({});
}
