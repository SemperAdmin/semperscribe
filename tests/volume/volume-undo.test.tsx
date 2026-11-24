import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import { useVolumeStore, blankVolume } from '@/store/volumeStore';
import { HISTORY_META, MAX_VOLUME_HISTORY, COALESCE_MS } from '@/store/volumeHistory';
import { ChapterTree } from '@/components/volume/ChapterTree';
import { routeUndo, type UndoControls } from '@/lib/undo-routing';
import { undoShortcutFor } from '@/hooks/useUndoShortcuts';
import type { VolumeDoc } from '@/lib/schemas/volume-schema';

const body = (t: string) => [{ runs: [{ text: t }] }];
// Section 1 holds paragraphs P1 (children A, B), P2, P3.
function seedDoc(): VolumeDoc {
  const doc = blankVolume();
  const sp = (seq: number, title: string) => ({ seq, style: 'upper' as const, title, body: body(title), children: [] });
  doc.chapters[0].sections[0].paragraphs = [
    { seq: 1, title: 'P1', body: body('p1'), children: [sp(1, 'A'), sp(2, 'B')] },
    { seq: 2, title: 'P2', body: body('p2'), children: [] },
    { seq: 3, title: 'P3', body: body('p3'), children: [] },
  ];
  return doc;
}
const store = () => useVolumeStore.getState();
const doc = () => store().doc;
const paras = () => doc().chapters[0].sections[0].paragraphs;
const P = (paragraph: number, sub?: number[]) => ({ chapter: 0, section: 0, paragraph, sub });

