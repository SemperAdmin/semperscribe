/**
 * EDMS handoff, inbound only.
 *
 * EDMS launches SemperScribe with a scalar-only prefill in the URL
 * fragment. The fragment never reaches server logs, the same reasoning
 * behind the `#es=` encrypted share format in lib/url-state.ts.
 *
 * Deliberately narrow: no subject, no names, no body, no free text.
 * Carrying letter content here would place CUI in a URL and collapse
 * the Low categorization in docs/RMF_READINESS.md. Scalars only.
 *
 * Encoding is readable key-value rather than compressed. The payload is
 * non-sensitive by construction and this link is stored and eyeballed
 * on the EDMS side, so legibility is worth more than compactness. The
 * `#es=` format stays opaque because it carries the letter. This one
 * carries none of it.
 *
 * Shape:
 *   https://semperscribe.app.cloud.gov/#edms=v=1&rid=482&ruc=12345
 *     &ssic=1650&doc=basic&sec=S-1
 *
 * `rid` is OPTIONAL. EDMS omits it when the drafter starts from the New
 * Request screen, where the request row does not exist yet. What comes
 * back is an attachment, and the EDMS attachment control binds it to the
 * request on submit, so correlation never depended on the ID being known
 * at drafting time.
 *
 * Every token is a key=value pair, version included. A bare `v1`
 * token would parse as the KEY `v1` with an empty value.
 */

import { setEdmsContext, type EdmsContext } from './edms-mode';

const EDMS_HASH_PREFIX = '#edms=';
const CURRENT_VERSION = 1;

export interface EdmsPrefill extends EdmsContext {
  version: number;
}

/**
 * Scalar shapes. Anything failing these is dropped rather than coerced.
 * A malformed link opens the blank editor, which is a state the Marine
 * understands, instead of a half-populated one, which is not.
 */
const PATTERNS = {
  requestId: /^\d{1,9}$/,
  ruc: /^[A-Za-z0-9]{1,8}$/,
  ssic: /^\d{4,5}$/,
  docType: /^[a-z0-9-]{1,40}$/,
  section: /^[A-Za-z0-9 \-/]{1,32}$/,
};

/**
 * Parses an EDMS prefill out of an arbitrary hash string. Exported for
 * tests; production callers use getEdmsPrefillFromHash().
 */
export function parseEdmsHash(hash: string): EdmsPrefill | null {
  if (!hash.startsWith(EDMS_HASH_PREFIX)) return null;

  const params = new URLSearchParams(hash.slice(EDMS_HASH_PREFIX.length));

  // Version is the first gate. Rejecting an unknown version is the
  // point: a future v2 link reaching an old bundle opens a blank editor
  // instead of silently misreading fields.
  const rawVersion = params.get('v') ?? params.get('version') ?? '';
  const version = Number(rawVersion.replace(/^v/i, ''));
  if (version !== CURRENT_VERSION) return null;

  const rawRequestId = params.get('rid') ?? '';
  const ruc = params.get('ruc') ?? '';
  const ssic = params.get('ssic') ?? '';
  const docType = params.get('doc') ?? '';
  const rawSection = params.get('sec') ?? '';

  // Absent rid is valid. A PRESENT but malformed rid is not: it means the
  // caller meant to correlate and got it wrong, which is worse than not
  // correlating at all.
  if (rawRequestId.length > 0 && !PATTERNS.requestId.test(rawRequestId)) return null;
  if (!PATTERNS.ruc.test(ruc)) return null;
  if (!PATTERNS.ssic.test(ssic)) return null;
  if (!PATTERNS.docType.test(docType)) return null;

  const section =
    rawSection.length > 0 && PATTERNS.section.test(rawSection) ? rawSection : undefined;

  const requestId = rawRequestId.length > 0 ? rawRequestId : undefined;
  return { version, requestId, ruc, ssic, docType, section };
}

/** Reads the EDMS prefill from the live location hash, or null. */
export function getEdmsPrefillFromHash(): EdmsPrefill | null {
  if (typeof window === 'undefined') return null;
  return parseEdmsHash(window.location.hash);
}

/**
 * Reads the prefill, latches EDMS mode, and returns it. Call this once
 * on mount, ahead of the share-link branches, then clear the hash.
 */
export function consumeEdmsPrefill(): EdmsPrefill | null {
  const prefill = getEdmsPrefillFromHash();
  if (prefill === null) return null;
  setEdmsContext({
    requestId: prefill.requestId,
    ruc: prefill.ruc,
    ssic: prefill.ssic,
    docType: prefill.docType,
    section: prefill.section,
  });
  return prefill;
}

/** Removes the fragment without a reload. Mirrors clearShareHash(). */
export function clearEdmsHash(): void {
  if (typeof window === 'undefined') return;
  if (!window.location.hash.startsWith(EDMS_HASH_PREFIX)) return;
  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState({}, '', url.toString());
}

/**
 * Builds a link for a request. The EDMS Power App builds its own in
 * Power Fx; this exists for tests and for local reproduction of a
 * reported link.
 */
export function buildEdmsUrl(base: string, ctx: EdmsContext): string {
  const params = new URLSearchParams();
  params.set('v', String(CURRENT_VERSION));
  if (ctx.requestId) params.set('rid', ctx.requestId);
  params.set('ruc', ctx.ruc);
  params.set('ssic', ctx.ssic);
  params.set('doc', ctx.docType);
  if (ctx.section) params.set('sec', ctx.section);
  return base + EDMS_HASH_PREFIX + params.toString();
}
