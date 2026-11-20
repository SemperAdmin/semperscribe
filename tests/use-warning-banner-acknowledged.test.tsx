import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useWarningBannerAcknowledged } from '@/hooks/useWarningBannerAcknowledged';

const KEY = 'semperscribe.warningBannerAcknowledged';

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useWarningBannerAcknowledged', () => {
  it('starts unacknowledged', () => {
    const { result } = renderHook(() => useWarningBannerAcknowledged());
    expect(result.current.acknowledged).toBe(false);
  });

  it('acknowledges for the session only, never in localStorage', () => {
    const { result } = renderHook(() => useWarningBannerAcknowledged());
    act(() => result.current.acknowledge());
    expect(result.current.acknowledged).toBe(true);
    expect(sessionStorage.getItem(KEY)).toBe('1');
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('restores the banner and clears the session flag', () => {
    sessionStorage.setItem(KEY, '1');
    const { result } = renderHook(() => useWarningBannerAcknowledged());
    expect(result.current.acknowledged).toBe(true);
    act(() => result.current.restore());
    expect(result.current.acknowledged).toBe(false);
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('shows the banner when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useWarningBannerAcknowledged());
    expect(result.current.acknowledged).toBe(false);
    act(() => result.current.acknowledge());
    expect(result.current.acknowledged).toBe(true);
  });
});
