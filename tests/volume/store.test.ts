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

  // Fix round 1: editor display and PDF output both must derive the same
  // numbering. The editor computes designators from array index; the PDF
  // layout engine (src/lib/volume/layout.ts) prints them from the stored
  // seq/number fields. normalizeNumbering() keeps the two in sync after
  // every structural mutation.
  describe('numbering stays in sync with position after mutation', () => {
    it('removeNode renumbers a survivor section to seq 1', () => {
      const { addSection, removeNode } = useVolumeStore.getState();
      addSection(0); // now 2 sections: seq 1, seq 2
      removeNode({ chapter: 0, section: 0 }); // drop the first
      const doc = useVolumeStore.getState().doc;
      expect(doc.chapters[0].sections).toHaveLength(1);
      expect(doc.chapters[0].sections[0].seq).toBe(1);
    });

    it('moveNode swaps chapter content but renumbers by position', () => {
      const { addChapter, updateNodeTitle, moveNode } = useVolumeStore.getState();
      addChapter(); // now 2 chapters
      updateNodeTitle({ chapter: 1 }, 'Second Chapter');
      moveNode({ chapter: 1 }, -1); // move it up, ahead of chapter 1
      const doc = useVolumeStore.getState().doc;
      expect(doc.chapters[0].number).toBe(1);
      expect(doc.chapters[1].number).toBe(2);
      expect(doc.chapters[0].title).toBe('Second Chapter');
    });

    it('removeNode renumbers a survivor sub-paragraph to seq 1', () => {
      const { addParagraph, addSubPara, removeNode } = useVolumeStore.getState();
      addParagraph(0, 0);
      const paraPath = { chapter: 0, section: 0, paragraph: 0 };
      addSubPara(paraPath);
      addSubPara(paraPath); // now 2 sub-paras: seq 1, seq 2
      removeNode({ ...paraPath, sub: [0] }); // drop the first
      const doc = useVolumeStore.getState().doc;
      const children = doc.chapters[0].sections[0].paragraphs[0].children;
      expect(children).toHaveLength(1);
      expect(children[0].seq).toBe(1);
    });
  });
});
