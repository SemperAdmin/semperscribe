/**
 * useParagraphs: indent and outdent an existing paragraph (Feature A).
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useParagraphs, getUiCitation, canIndent, canOutdent, getBranchEnd } from '@/hooks/useParagraphs';
import type { ParagraphData } from '@/types';

const p = (id: number, level: number, extra: Partial<ParagraphData> = {}): ParagraphData =>
  ({ id, level, content: `p${id}`, ...extra });

function setup(list: ParagraphData[]) {
  return renderHook(() => useParagraphs(list));
}

const cites = (list: ParagraphData[]) => list.map((x, i) => getUiCitation(x, i, list));

describe('getBranchEnd', () => {
  it('stops at the first paragraph at or above the level', () => {
    const list = [p(1, 1), p(2, 1), p(3, 2), p(4, 3), p(5, 2), p(6, 1)];
    expect(getBranchEnd(list, 1)).toBe(5);
    expect(getBranchEnd(list, 2)).toBe(4);
    expect(getBranchEnd(list, 5)).toBe(6);
  });
});

describe('indentParagraph', () => {
  it('turns sibling 2. into 1a with its children following', () => {
    const { result } = setup([p(1, 1), p(2, 1), p(3, 2), p(4, 1)]);
    act(() => result.current.indentParagraph(2));
    expect(result.current.paragraphs.map(x => x.level)).toEqual([1, 2, 3, 1]);
    expect(cites(result.current.paragraphs)).toEqual(['1.', '1a', '1a(1)', '2.']);
  });

  it('lands as 1c after two existing sub-paragraphs', () => {
    const { result } = setup([p(1, 1), p(2, 2), p(3, 2), p(4, 1)]);
    act(() => result.current.indentParagraph(4));
    expect(cites(result.current.paragraphs)[3]).toBe('1c');
  });

  it('renumbers paragraphs after the branch', () => {
    const { result } = setup([p(1, 1), p(2, 1), p(3, 1), p(4, 1)]);
    expect(cites(result.current.paragraphs)).toEqual(['1.', '2.', '3.', '4.']);
    act(() => result.current.indentParagraph(2));
    expect(cites(result.current.paragraphs)).toEqual(['1.', '1a', '2.', '3.']);
  });

  it('is blocked at index 0', () => {
    const list = [p(1, 1), p(2, 1)];
    const { result } = setup(list);
    expect(canIndent(list, 0).ok).toBe(false);
    act(() => result.current.indentParagraph(1));
    expect(result.current.paragraphs).toBe(list);
  });

  it('is blocked on a level jump', () => {
    const list = [p(1, 1), p(2, 2), p(3, 2)];
    const jump = [p(1, 1), p(2, 2), p(3, 3)];
    expect(canIndent(list, 1).ok).toBe(false);
    expect(canIndent(jump, 2).ok).toBe(false);
    const { result } = setup(jump);
    const before = result.current.paragraphs;
    act(() => result.current.indentParagraph(3));
    expect(result.current.paragraphs).toBe(before);
  });

  it('is blocked when a branch member would exceed level 8', () => {
    const list = [p(1, 7), p(2, 7), p(3, 8)];
    const { result } = setup(list);
    expect(canIndent(list, 1).ok).toBe(false);
    act(() => result.current.indentParagraph(2));
    expect(result.current.paragraphs).toBe(list);
  });

  it('honours a max level of 4', () => {
    const atLimit = [p(1, 3), p(2, 3), p(3, 4)];
    expect(canIndent(atLimit, 1, 4).ok).toBe(false); // child would reach 5
    expect(canIndent(atLimit, 1, 8).ok).toBe(true);
    expect(canIndent([p(1, 3), p(2, 4)], 1, 4).ok).toBe(false);
    expect(canIndent([p(1, 3), p(2, 3)], 1, 4).ok).toBe(true);
    const { result } = setup(atLimit);
    act(() => result.current.indentParagraph(2, 4));
    expect(result.current.paragraphs).toBe(atLimit);
  });

  it('is blocked for mandatory and titled paragraphs', () => {
    const list = [p(1, 1), p(2, 1, { isMandatory: true }), p(3, 1, { title: 'AGREEMENT' })];
    expect(canIndent(list, 1)).toEqual({ ok: false, reason: expect.any(String) });
    expect(canIndent(list, 2).ok).toBe(false);
    const { result } = setup(list);
    act(() => result.current.indentParagraph(2));
    act(() => result.current.indentParagraph(3));
    expect(result.current.paragraphs).toBe(list);
  });
});

describe('outdentParagraph', () => {
  it('turns 1c into 2. with its children following', () => {
    const { result } = setup([p(1, 1), p(2, 2), p(3, 2), p(4, 2), p(5, 3)]);
    act(() => result.current.outdentParagraph(4));
    expect(result.current.paragraphs.map(x => x.level)).toEqual([1, 2, 2, 1, 2]);
    expect(cites(result.current.paragraphs)).toEqual(['1.', '1a', '1b', '2.', '2a']);
  });

  it('is blocked at level 1', () => {
    const list = [p(1, 1), p(2, 1)];
    const { result } = setup(list);
    expect(canOutdent(list, 1).ok).toBe(false);
    act(() => result.current.outdentParagraph(2));
    expect(result.current.paragraphs).toBe(list);
  });

  it('is blocked for mandatory and titled paragraphs', () => {
    const list = [p(1, 1), p(2, 2, { isMandatory: true }), p(3, 2, { title: 'X' })];
    expect(canOutdent(list, 1).ok).toBe(false);
    expect(canOutdent(list, 2).ok).toBe(false);
    const { result } = setup(list);
    act(() => result.current.outdentParagraph(2));
    act(() => result.current.outdentParagraph(3));
    expect(result.current.paragraphs).toBe(list);
  });

  it('ignores an unknown id', () => {
    const list = [p(1, 1), p(2, 2)];
    const { result } = setup(list);
    act(() => result.current.outdentParagraph(99));
    act(() => result.current.indentParagraph(99));
    expect(result.current.paragraphs).toBe(list);
  });
});
