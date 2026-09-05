/**
 * B.5 (HARDENING_PLAN_2026-09): the military dictionary is fetched on
 * demand. Source contract on the validators, and the hook's enabled gate.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderHook, act, cleanup } from '@testing-library/react';

const load = vi.fn(() => Promise.resolve([{ term: 'ABSENT WITHOUT LEAVE', meaning: 'AWOL' }]));
vi.mock('@/lib/reference-data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/reference-data')>()),
  loadMilitaryDictionary: () => load(),
}));

import { useMilitaryDictionary } from '@/hooks/useReferenceData';

afterEach(() => { cleanup(); load.mockClear(); });

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const valueImportsOf = (src: string) =>
  [...src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+['"]([^'"]+)['"]/gms)].map(m => m[1]);

describe('dictionary module boundary', () => {
  it('is never a value import of the validators or the page', () => {
    for (const file of ['src/lib/acronym-validators.ts', 'src/lib/letter-validators.ts', 'src/app/page.tsx']) {
      expect(valueImportsOf(read(file)), file).not.toContain('@/lib/military-dictionary');
    }
  });
});

describe('useMilitaryDictionary(enabled)', () => {
  it('holds the fetch while disabled and runs it once enabled', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useMilitaryDictionary(enabled), {
      initialProps: { enabled: false },
    });
    expect(load).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
    rerender({ enabled: true });
    await act(async () => { await Promise.resolve(); });
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.dictionary).toHaveLength(1);
    expect(result.current.loading).toBe(false);
  });
});
