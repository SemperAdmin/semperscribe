import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { useVolumeStore, blankVolume } from '@/store/volumeStore';
import { canIndentNode, canOutdentNode, targetDesignator } from '@/store/volumeLevels';
import { ChapterTree } from '@/components/volume/ChapterTree';
import type { Chapter } from '@/lib/schemas/volume-schema';

const body = (t: string) => [{ runs: [{ text: t }] }];
// Section 1 holds paragraphs P1 (children A, B(children 1)), P2, P3.
function seed() {
  const doc = blankVolume();
  const sp = (seq: number, style: 'upper' | 'arabic', title: string, children: never[] | unknown[] = []) =>
    ({ seq, style, title, body: body(title), children }) as never;
  doc.chapters[0].sections[0].paragraphs = [
    { seq: 1, title: 'P1', body: body('p1'), children: [sp(1, 'upper', 'A'), sp(2, 'upper', 'B', [sp(1, 'arabic', 'B1')])] },
    { seq: 2, title: 'P2', body: body('p2'), children: [sp(1, 'upper', 'P2A')] },
    { seq: 3, title: 'P3', body: body('p3'), children: [] },
  ];
  useVolumeStore.getState().setDoc(doc);
}
const chapters = (): Chapter[] => useVolumeStore.getState().doc.chapters;
const paras = () => chapters()[0].sections[0].paragraphs;
const P = (paragraph: number, sub?: number[]) => ({ chapter: 0, section: 0, paragraph, sub });

beforeEach(seed);
afterEach(cleanup);

describe('volume level rules', () => {
  it('blocks indent at the first sibling, allows elsewhere', () => {
    expect(canIndentNode(chapters(), P(0))).toEqual({ ok: false, reason: 'No paragraph above to nest under' });
    expect(canIndentNode(chapters(), P(0, [0])).ok).toBe(false);
    expect(canIndentNode(chapters(), P(1)).ok).toBe(true);
    expect(canIndentNode(chapters(), P(0, [1])).ok).toBe(true);
  });
  it('blocks outdent at top level only', () => {
    expect(canOutdentNode(chapters(), P(1))).toEqual({ ok: false, reason: 'Already at the top level' });
    expect(canOutdentNode(chapters(), P(0, [1])).ok).toBe(true);
  });
  it('previews target designators', () => {
    expect(targetDesignator(chapters(), P(2), 'indent')).toBe('B.'); // P2 has 1 child -> becomes B.
    expect(targetDesignator(chapters(), P(1), 'indent')).toBe('C.');
    expect(targetDesignator(chapters(), P(0, [1]), 'outdent')).toBe('010102.');
    expect(targetDesignator(chapters(), P(0, [1, 0]), 'outdent')).toBe('C.');
    expect(targetDesignator(chapters(), P(0), 'indent')).toBeNull();
  });
});

describe('volume store indent/outdent', () => {
  it('indents a paragraph as last child of the previous one, with its branch', () => {
    useVolumeStore.getState().indentNode(P(1));
    expect(paras().map((p) => p.title)).toEqual(['P1', 'P3']);
    const kids = paras()[0].children;
    expect(kids.map((k) => k.title)).toEqual(['A', 'B', 'P2']);
    expect(kids[2].style).toBe('upper');
    expect(kids[2].children[0]).toMatchObject({ title: 'P2A', style: 'arabic' });
    expect(paras()[1].seq).toBe(2);
  });
  it('indenting a sub-paragraph nests and restyles to arabic', () => {
    useVolumeStore.getState().indentNode(P(0, [1]));
    const a = paras()[0].children[0];
    expect(a.children.map((c) => c.title)).toEqual(['B']);
    expect(a.children[0].style).toBe('arabic');
    expect(a.children[0].children[0]).toMatchObject({ title: 'B1', style: 'arabic' });
  });
  it('outdents a depth-1 sub-paragraph into a paragraph after its parent, later siblings stay', () => {
    useVolumeStore.getState().outdentNode(P(0, [0])); // A leaves P1; B stays
    expect(paras().map((p) => p.title)).toEqual(['P1', 'A', 'P2', 'P3']);
    expect(paras()[0].children.map((c) => c.title)).toEqual(['B']);
    expect(paras().map((p) => p.seq)).toEqual([1, 2, 3, 4]);
  });
  it('outdenting a deep node restyles its subtree and places it after the parent', () => {
    useVolumeStore.getState().outdentNode(P(0, [1, 0])); // B1 -> sibling of B
    const kids = paras()[0].children;
    expect(kids.map((k) => k.title)).toEqual(['A', 'B', 'B1']);
    expect(kids[2].style).toBe('upper');
  });
  it('blocked calls leave the doc reference untouched', () => {
    const before = useVolumeStore.getState().doc;
    useVolumeStore.getState().indentNode(P(0));
    useVolumeStore.getState().outdentNode(P(1));
    expect(useVolumeStore.getState().doc).toBe(before);
  });
});

describe('ChapterTree indent/outdent buttons', () => {
  it('renders buttons, disables with a reason, and fires', () => {
    render(<ChapterTree />);
    const firstIndent = screen.getByRole('button', { name: 'Indent 010101.' });
    expect(firstIndent).toBeDisabled();
    expect(firstIndent.getAttribute('title')).toBe('No paragraph above to nest under');
    expect(screen.getByRole('button', { name: 'Outdent 010101.' })).toBeDisabled();

    const indent2 = screen.getByRole('button', { name: 'Indent 010102. to C.' });
    expect(indent2).toBeEnabled();
    fireEvent.click(indent2);
    expect(paras().map((p) => p.title)).toEqual(['P1', 'P3']);
    expect(screen.getByRole('status').textContent).toBe('010102. is now C.');
  });
  it('Alt+Shift+Arrow on a title input changes the level', () => {
    render(<ChapterTree />);
    fireEvent.keyDown(screen.getByLabelText('010102. title'), { key: 'ArrowRight', altKey: true, shiftKey: true });
    expect(paras().map((p) => p.title)).toEqual(['P1', 'P3']);
  });
});
