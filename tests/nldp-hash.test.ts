/**
 * Signed-artifact hashing: a known byte sequence produces a known
 * SHA-256, computed in-browser via crypto.subtle. The hash is the
 * evidence the receiving side checks independently.
 */
import { describe, it, expect } from 'vitest';
import { hashSignedArtifact } from '@/lib/release';

// SHA-256 of the ASCII bytes "abc" — the classic FIPS 180-2 test vector.
const SHA256_ABC =
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

// SHA-256 of the empty byte string.
const SHA256_EMPTY =
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('hashSignedArtifact', () => {
  it('produces the known SHA-256 for a known byte sequence', async () => {
    const file = new File(['abc'], 'signed.pdf', { type: 'application/pdf' });
    const artifact = await hashSignedArtifact(file);
    expect(artifact).toEqual({
      filename: 'signed.pdf',
      format: 'pdf',
      sha256: SHA256_ABC,
      byteLength: 3,
      hashedAt: expect.any(String),
    });
  });

  it('hashes an empty file to the empty-string digest', async () => {
    const file = new File([], 'empty.docx');
    const artifact = await hashSignedArtifact(file);
    expect(artifact.sha256).toBe(SHA256_EMPTY);
    expect(artifact.format).toBe('docx');
    expect(artifact.byteLength).toBe(0);
  });

  it('tags the format from the extension, case-insensitively', async () => {
    const pdf = await hashSignedArtifact(new File(['x'], 'UPPER.PDF'));
    expect(pdf.format).toBe('pdf');
    const docx = await hashSignedArtifact(new File(['x'], 'Signed.DocX'));
    expect(docx.format).toBe('docx');
  });

  it('refuses anything that is not a .pdf or .docx', async () => {
    await expect(hashSignedArtifact(new File(['x'], 'letter.txt')))
      .rejects.toThrow(/\.pdf or \.docx/);
    await expect(hashSignedArtifact(new File(['x'], 'archive.docx.zip')))
      .rejects.toThrow(/\.pdf or \.docx/);
  });
});
