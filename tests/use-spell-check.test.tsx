/**
 * useSpellCheck: issues clear in the render where the text empties or the
 * check is disabled, stay put while text is edited, and refresh after the
 * debounce (Phase A.4).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/reference-data', () => ({
  loadMilitaryWordSet: () => Promise.resolve(new Set(['USMC', 'MARINE'])),
}));

import { useSpellCheck } from '@/hooks/useSpellCheck';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// Two act scopes: the first lets React commit the word-set arrival (and
// re-arm the debounce from that commit), the second runs the debounce.
async function settle() {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
}

describe('useSpellCheck', () => {
  it('reports unknown words after the debounce', async () => {
    const { result } = renderHook(({ text }) => useSpellCheck(text, true, 100), {
      initialProps: { text: 'The Teh Marine' },
    });
    expect(result.current.issues).toEqual([]);
    await settle();
    expect(result.current.issues.map(i => i.word)).toEqual(['Teh']);
  });

  it('clears immediately when the text empties, and keeps stale issues while typing', async () => {
    const { result, rerender } = renderHook(({ text }) => useSpellCheck(text, true, 100), {
      initialProps: { text: 'Teh' },
    });
    await settle();
    expect(result.current.issues).toHaveLength(1);

    rerender({ text: 'Teh quik' });
    expect(result.current.issues).toHaveLength(1);
    await settle();
    expect(result.current.issues.map(i => i.word)).toEqual(['Teh', 'quik']);

    rerender({ text: '' });
    expect(result.current.issues).toEqual([]);
  });

  it('clears immediately when disabled and resumes when re-enabled', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useSpellCheck('Teh', enabled, 100),
      { initialProps: { enabled: true } },
    );
    await settle();
    expect(result.current.issues).toHaveLength(1);
    rerender({ enabled: false });
    expect(result.current.issues).toEqual([]);
    rerender({ enabled: true });
    expect(result.current.issues).toEqual([]);
    await settle();
    expect(result.current.issues).toHaveLength(1);
  });
});
