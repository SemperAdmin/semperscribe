import type { Paragraph, SubPara, VolumeDoc } from '@/lib/schemas/volume-schema';
import type { VolumePath } from './volumeStore';

/**
 * Undo/redo history for the Volume document (useVolumeStore).
 *
 * The store's mutators each replace `doc` with a fresh object (they clone
 * before mutating), so a snapshot is just the previous `doc` reference - no
 * deep copy. History is recorded in ONE place: `withHistory` (volumeStore.ts)
 * wraps every action named in `HISTORY_META` after the store is built,
 * compares `doc` before/after the call, and pushes a step when it changed.
 * The actions themselves know nothing about history.
 *
 * Coalescing: a text edit carries a key (node + field). A text edit whose key
 * equals the previous step's key, within COALESCE_MS of the previous edit,
 * extends that step instead of starting a new one, so a typing burst undoes
 * as one step. Structural actions (add/remove/move/indent/outdent, setDoc
 * without a key) carry no key and always start a new step - and break any
 * running burst.
 */

export const MAX_VOLUME_HISTORY = 100;
export const COALESCE_MS = 500;

/** Which control to focus: a node (by path) and a control inside it. */
export interface VolumeFocusTarget {
  path: VolumePath;
  /** data-volume-control value inside the node: 'title', 'block-0', 'indent', ... */
  control?: string;
}

/** A focus request the editor acts on after commit; `nonce` makes repeats distinct. */
export interface VolumeFocusRequest extends VolumeFocusTarget {
  nonce: number;
}

export interface HistoryStep {
  /** The doc on the other side of the step (before it in `past`, after it in `future`). */
  doc: VolumeDoc;
  focusBefore: VolumeFocusTarget | null;
  focusAfter: VolumeFocusTarget | null;
}

export interface StepMeta {
  /** Non-null for text edits that may coalesce. */
  coalesceKey: string | null;
  focusBefore: VolumeFocusTarget | null;
  focusAfter: VolumeFocusTarget | null;
}

/** Stable string form of a VolumePath; used for data-volume-path and coalescing keys. */
export function volumePathKey(path: VolumePath): string {
  const parts = [path.chapter, path.section, path.paragraph].filter((n): n is number => n !== undefined);
  const base = parts.join('.');
  return path.sub && path.sub.length > 0 ? `${base}/${path.sub.join('.')}` : base;
}

const keysOf = (patch: object | undefined) => Object.keys(patch ?? {}).sort().join(',');
const at = (path: VolumePath, control = 'title'): VolumeFocusTarget => ({ path, control });
const none: StepMeta = { coalesceKey: null, focusBefore: null, focusAfter: null };

function bodyLength(doc: VolumeDoc, path: VolumePath): number {
  const chapter = doc.chapters[path.chapter];
  if (!chapter || path.section === undefined) return 0;
  const section = chapter.sections[path.section];
  if (!section) return 0;
  if (path.paragraph === undefined) return section.body?.length ?? 0;
  let node: Paragraph | SubPara | undefined = section.paragraphs[path.paragraph];
  for (const i of path.sub ?? []) node = node?.children[i];
  return node?.body.length ?? 0;
}

type MetaFn = (args: never[], before: VolumeDoc) => StepMeta;

/**
 * Per-action history metadata. Every doc-mutating action must appear here
 * (volume-undo.test.ts checks that) or its edits would not be undoable.
 */
