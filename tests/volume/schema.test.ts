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
  appendices: [],
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

  // Task 22: `appendices` defaults to [] when omitted (like `chapters`), and
  // accepts an appendix with a glossary and/or plain body blocks.
  it('defaults appendices to an empty array', () => {
    const parsed = VolumeSchema.parse(minimal);
    expect(parsed.appendices).toEqual([]);
  });

  it('accepts an appendix with a glossary and defaults its changeLog/blocks', () => {
    const withAppendix: VolumeDoc = {
      ...minimal,
      appendices: [
        {
          letter: 'A',
          title: 'GLOSSARY OF ACRONYMS AND ABBREVIATIONS',
          glossary: [{ term: 'ABA', definition: 'American Bar Association' }],
        } as VolumeDoc['appendices'][number],
      ],
    };
    const parsed = VolumeSchema.parse(withAppendix);
    expect(parsed.appendices).toHaveLength(1);
    expect(parsed.appendices[0].changeLog).toEqual([]);
    expect(parsed.appendices[0].blocks).toEqual([]);
    expect(parsed.appendices[0].glossary).toEqual([{ term: 'ABA', definition: 'American Bar Association' }]);
  });

  it('accepts an appendix with plain body blocks and no glossary', () => {
    const withAppendix: VolumeDoc = {
      ...minimal,
      appendices: [
        {
          letter: 'A',
          title: 'SAMPLE FORM',
          changeLog: [],
          blocks: [{ runs: [{ text: 'Plain appendix text.' }] }],
        },
      ],
    };
    const parsed = VolumeSchema.parse(withAppendix);
    expect(parsed.appendices[0].glossary).toBeUndefined();
    expect(parsed.appendices[0].blocks[0].runs[0].text).toBe('Plain appendix text.');
  });
});
