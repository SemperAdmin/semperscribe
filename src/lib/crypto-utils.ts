/**
 * Client-side encryption for share links (P1.1, DONDOCS_PARITY_PLAN).
 *
 * AES-256-GCM with a PBKDF2-SHA-256 key derived from a user password.
 * Pure functions over WebCrypto - no DOM, unit-testable in Node 18+.
 *
 * Payload format (dot-separated, all base64url without padding):
 *   v1.<salt>.<iv>.<ciphertext>
 *
 * The payload travels in the URL FRAGMENT, never the query string, so
 * it stays out of server logs. Decryption failure is indistinguishable
 * between a wrong password and a tampered payload by design - GCM
 * authenticates, we do not leak which check failed.
 */

const PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const FORMAT_VERSION = 'v1';

/** Thrown when a payload is structurally not one of ours. */
export class MalformedPayloadError extends Error {
  constructor() {
    super('Payload is not a recognized encrypted share format');
    this.name = 'MalformedPayloadError';
  }
}

/** Thrown when decryption fails (wrong password or tampered data). */
export class DecryptFailedError extends Error {
  constructor() {
    super('Decryption failed');
    this.name = 'DecryptFailedError';
  }
}

function assertSubtle(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto unavailable - encrypted links require a secure (https) context');
  }
  return subtle;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle = assertSubtle();
  const material = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypts a string with a password. Returns the v1 payload.
 */
export async function encryptText(plaintext: string, password: string): Promise<string> {
  const subtle = assertSubtle();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const ct = await subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext),
  );
  return [FORMAT_VERSION, toBase64Url(salt), toBase64Url(iv), toBase64Url(new Uint8Array(ct))].join('.');
}

/**
 * Decrypts a v1 payload with a password.
 * Throws MalformedPayloadError for structural problems and
 * DecryptFailedError for wrong password or tampered data.
 */
export async function decryptText(payload: string, password: string): Promise<string> {
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) {
    throw new MalformedPayloadError();
  }
  let salt: Uint8Array, iv: Uint8Array, ct: Uint8Array;
  try {
    salt = fromBase64Url(parts[1]);
    iv = fromBase64Url(parts[2]);
    ct = fromBase64Url(parts[3]);
  } catch {
    throw new MalformedPayloadError();
  }
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES || ct.length === 0) {
    throw new MalformedPayloadError();
  }
  const subtle = assertSubtle();
  const key = await deriveKey(password, salt);
  try {
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource);
    return new TextDecoder().decode(plain);
  } catch {
    throw new DecryptFailedError();
  }
}
