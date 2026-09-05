/**
 * useSpellCheck after D.6: the pass reports acronym expansions and nothing
 * else. English spelling is the browser's job, so ordinary prose draws no
 * flags. Issues clear in the render where the text empties or the check is
 * disabled, stay put while text is edited, and refresh after the debounce
 * (Phase A.4).
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useSpellCheck } from '@/hooks/useSpellCheck';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// Two act scopes: the first lets React commit the mount and run the effect
// which arms the debounce, the second runs the debounce itself. Collapsing
// them runs the timer before the effect has armed it.
async function settle() {
  await act(async () => { await Promise.resolve(); });
  await act(async () => { await vi.advanceTimersByTimeAsync(150); });
}

// The 48-word paragraph from the audit (docs audit-ux, finding 4). The
// old pass reported six false positives here, among them "approval",
// "third", "eighty-two", "sourced" and "organically".
const AUDIT_PARAGRAPH =
  'The command requests approval to fill the third vacancy on the current ' +
  'unit roster. Eighty-two personnel completed the required course this ' +
  'quarter. The equipment was sourced through the normal wholesale supply ' +
  'chain, and the remaining shortfall will be organically resourced within ' +
  'existing means before the fiscal year closes.';

describe('useSpellCheck', () => {
  it('reports nothing for ordinary English prose', async () => {
    expect(AUDIT_PARAGRAPH.split(/\s+/)).toHaveLength(48);
    const { result } = renderHook(() => useSpellCheck(AUDIT_PARAGRAPH, true, 100));
    await settle();
    expect(result.current.issues).toEqual([]);
  });

  it('suggests the expansion for an acronym in the text', async () => {
    const { result } = renderHook(() => useSpellCheck('Submit the request per MCO 1500.', true, 100));
    await settle();
    expect(result.current.issues).toHaveLength(1);
    const [issue] = result.current.issues;
    expect(issue.word).toBe('MCO');
    expect(issue.type).toBe('acronym-suggestion');
    expect(issue.suggestion).toBe('Marine Corps Order (MCO)');
    expect(issue.index).toBe('Submit the request per '.length);
  });

  it('leaves an acronym alone once the paragraph spells it out', async () => {
    const { result } = renderHook(
      () => useSpellCheck('Per Marine Corps Order (MCO) 1500, MCO guidance applies.', true, 100),
    );
    await settle();
    expect(result.current.issues).toEqual([]);
  });

  it('reports each acronym once and ignores lowercase prose', async () => {
    const { result } = renderHook(
      () => useSpellCheck('The TAD order and the second TAD order cover the tad period.', true, 100),
    );
    await settle();
    expect(result.current.issues.map(i => i.word)).toEqual(['TAD']);
  });

  it('reports nothing until the debounce elapses', async () => {
    const { result } = renderHook(() => useSpellCheck('Submit the MCO.', true, 100));
    expect(result.current.issues).toEqual([]);
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(result.current.issues).toEqual([]);
    await settle();
    expect(result.current.issues).toHaveLength(1);
  });

  it('clears immediately when the text empties, and keeps stale issues while typing', async () => {
    const { result, rerender } = renderHook(({ text }) => useSpellCheck(text, true, 100), {
      initialProps: { text: 'The MCO applies.' },
    });
    await settle();
    expect(result.current.issues).toHaveLength(1);

    rerender({ text: 'The MCO applies. The PCS orders' });
    expect(result.current.issues).toHaveLength(1);
    await settle();
    expect(result.current.issues.map(i => i.word)).toEqual(['MCO', 'PCS']);

    rerender({ text: '' });
    expect(result.current.issues).toEqual([]);
  });

  it('clears immediately when disabled and resumes when re-enabled', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useSpellCheck('The MCO applies.', enabled, 100),
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