let now = 1_000_000;
beforeEach(() => {
  now = 1_000_000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  store().loadDoc(seedDoc());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Runs `action`, then checks undo restores the prior doc and redo the result. */
function expectUndoable(action: () => void) {
  const before = doc();
  action();
  const after = doc();
  expect(after).not.toBe(before);
  expect(store().canUndo).toBe(true);
  store().undo();
  expect(doc()).toEqual(before);
  expect(store().canRedo).toBe(true);
  store().redo();
  expect(doc()).toEqual(after);
}

describe('volume history: structural actions', () => {
  it('starts empty after load', () => {
    expect(store().canUndo).toBe(false);
    expect(store().canRedo).toBe(false);
  });
  it('add (chapter, section, paragraph, sub-paragraph)', () => {
    expectUndoable(() => store().addChapter());
    expectUndoable(() => store().addSection(0));
    expectUndoable(() => store().addParagraph(0, 0));
    expectUndoable(() => store().addSubPara(P(1)));
  });
  it('remove', () => {
    expectUndoable(() => store().removeNode(P(1)));
    store().undo();
    expect(paras().map((p) => p.title)).toEqual(['P1', 'P2', 'P3']);
  });
  it('move', () => {
    expectUndoable(() => store().moveNode(P(2), -1));
    expect(paras().map((p) => p.title)).toEqual(['P1', 'P3', 'P2']);
    store().undo();
    expect(paras().map((p) => p.title)).toEqual(['P1', 'P2', 'P3']);
  });
  it('indent', () => {
    expectUndoable(() => store().indentNode(P(1)));
    expect(paras()[0].children.map((c) => c.title)).toEqual(['A', 'B', 'P2']);
    store().undo();
    expect(paras().map((p) => p.title)).toEqual(['P1', 'P2', 'P3']);
  });
  it('outdent', () => {
    expectUndoable(() => store().outdentNode(P(0, [1])));
    expect(paras().map((p) => p.title)).toEqual(['P1', 'B', 'P2', 'P3']);
    store().undo();
    expect(paras()[0].children.map((c) => c.title)).toEqual(['A', 'B']);
  });
  it('appendix and chapter side panels', () => {
    expectUndoable(() => store().addAppendix());
    expectUndoable(() => store().addChapterChangeRow(0));
  });
  it('a no-op (blocked indent, move past an edge) records nothing', () => {
    store().indentNode(P(0));
    store().moveNode(P(0), -1);
    store().outdentNode(P(0));
    expect(store().canUndo).toBe(false);
  });
  it('structural steps are never coalesced, even back to back', () => {
    store().addChapter();
    store().addChapter();
    store().undo();
    expect(doc().chapters).toHaveLength(2);
  });
});

describe('volume history: text edits and coalescing', () => {
  it('undoes a title edit and a body edit', () => {
    expectUndoable(() => store().updateNodeTitle(P(0), 'New'));
    now += 1000;
    expectUndoable(() => store().updateBlock(P(0), 0, { runs: [{ text: 'changed' }] }));
  });
  it('coalesces a typing burst on one field into one step', () => {
    for (const text of ['x', 'xy', 'xyz', 'xyzw']) {
      store().updateNodeTitle(P(1), text);
      now += COALESCE_MS - 100;
    }
    expect(paras()[1].title).toBe('xyzw');
    store().undo();
    expect(paras()[1].title).toBe('P2');
    expect(store().canUndo).toBe(false);
    store().redo();
    expect(paras()[1].title).toBe('xyzw');
  });
  it('a pause longer than the window starts a new step', () => {
    store().updateNodeTitle(P(1), 'a');
    now += COALESCE_MS + 1;
    store().updateNodeTitle(P(1), 'ab');
    store().undo();
    expect(paras()[1].title).toBe('a');
  });
  it('a different node or field starts a new step', () => {
    store().updateNodeTitle(P(1), 'a');
    store().updateNodeTitle(P(2), 'b');
    store().updateBlock(P(2), 0, { runs: [{ text: 'c' }] });
    store().undo();
    expect(paras()[2].body[0].runs[0].text).toBe('p3');
    expect(paras()[2].title).toBe('b');
    store().undo();
    expect(paras()[2].title).toBe('P3');
    expect(paras()[1].title).toBe('a');
  });
  it('a structural action breaks a burst', () => {
    store().updateNodeTitle(P(1), 'a');
    store().addChapter();
    store().updateNodeTitle(P(1), 'ab');
    store().undo();
    expect(paras()[1].title).toBe('a');
    expect(doc().chapters).toHaveLength(2);
  });
  it('appending a block ("Add text") is structural; editing it is text', () => {
    store().updateBlock(P(1), 1, { runs: [{ text: '' }] });
    store().updateBlock(P(1), 1, { runs: [{ text: 'n' }] });
    store().undo();
    expect(paras()[1].body).toHaveLength(2);
    store().undo();
    expect(paras()[1].body).toHaveLength(1);
  });
  it('setDoc edits with a coalesceKey coalesce (MetaPanel order fields)', () => {
    for (const designator of ['M', 'MC', 'MCO']) {
      store().setDoc({ ...doc(), order: { ...doc().order, designator } }, { coalesceKey: 'order:designator' });
    }
    store().undo();
    expect(doc().order.designator).toBe('');
    expect(store().canUndo).toBe(false);
  });
  it('after an undo, typing starts a fresh step', () => {
    store().updateNodeTitle(P(1), 'a');
    store().undo();
    store().updateNodeTitle(P(1), 'b');
    store().updateNodeTitle(P(1), 'bc');
    store().undo();
    expect(paras()[1].title).toBe('P2');
  });
});

describe('volume history: limits and lifecycle', () => {
  it(`caps history at ${MAX_VOLUME_HISTORY} steps`, () => {
    for (let i = 0; i < MAX_VOLUME_HISTORY + 20; i++) store().addChapter();
    let undos = 0;
    while (store().canUndo) {
      store().undo();
      undos++;
    }
    expect(undos).toBe(MAX_VOLUME_HISTORY);
    expect(doc().chapters).toHaveLength(1 + 20);
  });
  it('a new edit clears redo', () => {
    store().addChapter();
    store().undo();
    expect(store().canRedo).toBe(true);
    store().addSection(0);
    expect(store().canRedo).toBe(false);
    store().redo();
    expect(doc().chapters).toHaveLength(1);
  });
  it('loadDoc (import / template load) clears history', () => {
    store().addChapter();
    store().addChapter();
    store().undo();
    store().loadDoc(blankVolume());
    expect(store().canUndo).toBe(false);
    expect(store().canRedo).toBe(false);
    store().undo();
    expect(doc()).toEqual(blankVolume());
  });
  it('clearHistory empties both stacks without touching the doc', () => {
    store().addChapter();
    store().addChapter();
    store().undo();
    const current = doc();
    store().clearHistory();
    expect(store().canUndo).toBe(false);
    expect(store().canRedo).toBe(false);
    expect(doc()).toBe(current);
  });
  it('every doc-mutating action is recorded (listed in HISTORY_META)', () => {
    const history = new Set(['undo', 'redo', 'clearHistory', 'loadDoc']);
    const actions = Object.entries(store())
      .filter(([k, v]) => typeof v === 'function' && !history.has(k))
      .map(([k]) => k);
    expect(actions.sort()).toEqual(Object.keys(HISTORY_META).sort());
  });
});

describe('volume focus after indent/outdent and undo/redo', () => {
  const owner = (el: Element | null) => (el?.closest('[data-volume-path]') as HTMLElement | null)?.dataset.volumePath;
  const control = (el: Element | null) => (el as HTMLElement | null)?.dataset.volumeControl;

  it('indent via the button keeps focus on the moved node\'s indent button', () => {
    render(<ChapterTree />);
    const btn = screen.getByRole('button', { name: /^Indent 010102\./ });
    btn.focus();
    fireEvent.click(btn);
    expect(owner(document.activeElement)).toBe('0.0.0/2');
    expect(control(document.activeElement)).toBe('indent');
    expect(screen.getByLabelText('C. title')).toHaveValue('P2');
  });

  it('outdent falls back to the title when the same control is now disabled', () => {
    render(<ChapterTree />);
    fireEvent.click(screen.getByRole('button', { name: /^Outdent B\./ }));
    expect(owner(document.activeElement)).toBe('0.0.1');
    expect(control(document.activeElement)).toBe('title');
    expect(document.activeElement).toHaveValue('B');
  });

  it('Alt+Shift+Right from a body textarea keeps focus in that textarea', () => {
    render(<ChapterTree />);
    const text = screen.getByLabelText('010102. text');
    text.focus();
    fireEvent.keyDown(text, { key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(owner(document.activeElement)).toBe('0.0.0/2');
    expect(control(document.activeElement)).toBe('block-0');
    expect(document.activeElement).toHaveValue('p2');
  });

  it('undo/redo of an indent focus the node at its old and new paths', () => {
    render(<ChapterTree />);
    fireEvent.click(screen.getByRole('button', { name: /^Indent 010102\./ }));
    act(() => store().undo());
    expect(owner(document.activeElement)).toBe('0.0.1');
    expect(control(document.activeElement)).toBe('indent');
    act(() => store().redo());
    expect(owner(document.activeElement)).toBe('0.0.0/2');
  });

  it('undo of a text edit focuses that field', () => {
    render(<ChapterTree />);
    act(() => store().updateBlock(P(2), 0, { runs: [{ text: 'edited' }] }));
    (document.activeElement as HTMLElement | null)?.blur();
    act(() => store().undo());
    expect(owner(document.activeElement)).toBe('0.0.2');
    expect(control(document.activeElement)).toBe('block-0');
    expect(document.activeElement).toHaveValue('p3');
  });

  it('a stale request from before mount does not steal focus', () => {
    store().indentNode(P(1));
    render(<ChapterTree />);
    expect(document.activeElement).toBe(document.body);
  });
});

describe('undo routing (header + shortcuts)', () => {
  const controls = (name: string): UndoControls & { calls: string[] } => {
    const calls: string[] = [];
    return { calls, undo: () => calls.push(`${name}:undo`), redo: () => calls.push(`${name}:redo`), canUndo: name === 'volume', canRedo: false };
  };
  it('routes to the Volume history only when a Volume is open', () => {
    const letter = controls('letter');
    const volume = controls('volume');
    expect(routeUndo('volume', letter, volume)).toBe(volume);
    expect(routeUndo('basic', letter, volume)).toBe(letter);
    expect(routeUndo('', letter, volume)).toBe(letter);
    expect(routeUndo(undefined, letter, volume)).toBe(letter);
  });
  it('page.tsx wires the header and shortcuts through routeUndo', async () => {
    const fs = await import('node:fs/promises');
    const src = await fs.readFile('src/app/page.tsx', 'utf8');
    expect(src).toMatch(/routeUndo\(formData\.documentType, letterHistory, volumeHistory\)/);
    expect(src).toMatch(/useUndoShortcuts\(undo, redo\)/);
    expect(src).toMatch(/onUndo=\{undo\}/);
  });
  it('maps Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y and leaves text fields to native undo', () => {
    const div = document.createElement('div');
    const ev = (key: string, mods: Partial<KeyboardEvent> = {}, target: EventTarget = div) =>
      ({ key, ctrlKey: true, metaKey: false, shiftKey: false, target, ...mods }) as KeyboardEvent;
    expect(undoShortcutFor(ev('z'))).toBe('undo');
    expect(undoShortcutFor(ev('Z', { shiftKey: true }))).toBe('redo');
    expect(undoShortcutFor(ev('y'))).toBe('redo');
    expect(undoShortcutFor(ev('z', { ctrlKey: false, metaKey: true }))).toBe('undo');
    expect(undoShortcutFor(ev('z', { ctrlKey: false }))).toBeNull();
    expect(undoShortcutFor(ev('z', {}, document.createElement('textarea')))).toBeNull();
    expect(undoShortcutFor(ev('z', {}, document.createElement('input')))).toBeNull();
  });
});
