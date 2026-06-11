/**
 * S2 — url-state v2 routing slip + structural signature probe
 * (docs/SIGNATURE_COLLECTION_PLAN.md, Gate S2).
 */
import { describe, it, expect } from 'vitest';
import { encodeStateForUrl, decodeStateFromUrl, generateShareableUrl, SignatureRouting } from '@/lib/url-state';
import { probeSignature } from '@/lib/signature-probe';
import { FIXTURE_FORM_DATA } from './golden/fixture';

const toHex = (s: string) => [...s].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');

/** Synthetic signed-PDF-shaped bytes (structure only, no real CMS). */
function syntheticSigned(opts: { trailing?: boolean } = {}): Uint8Array {
  const cms = '\x30\x82' + 'DOE.JANE.QUINN.1234567890' + '\x00\x01' + 'DOD EMAIL CA-70' + '\x00' + 'DoD Root CA 6' + '\x00';
  const head = '%PDF-1.7\n1 0 obj\n<< /Type /Sig /Filter /Adobe.PPKLite /SubFilter /adbe.pkcs7.detached\n/M (D:20260610161234-10\'00\')\n/ByteRange [0 100 300 50]\n/Contents <' + toHex(cms) + '> >>\nendobj\n';
  let body = head;
  while (body.length < 350) body += '%pad\n';
  body = body.slice(0, 350);
  if (opts.trailing) body += '%%post-signature increment\n';
  return new TextEncoder().encode(body);
}

describe('S2 url-state v2 routing slip', () => {
  const routing: SignatureRouting = {
    requestedSigner: 'I. M. MARINE',
    dueDate: '2026-06-20',
    returnEmail: 'drafter@usmc.mil',
    note: 'CO signs before COB Friday.',
  };

  it('round-trips routing through encode/decode', () => {
    const encoded = encodeStateForUrl({ formData: FIXTURE_FORM_DATA as never, routing, version: 2 });
    const decoded = decodeStateFromUrl(encoded);
    expect(decoded?.routing).toEqual(routing);
    expect(decoded?.version).toBe(2);
  });

  it('v1 links without routing still decode (back-compat)', () => {
    const encoded = encodeStateForUrl({ formData: FIXTURE_FORM_DATA as never, version: 1 });
    const decoded = decodeStateFromUrl(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.routing).toBeUndefined();
  });

  it('generateShareableUrl stamps the current version', () => {
    const { url } = generateShareableUrl({ formData: FIXTURE_FORM_DATA as never, routing, version: 0 }, 'https://x.test/app');
    const encoded = new URL(url).searchParams.get('share')!;
    expect(decodeStateFromUrl(encoded)?.version).toBe(2);
  });
});

describe('S2 structural signature probe', () => {
  it('detects the DoD/Acrobat signature shape', () => {
    const r = probeSignature(syntheticSigned());
    expect(r.hasSignature).toBe(true);
    expect(r.subFilter).toBe('adbe.pkcs7.detached');
    expect(r.byteRange).toEqual([0, 100, 300, 50]);
    expect(r.signTime).toBe('2026-06-10 16:12:34');
    expect(r.signerHint).toContain('DOE.JANE.QUINN.1234567890');
    expect(r.caHints).toContain('DOD EMAIL CA-70');
    expect(r.caHints).toContain('DoD Root CA 6');
    expect(r.bytesAfterSignedRange).toBe(false);
  });

  it('flags bytes after the signed range', () => {
    const r = probeSignature(syntheticSigned({ trailing: true }));
    expect(r.bytesAfterSignedRange).toBe(true);
  });

  it('reports no signature on unsigned bytes', () => {
    const r = probeSignature(new TextEncoder().encode('%PDF-1.7\nno sig here'));
    expect(r.hasSignature).toBe(false);
    expect(r.caHints).toEqual([]);
  });
});
