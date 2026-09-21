import { describe, it, expect } from 'vitest';
import { VolumeSchema, type VolumeDoc } from '@/lib/schemas/volume-schema';

const minimal: VolumeDoc = {
  documentType: 'volume',
  order: { designator: 'MCO 5800.16', policyTitle: 'LSAM', sponsorCode: 'JA' },
  volume: {
    number: 1, title: 'LEGAL SUPPORT', titleQuoted: true,
    originalPublicationDate: '2018-02-20', lastUpdatedDate: '2018-02-20',
    distribution: { kind: 'statementA' }, submitChangesTo: 'CMC (JA)',
    sectionPeriod: false, pageBand: 'auto',
  },
  changeLog: [], references: [],
  chapters: [{
    number: 1, title: 'STAFF JUDGE ADVOCATE', changeLog: [],
    sections: [{ seq: 1, title: 'GENERAL ROLES', paragraphs: [] }],
    figures: [],
  }],
};

describe('VolumeSchema', () => {
  it('accepts a minimal valid volume', () => {
    expect(VolumeSchema.parse(minimal)).toBeTruthy();
  });
  it('rejects a wrong documentType', () => {
    expect(() => VolumeSchema.parse({ ...minimal, documentType: 'mco' })).toThrow();
  });
  it('defaults pageBand to auto and sectionPeriod to false', () => {
    const { volume, ...rest } = minimal;
    const noDefaults = { ...rest, volume: { ...volume } };
    delete (noDefaults.volume as Record<string, unknown>).pageBand;
    delete (noDefaults.volume as Record<string, unknown>).sectionPeriod;
    const parsed = VolumeSchema.parse(noDefaults);
    expect(parsed.volume.pageBand).toBe('auto');
    expect(parsed.volume.sectionPeriod).toBe(false);
  });
});
