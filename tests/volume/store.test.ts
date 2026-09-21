import { describe, it, expect, beforeEach } from 'vitest';
import { useVolumeStore, blankVolume } from '@/store/volumeStore';

describe('volumeStore', () => {
  beforeEach(() => useVolumeStore.getState().setDoc(blankVolume()));
  it('starts with one chapter, one section', () => {
    const doc = useVolumeStore.getState().doc;
    expect(doc.chapters).toHaveLength(1);
    expect(doc.chapters[0].sections).toHaveLength(1);
  });
  it('adds a chapter with the next number', () => {
    useVolumeStore.getState().addChapter();
    const doc = useVolumeStore.getState().doc;
    expect(doc.chapters).toHaveLength(2);
    expect(doc.chapters[1].number).toBe(2);
  });
  it('adds a paragraph under a section', () => {
    useVolumeStore.getState().addParagraph(0, 0);
    expect(useVolumeStore.getState().doc.chapters[0].sections[0].paragraphs).toHaveLength(1);
  });
});
