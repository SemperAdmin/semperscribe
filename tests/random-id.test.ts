// @vitest-environment node
/**
 * randomId backs the autosave session, document copy and NJP base-file
 * ids. CodeQL flagged the old Math.random fallback in all three
 * (js/insecure-randomness, 2026-09-26); this pins that every path is a
 * cryptographic source and that the fallback keeps the UUID shape.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { randomId } from '@/lib/random-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => vi.unstubAllGlobals());

describe('randomId', () => {
  it('uses crypto.randomUUID when present', () => {
    const id = randomId();
    expect(id).toMatch(UUID);
    expect(new Set(Array.from({ length: 50 }, randomId)).size).toBe(50);
  });

  it('falls back to getRandomValues, shaped as a version 4 UUID', () => {
    const getRandomValues = vi.fn((arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i += 1) arr[i] = (i * 37 + 11) & 0xff;
      return arr;
    });
    vi.stubGlobal('crypto', { getRandomValues });
    const id = randomId();
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(id).toMatch(UUID);
  });

  it('never reaches for Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    vi.stubGlobal('crypto', { getRandomValues: (a: Uint8Array) => a.fill(1) });
    randomId();
    expect(spy).not.toHaveBeenCalled();
    vi.stubGlobal('crypto', undefined);
    expect(() => randomId()).toThrow(/random source/);
    expect(spy).not.toHaveBeenCalled();
  });
});
