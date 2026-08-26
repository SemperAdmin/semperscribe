import LZString from 'lz-string';
import { FormData, ParagraphData } from '@/types';
import { encryptText, decryptText, DecryptFailedError, MalformedPayloadError } from '@/lib/crypto-utils';
import type { ReviewComment } from '@/lib/review-comments';

/**
 * State that can be shared via URL
 */
/**
 * S2 (docs/SIGNATURE_COLLECTION_PLAN.md) — routing slip carried in the
 * share URL, OUTBOUND ONLY. The URL carries the signature REQUEST;
 * the signed artifact always travels as a file (constraint K3).
 * OPSEC: the link embeds the full letter text — non-sensitive drafts
 * only, user-owned, same posture as the no-CUI rule.
 */
export interface SignatureRouting {
  /** Typed name of the requested signer (matches the signature block) */
  requestedSigner: string;
  /** ISO date the signature is needed by (optional) */
  dueDate?: string;
  /** Where the signed file returns to (e-mail address, free text) */
  returnEmail?: string;
  /** Short note from the drafter to the signer */
  note?: string;
}

export interface ShareableState {
  formData: FormData;
  paragraphs?: ParagraphData[];
  references?: string[];
  enclosures?: string[];
  vias?: string[];
  copyTos?: string[];
  distList?: string[];
  /** S2: present only on request-for-signature links (v2) */
  routing?: SignatureRouting;
  /** P1.1: ISO expiry date, enforced on load. Set only on encrypted links. */
  expires?: string;
  /** R1: review comments ride the same encrypted payload - the link IS the routing. */
  comments?: ReviewComment[];
  version: number; // For future compatibility
}

const CURRENT_VERSION = 2;
const MAX_URL_LENGTH = 8000; // Safe limit for most browsers

/**
 * Compresses and encodes state for URL storage
 */
export function encodeStateForUrl(state: ShareableState): string {
  try {
    const json = JSON.stringify(state);
    const compressed = LZString.compressToEncodedURIComponent(json);
    return compressed;
  } catch (error) {
    console.error('Failed to encode state:', error);
    throw new Error('Failed to encode document state');
  }
}

/**
 * Decodes and decompresses state from URL
 */
export function decodeStateFromUrl(encoded: string): ShareableState | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) {
      console.error('Failed to decompress URL state');
      return null;
    }
    const state = JSON.parse(json) as ShareableState;

    // Version migration could happen here in the future
    if (!state.version) {
      state.version = 1;
    }

    return state;
  } catch (error) {
    console.error('Failed to decode state:', error);
    return null;
  }
}

/**
 * Generates a shareable URL with encoded state
 */
export function generateShareableUrl(
  state: ShareableState,
  baseUrl?: string
): { url: string; isLong: boolean; error?: string } {
  try {
    const encoded = encodeStateForUrl({ ...state, version: CURRENT_VERSION });
    const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');
    // THE FRAGMENT, NOT THE QUERY STRING. A query string is sent to the
    // server on every request and lands in server logs, proxy logs, and the
    // Referer header of whatever the page loads next. This link carries a
    // whole document, and for a NAVMC 10132 that is the accused's name,
    // EDIPI, offenses and punishment. The fragment never leaves the browser.
    //
    // The encrypted variant below has used the fragment since it was
    // written; this one did not, which meant the UNPROTECTED format was the
    // one leaking. Legacy `?share=` links still decode, see getStateFromUrl.
    const url = `${base}${SHARE_HASH_PREFIX}${encoded}`;

    const isLong = url.length > MAX_URL_LENGTH;

    return {
      url,
      isLong,
      error: isLong ? 'URL is very long and may not work in all browsers/applications' : undefined
    };
  } catch (error) {
    return {
      url: '',
      isLong: false,
      error: error instanceof Error ? error.message : 'Failed to generate URL'
    };
  }
}

/**
 * Where an unencrypted share link carries its payload.
 *
 * Declared above `generateShareableUrl` in reading order but hoisted here
 * beside the reader, because the two have to agree and a reader looking at
 * one should see the other.
 */
export const SHARE_HASH_PREFIX = '#s=';

