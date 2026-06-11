/**
 * S2 — structural signature probe (docs/SIGNATURE_COLLECTION_PLAN.md).
 *
 * Detects the PRESENCE and shape of a digital signature in returned
 * PDF bytes: /ByteRange, /SubFilter, signing time, and a signer hint
 * scraped from printable strings inside the CMS blob. This is NOT
 * cryptographic verification — no digest is computed, no chain is
 * built, no trust decision is made. Full verification ships in S3.
 * Every consumer must label results accordingly (advisory card).
 *
 * Format expectations verified against a real CAC-signed export
 * 2026-06-10: adbe.pkcs7.detached over ByteRange, signer cert from
 * DOD EMAIL CA-70 chaining to DoD Root CA 6 (constraint K2).
 */

export interface SignatureProbeResult {
  /** A signature dictionary with ByteRange + Contents was found */
  hasSignature: boolean;
  /** e.g. "adbe.pkcs7.detached" — DoD/Acrobat standard (K2) */
  subFilter?: string;
  /** The four ByteRange integers, if present */
  byteRange?: number[];
  /** Signing time from /M (D:YYYYMMDDHHmmSS...), ISO-ish best effort */
  signTime?: string;
  /** Signer common-name hint scraped from CMS strings (UNVERIFIED) */
  signerHint?: string;
  /** Issuing-CA hints scraped from CMS strings (UNVERIFIED) */
  caHints: string[];
  /** Bytes exist after the signed range (post-signature changes) */
  bytesAfterSignedRange?: boolean;
}

const LATIN1 = new TextDecoder('latin1');

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

/** Printable-ASCII runs of length >= 6 inside a byte blob. */
function printableStrings(bytes: Uint8Array, minLen = 6): string[] {
  const text = LATIN1.decode(bytes);
  return text.match(/[\x20-\x7e]{6,}/g) ?? [];
}

/**
 * Probe raw PDF bytes for a digital signature structure.
 * Pure byte scan — the input is never re-saved or mutated (plan risk
 * register: the verify path must not round-trip through pdf-lib).
 */
export function probeSignature(bytes: Uint8Array): SignatureProbeResult {
  const text = LATIN1.decode(bytes);
  const result: SignatureProbeResult = { hasSignature: false, caHints: [] };

  const brMatch = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(text);
  const contentsMatch = /\/Contents\s*<([0-9A-Fa-f\s]+)>/.exec(text);
  if (!brMatch || !contentsMatch) return result;

  result.hasSignature = true;
  result.byteRange = [brMatch[1], brMatch[2], brMatch[3], brMatch[4]].map(Number);

  const sfMatch = /\/SubFilter\s*\/([A-Za-z0-9.#]+)/.exec(text);
  if (sfMatch) result.subFilter = sfMatch[1];

  const mMatch = /\/M\s*\(D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(text);
  if (mMatch) {
    result.signTime = `${mMatch[1]}-${mMatch[2]}-${mMatch[3]} ${mMatch[4]}:${mMatch[5]}:${mMatch[6]}`;
  }

  // Post-signature bytes: the signed range must cover the file end.
  const [, len1, off2, len2] = result.byteRange;
  result.bytesAfterSignedRange = off2 + len2 < bytes.length;

  // Signer/CA hints from CMS printable strings — UNVERIFIED, display
  // only with the structural-probe caveat.
  try {
    const der = hexToBytes(contentsMatch[1]);
    const seen = new Set<string>();
    for (const s of printableStrings(der)) {
      // CAC subject CN pattern: LAST.FIRST[.MIDDLE].EDIPI — cap at the
      // 10-digit EDIPI so stray printable DER bytes never leak in
      // (observed against the real fixture: a trailing 0x30 digit).
      const cn = /^([A-Z][A-Z'-]+(?:\.[A-Z'-]+)*\.\d{10})(?!\d)/.exec(s)
        ?? /^([A-Z][A-Z'-]+(?:\.[A-Z'-]+)*\.\d{10})/.exec(s.slice(0, s.search(/\d{11,}/) >= 0 ? s.search(/\d{10}/) + 10 : s.length));
      if (cn && !result.signerHint) result.signerHint = cn[1];
      // DER tag bytes after a CN are often printable ('0' = 0x30) and
      // glue onto the number ("DoD Root CA 60"). Cap digits by the
      // KNOWN 2026 DoD PKI shape (K5): roots are single-digit (3-6),
      // issuing CAs two-digit (CA-59..CA-81). Heuristic, loudly
      // superseded by S3's real ASN.1 parse.
      const ca = /(DOD (?:EMAIL|ID|SW) CA-\d{2}|DoD Root CA \d)/.exec(s);
      if (ca && !seen.has(ca[1])) { seen.add(ca[1]); result.caHints.push(ca[1]); }
    }
  } catch {
    // hint extraction is best-effort; structural result stands
  }

  return result;
}

/** Convenience: probe a File/Blob from the ceremony drop zone. */
export async function probeSignatureBlob(blob: Blob): Promise<SignatureProbeResult> {
  return probeSignature(new Uint8Array(await blob.arrayBuffer()));
}
