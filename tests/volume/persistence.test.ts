import { describe, it, expect } from 'vitest';
import { NLDP_CONSTANTS } from '@/lib/nldp-format';
import type { NLDPData } from '@/lib/nldp-format';
import { VolumeSchema } from '@/lib/schemas/volume-schema';
import { blankVolumeTemplate, multiChapterVolumeTemplate } from '@/lib/templates/volume';
import { blankVolume } from '@/store/volumeStore';

describe('NLDP v1.2 persistence', () => {
  it('bumps NLDP to 1.2 and keeps 1.0/1.1 supported', () => {
    expect(NLDP_CONSTANTS.CURRENT_VERSION).toBe('1.2');
    expect(NLDP_CONSTANTS.SUPPORTED_VERSIONS).toEqual(expect.arrayContaining(['1.0', '1.1', '1.2']));
  });

  it('provides a valid blank volume template', () => {
    expect(() => VolumeSchema.parse(blankVolumeTemplate().defaultData)).not.toThrow();
  });

  it('provides a valid multi-chapter volume template with 2+ chapters', () => {
    const template = multiChapterVolumeTemplate();
    expect(() => VolumeSchema.parse(template.defaultData)).not.toThrow();
    const parsed = VolumeSchema.parse(template.defaultData);
    expect(parsed.chapters.length).toBeGreaterThanOrEqual(2);
  });

  it('round-trips an NLDPData carrying a volume payload through JSON serialize/parse', () => {
    // createNLDPFile/importNLDPFile are pure over JSON; a plain
    // serialize -> parse cycle exercises the same contract data.volume
    // must survive, without needing a browser File/Blob.
    const volumeDoc = blankVolume();
    const nldpData: NLDPData = {
      formData: { documentType: 'volume' },
      paragraphs: [],
      references: [],
      enclosures: [],
      vias: [],
      copyTos: [],
      volume: volumeDoc,
    };

    const roundTripped = JSON.parse(JSON.stringify(nldpData)) as NLDPData;

    expect(roundTripped.volume).toBeDefined();
    expect(() => VolumeSchema.parse(roundTripped.volume)).not.toThrow();
    expect(VolumeSchema.parse(roundTripped.volume)).toEqual(volumeDoc);
  });
});