export const HISTORY_META: Record<string, MetaFn> = {
  setDoc: (args) => {
    const opts = (args as unknown as [unknown, { coalesceKey?: string } | undefined])[1];
    return { ...none, coalesceKey: opts?.coalesceKey ? `doc:${opts.coalesceKey}` : null };
  },
  updateMeta: (args) => ({ ...none, coalesceKey: `meta:${keysOf((args as unknown as [object])[0])}` }),
  addChapter: (_args, before) => ({ ...none, focusAfter: at({ chapter: before.chapters.length }) }),
  addSection: (args, before) => {
    const [ci] = args as unknown as [number];
    return { ...none, focusBefore: at({ chapter: ci }), focusAfter: at({ chapter: ci, section: before.chapters[ci]?.sections.length ?? 0 }) };
  },
  addParagraph: (args, before) => {
    const [ci, si] = args as unknown as [number, number];
    const len = before.chapters[ci]?.sections[si]?.paragraphs.length ?? 0;
    return { ...none, focusBefore: at({ chapter: ci, section: si }), focusAfter: at({ chapter: ci, section: si, paragraph: len }) };
  },
  addSubPara: (args, before) => {
    const [path] = args as unknown as [VolumePath];
    const section = before.chapters[path.chapter]?.sections[path.section ?? -1];
    let node = section?.paragraphs[path.paragraph ?? -1] as { children: unknown[] } | undefined;
    for (const i of path.sub ?? []) node = node?.children[i] as { children: unknown[] } | undefined;
    const len = node?.children.length ?? 0;
    return { ...none, focusBefore: at(path), focusAfter: at({ ...path, sub: [...(path.sub ?? []), len] }) };
  },
  updateBlock: (args, before) => {
    const [path, bi] = args as unknown as [VolumePath, number];
    const target = at(path, `block-${bi}`);
    // Appending ("Add text") is structural; editing an existing block is text.
    const appending = bi >= bodyLength(before, path);
    return {
      coalesceKey: appending ? null : `block:${volumePathKey(path)}:${bi}`,
      focusBefore: appending ? at(path) : target,
      focusAfter: target,
    };
  },
  updateNodeTitle: (args) => {
    const [path] = args as unknown as [VolumePath];
    return { coalesceKey: `title:${volumePathKey(path)}`, focusBefore: at(path), focusAfter: at(path) };
  },
  moveNode: (args) => {
    const [path, dir] = args as unknown as [VolumePath, -1 | 1];
    const moved: VolumePath = path.section === undefined ? { chapter: path.chapter + dir }
      : path.paragraph === undefined ? { ...path, section: path.section + dir }
        : (path.sub ?? []).length === 0 ? { ...path, paragraph: path.paragraph + dir }
          : { ...path, sub: [...path.sub!.slice(0, -1), path.sub![path.sub!.length - 1] + dir] };
    return { ...none, focusBefore: at(path), focusAfter: at(moved) };
  },
  removeNode: (args) => ({ ...none, focusBefore: at((args as unknown as [VolumePath])[0]) }),
  // indent/outdent set their own focusRequest (the moved node's new path);
  // withHistory uses it as focusAfter.
  indentNode: (args) => {
    const [path, opts] = args as unknown as [VolumePath, { control?: string } | undefined];
    return { ...none, focusBefore: at(path, opts?.control ?? 'title') };
  },
  outdentNode: (args) => {
    const [path, opts] = args as unknown as [VolumePath, { control?: string } | undefined];
    return { ...none, focusBefore: at(path, opts?.control ?? 'title') };
  },
  addChapterChangeRow: () => none,
  updateChapterChangeRow: (args) => {
    const [ci, ri, patch] = args as unknown as [number, number, object];
    return { ...none, coalesceKey: `cclog:${ci}:${ri}:${keysOf(patch)}` };
  },
  removeChapterChangeRow: () => none,
  addFigure: () => none,
  updateFigure: (args) => {
    const [ci, fi, patch] = args as unknown as [number, number, object];
    return { ...none, coalesceKey: `fig:${ci}:${fi}:${keysOf(patch)}` };
  },
  removeFigure: () => none,
  addAppendix: () => none,
  removeAppendix: () => none,
  updateAppendix: (args) => {
    const [ai, patch] = args as unknown as [number, object];
    return { ...none, coalesceKey: `app:${ai}:${keysOf(patch)}` };
  },
  updateAppendixBlock: (args, before) => {
    const [ai, bi] = args as unknown as [number, number];
    const appending = bi >= (before.appendices[ai]?.blocks.length ?? 0);
    return { ...none, coalesceKey: appending ? null : `appblock:${ai}:${bi}` };
  },
  removeAppendixBlock: () => none,
  addAppendixChangeRow: () => none,
  updateAppendixChangeRow: (args) => {
    const [ai, ri, patch] = args as unknown as [number, number, object];
    return { ...none, coalesceKey: `aclog:${ai}:${ri}:${keysOf(patch)}` };
  },
  removeAppendixChangeRow: () => none,
  addGlossaryRow: () => none,
  updateGlossaryRow: (args) => {
    const [ai, ri, patch] = args as unknown as [number, number, object];
    return { ...none, coalesceKey: `gloss:${ai}:${ri}:${keysOf(patch)}` };
  },
  removeGlossaryRow: () => none,
};

/** Mutable history kept outside reactive state (only canUndo/canRedo are reactive). */
export interface HistoryStacks {
  past: HistoryStep[];
  future: HistoryStep[];
  lastKey: string | null;
  lastAt: number;
}

export function emptyStacks(): HistoryStacks {
  return { past: [], future: [], lastKey: null, lastAt: 0 };
}

/**
 * Records one completed action. Returns true when the change extended the
 * previous step (coalesced) rather than pushing a new one.
 */
export function recordStep(h: HistoryStacks, before: VolumeDoc, meta: StepMeta, focusAfter: VolumeFocusTarget | null, now: number): boolean {
  h.future = [];
  const coalesce = meta.coalesceKey !== null
    && meta.coalesceKey === h.lastKey
    && now - h.lastAt <= COALESCE_MS
    && h.past.length > 0;
  if (coalesce) {
    h.past[h.past.length - 1].focusAfter = focusAfter;
  } else {
    h.past.push({ doc: before, focusBefore: meta.focusBefore, focusAfter });
    if (h.past.length > MAX_VOLUME_HISTORY) h.past.shift();
  }
  h.lastKey = meta.coalesceKey;
  h.lastAt = now;
  return coalesce;
}
