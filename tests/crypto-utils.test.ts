/**
 * P1.1 (DONDOCS_PARITY_PLAN) - encrypted share-link crypto.
 * Node 18+ exposes WebCrypto on globalThis.crypto, so these run in
 * the standard local vitest environment.
 */
import { describe, it, expect } from 'vitest';
import { encryptText, decryptText, DecryptFailedError, MalformedPayloadError } from '@/lib/crypto-utils';

const PASSWORD = 'correct horse battery staple';

describe('encryptText / decryptText round trip', () => {
  it('round-trips a plain string', async () => {
    const payload = await encryptText('hello world', PASSWORD);
    expect(await decryptText(payload, PASSWORD)).toBe('hello world');
  });

  it('round-trips unicode and lz-string output characters', async () => {
    const text = 'Přehled ✓ 数据   end';
    const payload = await encryptText(text, PASSWORD);
    expect(await decryptText(payload, PASSWORD)).toBe(text);
  });

  it('produces a v1 dot-separated, URL-safe payload', async () => {
    const payload = await encryptText('x', PASSWORD);
    const parts = payload.split('.');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
    // base64url only - no +, /, =, and fragment-safe throughout
    expect(payload).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('emits a distinct payload per call (random salt and IV)', async () => {
    const a = await encryptText('same', PASSWORD);
    const b = await encryptText('same', PASSWORD);
    expect(a).not.toBe(b);
  });
});

describe('failure modes', () => {
  it('rejects a wrong password with DecryptFailedError', async () => {
    const payload = await encryptText('secret', PASSWORD);
    await expect(decryptText(payload, 'wrong password')).rejects.toBeInstanceOf(DecryptFailedError);
  });

  it('rejects a tampered ciphertext with DecryptFailedError', async () => {
    const payload = await encryptText('secret', PASSWORD);
    const parts = payload.split('.');
    const ct = parts[3];
    // Flip the FIRST ciphertext character: the trailing base64url char
    // carries only 2 significant bits for this payload length, so a
    // last-char swap decodes to identical bytes ~25% of the time and
    // the "tamper" is a no-op (caught flaky on the first local run).
    const flipped = (ct[0] === 'A' ? 'B' : 'A') + ct.slice(1);
    const tampered = [parts[0], parts[1], parts[2], flipped].join('.');
    await expect(decryptText(tampered, PASSWORD)).rejects.toBeInstanceOf(DecryptFailedError);
  });

  it('rejects structural garbage with MalformedPayloadError', async () => {
    await expect(decryptText('not-a-payload', PASSWORD)).rejects.toBeInstanceOf(MalformedPayloadError);
    await expect(decryptText('v2.a.b.c', PASSWORD)).rejects.toBeInstanceOf(MalformedPayloadError);
    await expect(decryptText('v1.!!.??.$$', PASSWORD)).rejects.toBeInstanceOf(MalformedPayloadError);
  });
});
