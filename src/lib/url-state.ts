import LZString from 'lz-string';
import { FormData, ParagraphData } from '@/types';

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
    const url = `${base}?share=${encoded}`;

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
 * Extracts and decodes state from URL search params
 */
export function getStateFromUrl(): ShareableState | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('share');

  if (!encoded) return null;

  return decodeStateFromUrl(encoded);
}

/**
 * Clears the share parameter from the URL without reloading
 */
export function clearShareParam(): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  url.searchParams.delete('share');
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
