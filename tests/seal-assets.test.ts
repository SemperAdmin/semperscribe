/**
 * seal-assets: the letterhead seals as fetched static files.
 *
 * Pins the contract both export pipelines rely on: bytes are real PNGs
 * matching the files under public/seals/, each seal loads once and is
 * shared, the data URL is the shape @react-pdf consumes, a failed load
 * does not poison the cache, and a loader registered on the asset seam
 * beats fetch.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { clearSealCache, loadSealBytes, loadSealDataUrl, SEAL_FILES } from '@/lib/seal-assets';
import { registerAssetLoader } from '@/lib/assets';

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function diskLoader(relativePath: string): Promise<Uint8Array> {
  return Promise.resolve(new Uint8Array(readFileSync(path.join(process.cwd(), 'public', relativePath))));
}

beforeEach(() => {
  registerAssetLoader(diskLoader);
  clearSealCache();
});
afterEach(() => {
  registerAssetLoader(diskLoader);
  clearSealCache();
  vi.restoreAllMocks();
});

describe('seal assets', () => {
  it('loads both seals as PNG bytes identical to the files under public/seals', async () => {
    for (const kind of ['dod', 'navy'] as const) {
      const bytes = await loadSealBytes(kind);
      expect(Array.from(bytes.subarray(0, 4))).toEqual(PNG_MAGIC);
      const onDisk = readFileSync(path.join(process.cwd(), 'public', SEAL_FILES[kind]));
      expect(bytes.length).toBe(onDisk.length);
      expect(Buffer.from(bytes).equals(onDisk)).toBe(true);
    }
  });

  it('loads each seal once and shares the bytes', async () => {
    const loader = vi.fn(diskLoader);
    registerAssetLoader(loader);
    const [a, b] = await Promise.all([loadSealBytes('dod'), loadSealBytes('dod')]);
    await loadSealDataUrl('dod');
    expect(a).toBe(b);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('produces a PNG data URL whose payload decodes back to the bytes', async () => {
    const url = await loadSealDataUrl('navy');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    const decoded = Buffer.from(url.slice('data:image/png;base64,'.length), 'base64');
    expect(decoded.equals(Buffer.from(await loadSealBytes('navy')))).toBe(true);
  });

  it('retries after a failed load instead of caching the failure', async () => {
    let calls = 0;
    registerAssetLoader(async rel => {
      calls += 1;
      if (calls === 1) throw new Error('offline');
      return diskLoader(rel);
    });
    await expect(loadSealBytes('dod')).rejects.toThrow('offline');
    const bytes = await loadSealBytes('dod');
    expect(Array.from(bytes.subarray(0, 4))).toEqual(PNG_MAGIC);
    expect(calls).toBe(2);
  });

  it('falls back to a same-origin fetch under the base path when no loader is registered', async () => {
    registerAssetLoader(null);
    const png = new Uint8Array([...PNG_MAGIC, 1, 2, 3]);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(png, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const bytes = await loadSealBytes('dod');
    expect(Array.from(bytes)).toEqual(Array.from(png));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/seals\/dod-seal\.png$/);
    vi.unstubAllGlobals();
  });

  it('reports a missing file as an error naming the URL and status', async () => {
    registerAssetLoader(null);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    await expect(loadSealBytes('navy')).rejects.toThrow(/seals\/navy-seal\.png returned HTTP 404/);
    vi.unstubAllGlobals();
  });
});
