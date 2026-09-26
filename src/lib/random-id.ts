/**
 * Random identifiers for local records (autosave sessions, document
 * copies, NJP base files). These are IndexedDB keys, not credentials,
 * but CodeQL traces any Math.random() into an id named "session" as
 * js/insecure-randomness (10 alerts, 2026-09-26), and the fallback it
 * flagged never has a reason to exist: every runtime with IndexedDB has
 * crypto.getRandomValues, including insecure-origin pages where
 * crypto.randomUUID is absent.
 */
export function randomId(): string {
  if (typeof crypto !== 'undefined') {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    if (typeof crypto.getRandomValues === 'function') {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      // RFC 4122 version 4 layout, so the fallback is shaped like the
      // primary and nothing downstream can tell them apart.
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }
  throw new Error('No cryptographic random source is available in this runtime.');
}
