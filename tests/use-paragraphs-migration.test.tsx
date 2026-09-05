/**
 * useParagraphs: legacy level 0 paragraphs become level 1, in the initial
 * state and on every later write, in the same render (Phase A.4).
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useParagraphs } from '@/hooks/useParagraphs';

describe('useParagraphs level migration', () => {
  it('corrects level 0 in the initial paragraphs', () => {
    const { result } = renderHook(() => useParagraphs([
      { id: 1, level: 0, content: 'legacy' },
      { id: 2, level: 2, content: 'sub' },
    ]));
    expect(result.current.paragraphs.map(p => p.level)).toEqual([1, 2]);
  });

  it('corrects level 0 arriving through setParagraphs', () => {
    const { result } = renderHook(() => useParagraphs());
    act(() => result.current.setParagraphs([{ id: 7, level: 0, content: 'imported' }]));
    expect(result.current.paragraphs).toEqual([{ id: 7, level: 1, content: 'imported' }]);
  });

  it('keeps array identity when nothing needs correcting', () => {
    const { result } = renderHook(() => useParagraphs());
    const list = [{ id: 1, level: 1, content: 'ok' }];
    act(() => result.current.setParagraphs(list));
    expect(result.current.paragraphs).toBe(list);
  });
});
