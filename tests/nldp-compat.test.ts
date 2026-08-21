/**
 * NLDP 1.0 → 1.1 compatibility: a 1.0 file still imports under the 1.1
 * reader. Every 1.1 addition is optional at the type level, so neither
 * reader rejects the other's files.
 */
import { describe, it, expect } from 'vitest';
import { importNLDPFile, validateNLDPFile } from '@/lib/nldp-utils';
import { NLDP_CONSTANTS } from '@/lib/nldp-format';

/** A faithful 1.0 file: no designators, no cited citations. */
const V10_FILE = {
  format: 'NLDP',
  version: '1.0',
  metadata: {
    createdAt: '2024-08-30T12:00:00.000Z',
    formatVersion: '1.0',
    createdBy: 'Marine Corps Directives Formatter',
  },
  integrity: {
    dataHash: 'test-hash-placeholder',
    crc32: 'test-crc32-placeholder',
    recordCount: 3,
  },
  data: {
    formData: { documentType: 'mco', ssic_code: '5215', subj: 'V10 FIXTURE' },
    paragraphs: [
      { id: 1, level: 1, content: 'A 1.0 paragraph with no designator.' },
    ],
    references: [{ text: 'MCO 5215.1K', order: 1 }],
    enclosures: [{ text: 'Enclosure (1)', order: 1 }],
    vias: [],
    copyTos: [],
    directiveMetadata: { status: 'final' },
  },
};

describe('NLDP 1.0 compatibility', () => {
  it('1.0 remains a supported version', () => {
    expect(NLDP_CONSTANTS.SUPPORTED_VERSIONS).toContain('1.0');
    expect(NLDP_CONSTANTS.CURRENT_VERSION).toBe('1.1');
  });

  it('a 1.0 file validates under the 1.1 reader', () => {
    const result = validateNLDPFile(V10_FILE);
    expect(result.errors).toEqual([]);
    expect(result.isValid).toBe(true);
  });

  it('a 1.0 file imports under the 1.1 reader', async () => {
    const result = await importNLDPFile(JSON.stringify(V10_FILE));
    expect(result.success).toBe(true);
    expect(result.data?.paragraphs[0].content).toContain('1.0 paragraph');
    expect(result.data?.paragraphs[0].designator).toBeUndefined();
    expect(result.data?.references[0].parsed).toBeUndefined();
  });

  it('the 1.0 lifecycle values remain readable', async () => {
    const result = await importNLDPFile(JSON.stringify(V10_FILE));
    expect(result.data?.directiveMetadata?.status).toBe('final');
  });

  it('an unknown future version is refused, not misread', () => {
    const future = { ...V10_FILE, version: '9.9' };
    const result = validateNLDPFile(future);
    expect(result.isValid).toBe(false);
    expect(result.errors.join(' ')).toContain('Unsupported version');
  });
});