/**
 * Extracts and decodes state from a share link.
 *
 * READS BOTH FORMS. `#s=` is what this app now writes. `?share=` is what it
 * wrote before 2026-08-26, and links in circulation carry it, so they keep
 * working rather than opening an app with an empty document.
 *
 * BOTH ARE UNPROTECTED and both go through the same consent gate in
 * useShareLinkLoader. Moving the payload out of the query string stops it
 * reaching server logs; it does nothing about the link being
 * attacker-constructable, which is a different problem with its own answer.
 */
export function getStateFromUrl(): ShareableState | null {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  if (hash.startsWith(SHARE_HASH_PREFIX)) {
    const encoded = hash.slice(SHARE_HASH_PREFIX.length);
    if (encoded.length > 0) return decodeStateFromUrl(encoded);
  }

  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('share');
  if (!encoded) return null;

  return decodeStateFromUrl(encoded);
}

/**
 * Clears the share payload from the URL without reloading.
 *
 * CLEARS BOTH, because either one could have brought the document in and
 * leaving the payload in the address bar means it reaches the next
 * screenshot, the next copied URL, and the browser history.
 */
export function clearShareParam(): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  url.searchParams.delete('share');
  if (url.hash.startsWith(SHARE_HASH_PREFIX)) url.hash = '';
  window.history.replaceState({}, '', url.toString());
}

// ---------------------------------------------------------------------------
// P1.1 Encrypted share links (DONDOCS_PARITY_PLAN)
//
// New links: `${base}#es=<v1 payload>` - AES-256-GCM over the same
// lz-string-compressed JSON the legacy format uses. The fragment never
// reaches server logs. Legacy `?share=` links continue to decode above.
// ---------------------------------------------------------------------------

const ENCRYPTED_HASH_PREFIX = '#es=';

export type EncryptedLoadResult =
  | { status: 'ok'; state: ShareableState }
  | { status: 'wrong-password' }
  | { status: 'expired'; expiredAt: string }
  | { status: 'corrupt' };

/**
 * Generates an encrypted shareable URL. Compression happens BEFORE
 * encryption (ciphertext does not compress).
 */
export async function generateEncryptedShareUrl(
  state: ShareableState,
  password: string,
  baseUrl?: string
): Promise<{ url: string; isLong: boolean; error?: string }> {
  try {
    const compressed = encodeStateForUrl({ ...state, version: CURRENT_VERSION });
    const payload = await encryptText(compressed, password);
    const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '');
    const url = `${base}${ENCRYPTED_HASH_PREFIX}${payload}`;
    const isLong = url.length > MAX_URL_LENGTH;
    return {
      url,
      isLong,
      error: isLong ? 'URL is very long and may not work in all browsers/applications' : undefined,
    };
  } catch (error) {
    return {
      url: '',
      isLong: false,
      error: error instanceof Error ? error.message : 'Failed to generate encrypted URL',
    };
  }
}

/**
 * Returns the encrypted payload from the URL fragment, or null.
 */
export function getEncryptedPayloadFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith(ENCRYPTED_HASH_PREFIX)) return null;
  const payload = hash.slice(ENCRYPTED_HASH_PREFIX.length);
  return payload.length > 0 ? payload : null;
}

/**
 * Decrypts an encrypted share payload and enforces expiry.
 */
export async function decryptSharedState(
  payload: string,
  password: string
): Promise<EncryptedLoadResult> {
  let compressed: string;
  try {
    compressed = await decryptText(payload, password);
  } catch (error) {
    if (error instanceof DecryptFailedError) return { status: 'wrong-password' };
    if (error instanceof MalformedPayloadError) return { status: 'corrupt' };
    return { status: 'corrupt' };
  }
  const state = decodeStateFromUrl(compressed);
  if (!state) return { status: 'corrupt' };
  if (state.expires) {
    const expiry = Date.parse(state.expires);
    if (!Number.isNaN(expiry) && Date.now() > expiry) {
      return { status: 'expired', expiredAt: state.expires };
    }
  }
  return { status: 'ok', state };
}

/**
 * Clears the encrypted fragment from the URL without reloading.
 */
export function clearShareHash(): void {
  if (typeof window === 'undefined') return;
  if (!window.location.hash.startsWith(ENCRYPTED_HASH_PREFIX)) return;
  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState({}, '', url.toString());
}

/**
 * Copies text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const result = document.execCommand('copy');
      document.body.removeChild(textArea);
      return result;
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
