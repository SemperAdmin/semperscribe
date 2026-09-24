import { describe, it, expect } from 'vitest';
import { layoutVolume } from '@/lib/volume/layout';
import { blankVolume } from '@/store/volumeStore';

const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('figure layout', () => {
  it('lays out a figure with caption and TOC entry', () => {
    const d = blankVolume();
    d.chapters[0].figures = [{ number: 1, caption: 'Legal Services Support Section', image: PNG_1x1, legend: ['TC — Trial Counsel'] }];
    const out = layoutVolume(d);
    expect(out.pages.flatMap(p => p.items).some((i: any) => i.kind === 'figure')).toBe(true);
    expect(out.toc.some(e => e.label.startsWith('FIGURE 1'))).toBe(true);
  });
});
