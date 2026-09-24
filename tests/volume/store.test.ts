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

    // Finding 6: setDoc (used by import and template-load) used to bypass
    // normalizeNumbering entirely, so a hand-edited/imported file whose
    // seq fields drifted from array position reintroduced the editor/PDF
    // numbering mismatch.
    it('setDoc normalizes a doc whose survivor section has seq:2 at index 0', () => {
      const { setDoc } = useVolumeStore.getState();
      const doc = blankVolume();
      doc.chapters[0].sections = [{ seq: 2, title: 'Survivor', paragraphs: [] }];
      setDoc(doc);
      const stored = useVolumeStore.getState().doc;
      expect(stored.chapters[0].sections[0].seq).toBe(1);
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

  // Task 22: appendix authoring - letter is derived from array position,
  // same "designators are computed, not authored" convention as a
  // chapter's `number` (normalizeNumbering's identical rationale).
  describe('appendices', () => {
    it('starts with no appendices', () => {
      expect(useVolumeStore.getState().doc.appendices).toEqual([]);
    });

    it('addAppendix appends a new appendix lettered by position', () => {
      const { addAppendix } = useVolumeStore.getState();
      addAppendix();
      addAppendix();
      const { appendices } = useVolumeStore.getState().doc;
      expect(appendices).toHaveLength(2);
      expect(appendices[0].letter).toBe('A');
      expect(appendices[1].letter).toBe('B');
    });

    it('removeAppendix re-letters the survivor to A', () => {
      const { addAppendix, updateAppendix, removeAppendix } = useVolumeStore.getState();
      addAppendix();
      addAppendix();
      updateAppendix(1, { title: 'Survivor' });
      removeAppendix(0);
      const { appendices } = useVolumeStore.getState().doc;
      expect(appendices).toHaveLength(1);
      expect(appendices[0].letter).toBe('A');
      expect(appendices[0].title).toBe('Survivor');
    });

    it('updateAppendix patches the title', () => {
      const { addAppendix, updateAppendix } = useVolumeStore.getState();
      addAppendix();
      updateAppendix(0, { title: 'GLOSSARY OF ACRONYMS AND ABBREVIATIONS' });
      expect(useVolumeStore.getState().doc.appendices[0].title).toBe('GLOSSARY OF ACRONYMS AND ABBREVIATIONS');
    });

    it('updateAppendixBlock sets then appends body blocks', () => {
      const { addAppendix, updateAppendixBlock } = useVolumeStore.getState();
      addAppendix();
      updateAppendixBlock(0, 0, { runs: [{ text: 'First.' }] });
      updateAppendixBlock(0, 1, { runs: [{ text: 'Second.' }] });
      const { blocks } = useVolumeStore.getState().doc.appendices[0];
      expect(blocks).toHaveLength(2);
      expect(blocks[0].runs[0].text).toBe('First.');
      expect(blocks[1].runs[0].text).toBe('Second.');
    });

    it('addAppendixChangeRow/updateAppendixChangeRow/removeAppendixChangeRow manage the divider table rows', () => {
      const { addAppendix, addAppendixChangeRow, updateAppendixChangeRow, removeAppendixChangeRow } =
        useVolumeStore.getState();
      addAppendix();
      addAppendixChangeRow(0);
      updateAppendixChangeRow(0, 0, { version: '1', summary: 'Initial' });
      let row = useVolumeStore.getState().doc.appendices[0].changeLog[0];
      expect(row).toMatchObject({ version: '1', summary: 'Initial' });
      removeAppendixChangeRow(0, 0);
      expect(useVolumeStore.getState().doc.appendices[0].changeLog).toHaveLength(0);
    });

    it('addGlossaryRow/updateGlossaryRow/removeGlossaryRow manage glossary entries', () => {
      const { addAppendix, addGlossaryRow, updateGlossaryRow, removeGlossaryRow } = useVolumeStore.getState();
      addAppendix();
      addGlossaryRow(0);
      updateGlossaryRow(0, 0, { term: 'ABA', definition: 'American Bar Association' });
      let glossary = useVolumeStore.getState().doc.appendices[0].glossary;
      expect(glossary).toEqual([{ term: 'ABA', definition: 'American Bar Association' }]);
      addGlossaryRow(0);
      glossary = useVolumeStore.getState().doc.appendices[0].glossary;
      expect(glossary).toHaveLength(2);
      removeGlossaryRow(0, 0);
      glossary = useVolumeStore.getState().doc.appendices[0].glossary;
      expect(glossary).toEqual([{ term: '', definition: '' }]);
    });

    it('setDoc re-letters appendices whose stored letter drifted from position', () => {
      const { setDoc } = useVolumeStore.getState();
      const doc = blankVolume();
      doc.appendices = [
        { letter: 'Z', title: 'First', changeLog: [], blocks: [] },
        { letter: 'Y', title: 'Second', changeLog: [], blocks: [] },
      ];
      setDoc(doc);
      const { appendices } = useVolumeStore.getState().doc;
      expect(appendices[0].letter).toBe('A');
      expect(appendices[1].letter).toBe('B');
    });
  });
});
