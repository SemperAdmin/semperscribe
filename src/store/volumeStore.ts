import { create } from 'zustand';
import { applyLevelChange } from './volumeLevels';
import {
  HISTORY_META, emptyStacks, recordStep,
  type HistoryStacks, type VolumeFocusRequest, type VolumeFocusTarget,
} from './volumeHistory';
import type { Appendix, Block, Chapter, Figure, GlossaryEntry, Paragraph, SubPara, VolumeDoc } from '@/lib/schemas/volume-schema';

type ChapterChangeRow = Chapter['changeLog'][number];
type AppendixChangeRow = Appendix['changeLog'][number];

/**
 * Identifies a node in the chapter tree by index path:
 * - `{ chapter }` -> the chapter itself
 * - `{ chapter, section }` -> a section
 * - `{ chapter, section, paragraph }` -> a paragraph
 * - `{ chapter, section, paragraph, sub: [i, j, ...] }` -> a (possibly
 *   nested) sub-paragraph, walked via `children[i].children[j]...`.
 */
export interface VolumePath {
  chapter: number;
  section?: number;
  paragraph?: number;
  sub?: number[];
}

type TreeNode = Chapter | { title: string; body?: Block[] } | Paragraph | SubPara;

function resolveNode(chapters: Chapter[], path: VolumePath): TreeNode {
  const chapter = chapters[path.chapter];
  if (path.section === undefined) return chapter;
  const section = chapter.sections[path.section];
  if (path.paragraph === undefined) return section;
  const paragraph = section.paragraphs[path.paragraph];
  const subPath = path.sub ?? [];
  let node: Paragraph | SubPara = paragraph;
  for (const idx of subPath) node = node.children[idx];
  return node;
}

/** Returns the array containing the addressed node, and its index in it. */
function resolveParent(chapters: Chapter[], path: VolumePath): { list: unknown[]; index: number } {
  if (path.section === undefined) {
    return { list: chapters, index: path.chapter };
  }
  const chapter = chapters[path.chapter];
  if (path.paragraph === undefined) {
    return { list: chapter.sections, index: path.section };
  }
  const section = chapter.sections[path.section];
  const subPath = path.sub ?? [];
  if (subPath.length === 0) {
    return { list: section.paragraphs, index: path.paragraph };
  }
  const paragraph = section.paragraphs[path.paragraph];
  let node: Paragraph | SubPara = paragraph;
  for (let i = 0; i < subPath.length - 1; i++) node = node.children[subPath[i]];
  return { list: node.children, index: subPath[subPath.length - 1] };
}

function normalizeSubParas(subs: SubPara[]): void {
  subs.forEach((sub, idx) => {
    sub.seq = idx + 1;
    normalizeSubParas(sub.children);
  });
}

/**
 * Rewrites every stored `number`/`seq` field to match its array position
 * (1-based), in place. The editor always displays designators computed
 * from array index (per designators.ts), while the PDF layout engine
 * (src/lib/volume/layout.ts) prints designators from these stored fields.
 * Calling this after every structural mutation (add/move/remove) keeps the
 * two in agreement — without it, e.g. deleting section 1 of 2 leaves the
 * survivor at seq:2/index:0, so the editor shows "0101" while the PDF
 * prints "0102".
 */
function normalizeNumbering(chapters: Chapter[]): void {
  chapters.forEach((chapter, ci) => {
    chapter.number = ci + 1;
    chapter.sections.forEach((section, si) => {
      section.seq = si + 1;
      section.paragraphs.forEach((paragraph, pi) => {
        paragraph.seq = pi + 1;
        normalizeSubParas(paragraph.children);
      });
    });
  });
}

/**
 * Task 22: an appendix's `letter` is derived from array position (A, B, C,
 * ...), the same "designators are computed, not authored" convention
 * `normalizeNumbering` already enforces for chapter/section/paragraph
 * numbering - so add/remove keeps every appendix's letter matching its
 * position, exactly like a chapter's `number`.
 */
function normalizeAppendices(appendices: Appendix[]): void {
  appendices.forEach((appendix, i) => {
    appendix.letter = String.fromCharCode(65 + i);
  });
}

