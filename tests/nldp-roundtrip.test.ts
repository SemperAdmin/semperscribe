/**
 * NLDP round-trip determinism: export → import → export is
 * byte-identical apart from metadata.createdAt. The receiving side
 * requires idempotent ingest, and a package that does not round-trip
 * cannot deliver it (docs/POLICY_AS_DATA_HANDOFF.md section 8).
 */
import { describe, it, expect } from 'vitest';
import { createNLDPFile, importNLDPFile } from '@/lib/nldp-utils';
import type { NLDPFile } from '@/lib/nldp-format';

const FORM = {
  documentType: 'mco',
  ssic: '1553.2B',
  subj: 'ROUND TRIP FIXTURE',
  from: 'Commanding Officer, Fixture Command',
  to: 'Distribution List',
  sig: 'F. IXTURE',
  date_signed: '2026-08-01',
  distributionStatement: { code: 'A' },
};
const PARAGRAPHS = [
  { id: 1, level: 1, content: 'Situation.' },
  { id: 2, level: 2, content: 'Per ref (a).' },
  { id: 3, level: 1, content: 'Mission.' },
];
const REFERENCES = ['MCO 5215.1K', 'Verbal guidance, unparseable on purpose'];
const ENCLOSURES = ['Fixture Enclosure (1)'];
const VIAS = ['Commanding General, Fixture Division'];
const COPY_TOS = ['File'];

async function exportFixture(): Promise<NLDPFile> {
  return createNLDPFile(FORM, VIAS, REFERENCES, ENCLOSURES, COPY_TOS, PARAGRAPHS);
}

/** Serialize the way the app writes the file to disk. */
const serialize = (f: NLDPFile) => JSON.stringify(f, null, 2);

describe('NLDP round-trip', () => {
  it('export → import → export is byte-identical apart from createdAt', async () => {
    const first = await exportFixture();
    const imported = await importNLDPFile(serialize(first));
    expect(imported.success).toBe(true);
    expect(imported.warnings ?? []).toEqual([]);

    // Re-export from the imported data, exactly as a second machine would.
    const d = imported.data!;
    const second = await createNLDPFile(
      d.formData,
      d.vias.map(v => v.text),
      d.references.map(r => r.text),
      d.enclosures.map(e => e.text),
      d.copyTos.map(c => c.text),
      d.paragraphs,
    );

    // The data sections — and therefore the integrity hashes — must be
    // byte-identical: identical designators, citations, ordering, and
    // no wall-clock stamps inside data.
    expect(JSON.stringify(second.data)).toBe(JSON.stringify(first.data));
    expect(second.integrity).toEqual(first.integrity);

    // The whole file differs only in metadata.createdAt.
    const a = JSON.parse(serialize(first));
    const b = JSON.parse(serialize(second));
    a.metadata.createdAt = 'X';
    b.metadata.createdAt = 'X';
    expect(JSON.stringify(b, null, 2)).toBe(JSON.stringify(a, null, 2));
  });

  it('same input exports to an identical data section every time', async () => {
    const one = await exportFixture();
    const two = await exportFixture();
    expect(one.integrity.dataHash).toBe(two.integrity.dataHash);
    expect(one.integrity.crc32).toBe(two.integrity.crc32);
  });

  it('a genuine integrity hash verifies on import (no warnings)', async () => {
    const file = await exportFixture();
    const result = await importNLDPFile(serialize(file));
    expect(result.success).toBe(true);
    expect(result.warnings ?? []).toEqual([]);
  });

  it('a tampered data section is flagged on import', async () => {
    const file = await exportFixture();
    const tampered = JSON.parse(serialize(file));
    tampered.data.paragraphs[0].content = 'Situation, edited after export.';
    const result = await importNLDPFile(JSON.stringify(tampered));
    expect(result.success).toBe(true); // integrity is advisory, not a gate
    expect(result.warnings?.join(' ')).toMatch(/integrity|mismatch|CRC32/i);
  });
});
