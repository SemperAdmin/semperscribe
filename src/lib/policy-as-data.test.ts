/**
 * @deprecated Retired with lib/policy-as-data.ts per
 * docs/POLICY_AS_DATA_HANDOFF.md section 3. Kept compiling (and green)
 * for one release so the retirement is a clean two-step; delete both
 * files in the next release.
 *
 * Policy-as-Data (USLM) canonical export — unit tests.
 *
 * Covers the flat-list -> hierarchy conversion (path/label/number
 * ladder) against a MARADMIN-style paragraph 8 structure, and a
 * round-trip through the bundled sample directive.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  createPolicyDataRecord,
  createPolicyDataBlob,
  generatePolicyDataFilename,
} from './policy-as-data';
import { ParagraphData } from '@/types';

describe('createPolicyDataRecord', () => {
  it('produces the canonical path/label/number ladder for a nested structure', () => {
    // Mirrors MARADMIN 051/23 paragraph 8: a level-1 "Amplifying
    // Instructions" with a level-2 child, a level-3 child, and a
    // level-4 child.
    const paragraphs: ParagraphData[] = [
      { id: 1, level: 1, content: 'Amplifying Instructions', title: 'Amplifying Instructions' },
      { id: 2, level: 2, content: 'First amplifying item.' },
      { id: 3, level: 3, content: 'A sub-item.' },
      { id: 4, level: 4, content: 'First deeper sub-item.' },
      { id: 5, level: 4, content: 'Second deeper sub-item.' },
    ];

    const formData = {
      documentType: 'maradmin',
      maradminYear: '2023',
      maradminNumber: '051',
      subj: 'AMPLIFYING INSTRUCTIONS TEST',
      from: 'CMC WASHINGTON DC',
      date_signed: '2023-02-01',
      distributionStatement: { code: 'A' },
    } as unknown as Parameters<typeof createPolicyDataRecord>[0];

    const record = createPolicyDataRecord(formData, paragraphs, [], []);
    const provisions = record.sections[0].provisions;

    expect(record.schema_version).toBe('0.4.0');
    expect(provisions).toHaveLength(5);

    const paths = provisions.map((p) => p.path);
    expect(paths).toEqual(['p1', 'p1/a', 'p1/a/1', 'p1/a/1/a', 'p1/a/1/b']);

    const numbers = provisions.map((p) => p.number);
    expect(numbers).toEqual([
      '1.',
      '1.a.',
      '1.a.(1)',
      '1.a.(1)(a)',
      '1.a.(1)(b)',
    ]);

    // The second depth-3 sibling carries p1/a/1/b and the 1.a.(1)(b)
    // citation - the same shape as MARADMIN 051/23 paragraph 8.a.(1)(b).
    const deepest = provisions[4];
    expect(deepest.path).toBe('p1/a/1/b');
    expect(deepest.number).toBe('1.a.(1)(b)');
    expect(deepest.depth).toBe(3);
    expect(deepest.parent).toBe('p1/a/1');
    expect(deepest.uslm_identifier).toBe(
      '/us/dod/don/usmc/maradmin/2023/051/p1/a/1/b'
    );

    // Every provision is UNVERIFIED and publishable.
    expect(provisions.every((p) => p.verification === 'UNVERIFIED')).toBe(true);
    expect(record.publication.publishable).toBe(true);

    // The section carries flat body text (required by the 0.4.0 schema
    // and the pipeline's USLM exporter, which both read section.text).
    expect(record.sections[0].text.length).toBeGreaterThan(0);
    expect(record.sections[0].text).toContain('Amplifying Instructions');
    expect(record.publication.distribution_statement).toBe(
      'DISTRIBUTION STATEMENT A'
    );
  });

  it('converts the bundled sample directive without errors', () => {
    const samplePath = join(__dirname, '..', '..', 'sample-directive.nldp');
    const sample = JSON.parse(readFileSync(samplePath, 'utf-8'));
    const { formData, paragraphs, references } = sample.data;

    const record = createPolicyDataRecord(
      formData,
      paragraphs as ParagraphData[],
      references || [],
      sample.data.enclosures || []
    );

    expect(record.schema_version).toBe('0.4.0');
    expect(record.doc_type).toBe('MCO');
    expect(record.sections).toHaveLength(1);
    expect(record.sections[0].provisions).toHaveLength(paragraphs.length);
    expect(
      record.sections[0].provisions.every((p) => p.verification === 'UNVERIFIED')
    ).toBe(true);
    expect(record.publication.publishable).toBe(true);

    // Serialization helpers behave.
    const blob = createPolicyDataBlob(record);
    expect(blob.type).toBe('application/json');
    expect(generatePolicyDataFilename(record)).toBe(`${record.id}.policy.json`);
  });
});