export function blankVolume(): VolumeDoc {
  return {
    documentType: 'volume',
    order: { designator: '', policyTitle: '', sponsorCode: '' },
    volume: {
      number: 1, title: '', originalPublicationDate: '', lastUpdatedDate: '',
      distribution: { kind: 'statementA' }, submitChangesTo: 'CMC (JA)\n3000 Marine Corps Pentagon\nWashington, DC 20350-3000',
      sectionPeriod: false, pageBand: 'auto', referencesSummaryPage: true,
    },
    changeLog: [], references: [],
    chapters: [{ number: 1, title: '', changeLog: [], sections: [{ seq: 1, title: '', paragraphs: [] }], figures: [] }],
    appendices: [],
  };
}

/** Options for an edit made through `setDoc`. */
export interface SetDocOptions {
  /** Edits sharing a key within the coalescing window undo as one step (e.g. 'order.designator'). */
  coalesceKey?: string;
}

/** Options for indent/outdent: which control of the node to refocus after it moves. */
export interface LevelChangeOptions {
  control?: string;
}

interface VolumeHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  /** Set by indent/outdent/undo/redo; ChapterTree focuses the named control after commit. */
  focusRequest: VolumeFocusRequest | null;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  /**
   * Replaces the whole document as a NEW document (import, template load):
   * same normalization as setDoc, and the undo history is cleared. Edits
   * use setDoc (recorded) instead.
   */
  loadDoc: (doc: VolumeDoc) => void;
}

interface VolumeActions {
  doc: VolumeDoc;
  /** Replaces the doc as an undoable edit (MetaPanel). Loading a different Volume is `loadDoc`. */
  setDoc: (doc: VolumeDoc, opts?: SetDocOptions) => void;
  updateMeta: (patch: Partial<VolumeDoc['volume']>) => void;
  addChapter: () => void;
  addSection: (chapterIdx: number) => void;
  addParagraph: (chapterIdx: number, sectionIdx: number) => void;
  /** Adds a sub-paragraph under the paragraph or sub-para named by `path`. */
  addSubPara: (path: VolumePath) => void;
  /** Sets (or appends, when `blockIdx === body.length`) a body block. */
  updateBlock: (path: VolumePath, blockIdx: number, block: Block) => void;
  updateNodeTitle: (path: VolumePath, title: string) => void;
  moveNode: (path: VolumePath, dir: -1 | 1) => void;
  removeNode: (path: VolumePath) => void;
  /** One level deeper: becomes the last child of the previous sibling. No-op when blocked. */
  indentNode: (path: VolumePath, opts?: LevelChangeOptions) => void;
  /** One level higher: becomes the next sibling of its parent. No-op when blocked. */
  outdentNode: (path: VolumePath, opts?: LevelChangeOptions) => void;
  // Finding 11: per-chapter change log rows (MetaPanel only ever handled
  // the volume-level changeLog, so a chapter's own change log - the
  // chapter-divider table's data source, layout.ts's layoutChapterDivider -
  // had no authoring path at all).
  addChapterChangeRow: (chapterIdx: number) => void;
  updateChapterChangeRow: (chapterIdx: number, rowIdx: number, patch: Partial<ChapterChangeRow>) => void;
  removeChapterChangeRow: (chapterIdx: number, rowIdx: number) => void;
  // Finding 12: per-chapter figure authoring (release-one scope: image +
  // caption + legend lines; Figure.anchor honoring and size caps are OUT of
  // this wave - figures stay end-of-chapter, per the finding's ruling).
  addFigure: (chapterIdx: number, figure: Omit<Figure, 'number'>) => void;
  updateFigure: (chapterIdx: number, figureIdx: number, patch: Partial<Figure>) => void;
  removeFigure: (chapterIdx: number, figureIdx: number) => void;
  // Task 22: appendix authoring - letter is derived from array position
  // (normalizeAppendices), same convention as a chapter's `number`.
  addAppendix: () => void;
  removeAppendix: (appendixIdx: number) => void;
  updateAppendix: (appendixIdx: number, patch: Partial<Pick<Appendix, 'title'>>) => void;
  /** Sets (or appends, when `blockIdx === blocks.length`) an appendix body block. */
  updateAppendixBlock: (appendixIdx: number, blockIdx: number, block: Block) => void;
  removeAppendixBlock: (appendixIdx: number, blockIdx: number) => void;
  addAppendixChangeRow: (appendixIdx: number) => void;
  updateAppendixChangeRow: (appendixIdx: number, rowIdx: number, patch: Partial<AppendixChangeRow>) => void;
  removeAppendixChangeRow: (appendixIdx: number, rowIdx: number) => void;
  addGlossaryRow: (appendixIdx: number) => void;
  updateGlossaryRow: (appendixIdx: number, rowIdx: number, patch: Partial<GlossaryEntry>) => void;
  removeGlossaryRow: (appendixIdx: number, rowIdx: number) => void;
}

