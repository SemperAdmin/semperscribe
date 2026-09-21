import { create } from 'zustand';
import type { VolumeDoc } from '@/lib/schemas/volume-schema';

export function blankVolume(): VolumeDoc {
  return {
    documentType: 'volume',
    order: { designator: '', policyTitle: '', sponsorCode: '' },
    volume: {
      number: 1, title: '', originalPublicationDate: '', lastUpdatedDate: '',
      distribution: { kind: 'statementA' }, submitChangesTo: 'CMC (JA)\n3000 Marine Corps Pentagon\nWashington, DC 20350-3000',
      sectionPeriod: false, pageBand: 'auto',
    },
    changeLog: [], references: [],
    chapters: [{ number: 1, title: '', changeLog: [], sections: [{ seq: 1, title: '', paragraphs: [] }], figures: [] }],
  };
}

interface VolumeState {
  doc: VolumeDoc;
  setDoc: (doc: VolumeDoc) => void;
  updateMeta: (patch: Partial<VolumeDoc['volume']>) => void;
  addChapter: () => void;
  addSection: (chapterIdx: number) => void;
  addParagraph: (chapterIdx: number, sectionIdx: number) => void;
}

export const useVolumeStore = create<VolumeState>((set) => ({
  doc: blankVolume(),
  setDoc: (doc) => set({ doc }),
  updateMeta: (patch) => set((s) => ({ doc: { ...s.doc, volume: { ...s.doc.volume, ...patch } } })),
  addChapter: () => set((s) => {
    const number = s.doc.chapters.length + 1;
    return { doc: { ...s.doc, chapters: [...s.doc.chapters, { number, title: '', changeLog: [], sections: [{ seq: 1, title: '', paragraphs: [] }], figures: [] }] } };
  }),
  addSection: (ci) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    chapters[ci].sections.push({ seq: chapters[ci].sections.length + 1, title: '', paragraphs: [] });
    return { doc: { ...s.doc, chapters } };
  }),
  addParagraph: (ci, si) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    const paras = chapters[ci].sections[si].paragraphs;
    paras.push({ seq: paras.length + 1, title: '', body: [{ runs: [{ text: '' }] }], children: [] });
    return { doc: { ...s.doc, chapters } };
  }),
}));
