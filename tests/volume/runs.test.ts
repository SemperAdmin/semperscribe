import { describe, it, expect } from 'vitest';
import { layoutVolume } from '@/lib/volume/layout';
import { blankVolume } from '@/store/volumeStore';

describe('run styling preserved through layout', () => {
  it('marks changed runs so they can be painted blue', () => {
    const d = blankVolume();
    d.chapters[0].sections[0] = { seq: 1, title: 'PURPOSE', body: [{ runs: [{ text: 'new policy', changed: true }] }], paragraphs: [] };
    const out = layoutVolume(d);
    const seg = out.pages.flatMap(p => p.items).flatMap((i: any) => i.segments ?? []).find((s: any) => s.run?.changed);
    expect(seg?.text).toContain('new');
  });
});