type VolumeState = VolumeActions & VolumeHistoryState;
type SetState = (partial: Partial<VolumeState> | ((s: VolumeState) => Partial<VolumeState>)) => void;

let focusNonce = 0;
const focusRequestFor = (target: VolumeFocusTarget | null): VolumeFocusRequest | null =>
  target ? { ...target, nonce: ++focusNonce } : null;

/**
 * The single history choke point: wraps every action listed in HISTORY_META
 * so that a call which replaces `doc` records the previous doc as an undo
 * step (see volumeHistory.ts for the coalescing rule), and adds
 * undo/redo/clearHistory/loadDoc. Actions stay history-unaware.
 */
function withHistory(set: SetState, get: () => VolumeState, base: VolumeActions): VolumeState {
  const history: HistoryStacks = emptyStacks();
  const flags = () => ({ canUndo: history.past.length > 0, canRedo: history.future.length > 0 });
  const syncFlags = () => {
    const next = flags();
    const s = get();
    if (s.canUndo !== next.canUndo || s.canRedo !== next.canRedo) set(next);
  };

  const wrapped = { ...base } as Record<string, unknown>;
  for (const [name, metaFor] of Object.entries(HISTORY_META)) {
    const action = (base as unknown as Record<string, (...a: unknown[]) => void>)[name];
    wrapped[name] = (...args: unknown[]) => {
      const before = get().doc;
      const requestBefore = get().focusRequest;
      const meta = metaFor(args as never[], before);
      action(...args);
      const after = get();
      if (after.doc === before) return; // no-op (blocked indent, move at an edge)
      const request = after.focusRequest !== requestBefore ? after.focusRequest : null;
      const focusAfter = request ? { path: request.path, control: request.control } : meta.focusAfter;
      recordStep(history, before, meta, focusAfter, Date.now());
      syncFlags();
    };
  }

  const clearHistory = () => {
    Object.assign(history, emptyStacks());
    syncFlags();
  };

  return {
    ...(wrapped as unknown as VolumeActions),
    ...flags(),
    focusRequest: null,
    undo: () => {
      const step = history.past.pop();
      if (!step) return;
      history.future.push({ ...step, doc: get().doc });
      history.lastKey = null;
      set({ doc: step.doc, focusRequest: focusRequestFor(step.focusBefore), ...flags() });
    },
    redo: () => {
      const step = history.future.pop();
      if (!step) return;
      history.past.push({ ...step, doc: get().doc });
      history.lastKey = null;
      set({ doc: step.doc, focusRequest: focusRequestFor(step.focusAfter), ...flags() });
    },
    clearHistory,
    loadDoc: (doc) => {
      base.setDoc(doc); // the unwrapped setter: not recorded
      set({ focusRequest: null });
      clearHistory();
    },
  };
}

export const useVolumeStore = create<VolumeState>((set, get) => withHistory(set, get, {
  doc: blankVolume(),
  // Finding 6: import (useImportExport.ts) and template-load both hand a
  // whole doc straight to setDoc, bypassing the same renumbering every
  // other mutator runs through. A hand-edited/imported file whose seq/number
  // fields drifted from array position (e.g. a survivor left at seq:2 after
  // an external tool removed its sibling) would silently reintroduce the
  // editor/PDF numbering mismatch normalizeNumbering exists to prevent.
  // structuredClone first since normalizeNumbering mutates in place and the
  // caller may still hold a reference to the doc it passed in.
  setDoc: (doc) => set(() => {
    const cloned = structuredClone(doc);
    normalizeNumbering(cloned.chapters);
    normalizeAppendices(cloned.appendices);
    return { doc: cloned };
  }),
  updateMeta: (patch) => set((s) => ({ doc: { ...s.doc, volume: { ...s.doc.volume, ...patch } } })),
  addChapter: () => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    chapters.push({ number: chapters.length + 1, title: '', changeLog: [], sections: [{ seq: 1, title: '', paragraphs: [] }], figures: [] });
    normalizeNumbering(chapters);
    return { doc: { ...s.doc, chapters } };
  }),
  addSection: (ci) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    chapters[ci].sections.push({ seq: chapters[ci].sections.length + 1, title: '', paragraphs: [] });
    normalizeNumbering(chapters);
    return { doc: { ...s.doc, chapters } };
  }),
  addParagraph: (ci, si) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    const paras = chapters[ci].sections[si].paragraphs;
    paras.push({ seq: paras.length + 1, title: '', body: [{ runs: [{ text: '' }] }], children: [] });
    normalizeNumbering(chapters);
    return { doc: { ...s.doc, chapters } };
  }),
  addSubPara: (path) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    const paragraph = chapters[path.chapter].sections[path.section!].paragraphs[path.paragraph!];
    const subPath = path.sub ?? [];
    let container: Paragraph | SubPara = paragraph;
    for (const idx of subPath) container = container.children[idx];
    const depth = subPath.length;
    const style: 'upper' | 'arabic' = depth === 0 ? 'upper' : 'arabic';
    container.children.push({
      seq: container.children.length + 1,
      style,
      title: '',
      body: [{ runs: [{ text: '' }] }],
      children: [],
    });
    normalizeNumbering(chapters);
    return { doc: { ...s.doc, chapters } };
  }),
  updateBlock: (path, blockIdx, block) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    const node = resolveNode(chapters, path) as { body?: Block[] };
    const body = node.body ?? (node.body = []);
    if (blockIdx < body.length) body[blockIdx] = block;
    else body.push(block);
    return { doc: { ...s.doc, chapters } };
  }),
  updateNodeTitle: (path, title) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    const node = resolveNode(chapters, path) as { title?: string };
    node.title = title;
    return { doc: { ...s.doc, chapters } };
  }),
  moveNode: (path, dir) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    const { list, index } = resolveParent(chapters, path);
    const target = index + dir;
    if (target < 0 || target >= list.length) return { doc: s.doc };
    [list[index], list[target]] = [list[target], list[index]];
    normalizeNumbering(chapters);
    return { doc: { ...s.doc, chapters } };
  }),
  removeNode: (path) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    const { list, index } = resolveParent(chapters, path);
    list.splice(index, 1);
    normalizeNumbering(chapters);
    return { doc: { ...s.doc, chapters } };
  }),
  // The moved node remounts at its new path (the tree is keyed by index), so
  // ask the editor to refocus the same control there.
  indentNode: (path, opts) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    const moved = applyLevelChange(chapters, path, 'indent');
    if (!moved) return s;
    normalizeNumbering(chapters);
    return { doc: { ...s.doc, chapters }, focusRequest: focusRequestFor({ path: moved, control: opts?.control ?? 'title' }) };
  }),
  outdentNode: (path, opts) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    const moved = applyLevelChange(chapters, path, 'outdent');
    if (!moved) return s;
    normalizeNumbering(chapters);
    return { doc: { ...s.doc, chapters }, focusRequest: focusRequestFor({ path: moved, control: opts?.control ?? 'title' }) };
  }),
  addChapterChangeRow: (chapterIdx) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    chapters[chapterIdx].changeLog.push({ version: '', pageParagraph: '', summary: '', dateOfChange: '' });
    return { doc: { ...s.doc, chapters } };
  }),
  updateChapterChangeRow: (chapterIdx, rowIdx, patch) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    const row = chapters[chapterIdx].changeLog[rowIdx];
    if (row) chapters[chapterIdx].changeLog[rowIdx] = { ...row, ...patch };
    return { doc: { ...s.doc, chapters } };
  }),
  removeChapterChangeRow: (chapterIdx, rowIdx) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    chapters[chapterIdx].changeLog = chapters[chapterIdx].changeLog.filter((_, i) => i !== rowIdx);
    return { doc: { ...s.doc, chapters } };
  }),
  addFigure: (chapterIdx, figure) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    const figures = chapters[chapterIdx].figures;
    // Finding 12: figure numbering is derived from array position (matches
    // the same "designators are derived, not authored" convention as
    // sections/paragraphs/sub-paragraphs elsewhere in this store).
    figures.push({ ...figure, number: figures.length + 1 });
    return { doc: { ...s.doc, chapters } };
  }),
  updateFigure: (chapterIdx, figureIdx, patch) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    const figure = chapters[chapterIdx].figures[figureIdx];
    if (figure) chapters[chapterIdx].figures[figureIdx] = { ...figure, ...patch };
    return { doc: { ...s.doc, chapters } };
  }),
  removeFigure: (chapterIdx, figureIdx) => set((s) => {
    const chapters = structuredClone(s.doc.chapters);
    chapters[chapterIdx].figures = chapters[chapterIdx].figures
      .filter((_, i) => i !== figureIdx)
      .map((f, i) => ({ ...f, number: i + 1 }));
    return { doc: { ...s.doc, chapters } };
  }),
  addAppendix: () => set((s) => {
    const appendices = structuredClone(s.doc.appendices);
    appendices.push({ letter: '', title: '', changeLog: [], blocks: [] });
    normalizeAppendices(appendices);
    return { doc: { ...s.doc, appendices } };
  }),
  removeAppendix: (appendixIdx) => set((s) => {
    const appendices = structuredClone(s.doc.appendices);
    appendices.splice(appendixIdx, 1);
    normalizeAppendices(appendices);
    return { doc: { ...s.doc, appendices } };
  }),
  updateAppendix: (appendixIdx, patch) => set((s) => {
    const appendices = structuredClone(s.doc.appendices);
    const appendix = appendices[appendixIdx];
    if (appendix) appendices[appendixIdx] = { ...appendix, ...patch };
    return { doc: { ...s.doc, appendices } };
  }),
  updateAppendixBlock: (appendixIdx, blockIdx, block) => set((s) => {
    const appendices = structuredClone(s.doc.appendices);
    const blocks = appendices[appendixIdx].blocks;
    if (blockIdx < blocks.length) blocks[blockIdx] = block;
    else blocks.push(block);
    return { doc: { ...s.doc, appendices } };
  }),
  removeAppendixBlock: (appendixIdx, blockIdx) => set((s) => {
    const appendices = structuredClone(s.doc.appendices);
    appendices[appendixIdx].blocks = appendices[appendixIdx].blocks.filter((_, i) => i !== blockIdx);
    return { doc: { ...s.doc, appendices } };
  }),
  addAppendixChangeRow: (appendixIdx) => set((s) => {
    const appendices = structuredClone(s.doc.appendices);
    appendices[appendixIdx].changeLog.push({ version: '', pageParagraph: '', summary: '', dateOfChange: '' });
    return { doc: { ...s.doc, appendices } };
  }),
  updateAppendixChangeRow: (appendixIdx, rowIdx, patch) => set((s) => {
    const appendices = structuredClone(s.doc.appendices);
    const row = appendices[appendixIdx].changeLog[rowIdx];
    if (row) appendices[appendixIdx].changeLog[rowIdx] = { ...row, ...patch };
    return { doc: { ...s.doc, appendices } };
  }),
  removeAppendixChangeRow: (appendixIdx, rowIdx) => set((s) => {
    const appendices = structuredClone(s.doc.appendices);
    appendices[appendixIdx].changeLog = appendices[appendixIdx].changeLog.filter((_, i) => i !== rowIdx);
    return { doc: { ...s.doc, appendices } };
  }),
  addGlossaryRow: (appendixIdx) => set((s) => {
    const appendices = structuredClone(s.doc.appendices);
    const appendix = appendices[appendixIdx];
    appendix.glossary = [...(appendix.glossary ?? []), { term: '', definition: '' }];
    return { doc: { ...s.doc, appendices } };
  }),
  updateGlossaryRow: (appendixIdx, rowIdx, patch) => set((s) => {
    const appendices = structuredClone(s.doc.appendices);
    const glossary = appendices[appendixIdx].glossary ?? [];
    const row = glossary[rowIdx];
    if (row) glossary[rowIdx] = { ...row, ...patch };
    appendices[appendixIdx].glossary = glossary;
    return { doc: { ...s.doc, appendices } };
  }),
  removeGlossaryRow: (appendixIdx, rowIdx) => set((s) => {
    const appendices = structuredClone(s.doc.appendices);
    appendices[appendixIdx].glossary = (appendices[appendixIdx].glossary ?? []).filter((_, i) => i !== rowIdx);
    return { doc: { ...s.doc, appendices } };
  }),
}));
