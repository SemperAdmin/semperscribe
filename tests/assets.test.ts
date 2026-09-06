/**
 * The static asset seam (src/lib/assets.ts): one registration decides
 * whether public/ files come from a same-origin fetch or from disk, and
 * every export pipeline reads through it. The headless companion depends
 * on this contract, so it is pinned here.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  assetUrl,
  hasAssetLoader,
  loadAssetBytes,
  loadOptionalAssetBytes,
  registerAssetLoader,
  registerAssetPathResolver,
  resolveAssetPath,
} from '@/lib/assets';
import { getFullFontUrl } from '@/lib/pdf-fonts';
import { officialFormAsset, officialFormPath } from '@/lib/xfa-form-fill';
import { registerNodeAssets } from './node-assets';

afterEach(() => {
  registerNodeAssets();
  vi.unstubAllGlobals();
});

describe('asset seam', () => {
  it('the suite registers a disk loader and resolver rooted at public/', async () => {
    expect(hasAssetLoader()).toBe(true);
    const bytes = await loadAssetBytes('USMC.png');
    const onDisk = readFileSync(path.join(process.cwd(), 'public', 'USMC.png'));
    expect(Buffer.from(bytes).equals(onDisk)).toBe(true);
    expect(resolveAssetPath('fonts/LiberationSerif-Regular.ttf'))
      .toBe(path.join(process.cwd(), 'public', 'fonts', 'LiberationSerif-Regular.ttf'));
  });

  it('strips a leading slash so callers can pass either form', async () => {
    const a = await loadAssetBytes('/USMC.png');
    const b = await loadAssetBytes('USMC.png');
    expect(a.length).toBe(b.length);
    expect(assetUrl('/seals/dod-seal.png')).toBe('/seals/dod-seal.png');
  });

  it('font registration reads through the resolver, so @react-pdf gets a file path under Node', () => {
    expect(getFullFontUrl('/fonts/LiberationMono-Regular.ttf'))
      .toBe(path.join(process.cwd(), 'public', 'fonts', 'LiberationMono-Regular.ttf'));
  });

  it('with no resolver and no window, a path consumer gets the origin-relative URL', () => {
    registerAssetPathResolver(null);
    const saved = globalThis.window;
    // @ts-expect-error simulate Node
    delete globalThis.window;
    try {
      expect(resolveAssetPath('fonts/LiberationSerif-Bold.ttf')).toBe('/fonts/LiberationSerif-Bold.ttf');
    } finally {
      globalThis.window = saved;
    }
  });

  it('with no resolver in a browser, a path consumer gets the absolute URL under the base path', () => {
    registerAssetPathResolver(null);
    expect(resolveAssetPath('fonts/LiberationSerif-Bold.ttf'))
      .toBe(`${window.location.origin}/fonts/LiberationSerif-Bold.ttf`);
  });

  it('falls back to fetch under the base path when no loader is registered', async () => {
    registerAssetLoader(null);
    expect(hasAssetLoader()).toBe(false);
    const payload = new Uint8Array([1, 2, 3]);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => new Response(payload, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(Array.from(await loadAssetBytes('templates/navmc11811/page1.pdf'))).toEqual([1, 2, 3]);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/templates/navmc11811/page1.pdf');
  });

  it('a failed fetch throws with the URL and status, and the optional loader turns it into null', async () => {
    registerAssetLoader(null);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    await expect(loadAssetBytes('forms/navmc-10274-blank.pdf'))
      .rejects.toThrow(/forms\/navmc-10274-blank\.pdf returned HTTP 404/);
    expect(await loadOptionalAssetBytes('forms/navmc-10274-blank.pdf')).toBeNull();
  });

  it('the optional loader also swallows a loader exception', async () => {
    registerAssetLoader(async () => { throw new Error('disk gone'); });
    expect(await loadOptionalAssetBytes('USMC.png')).toBeNull();
    await expect(loadAssetBytes('USMC.png')).rejects.toThrow('disk gone');
  });

  it('official form blanks resolve to real files under public/forms', () => {
    for (const type of ['aa-form', 'page11', 'navmc10922', 'navmc10132']) {
      const asset = officialFormAsset(type);
      expect(asset).toMatch(/^forms\/.*\.pdf$/);
      expect(() => readFileSync(path.join(process.cwd(), 'public', asset!))).not.toThrow();
      expect(officialFormPath(type)).toBe(`/${asset}`);
    }
    expect(officialFormAsset('basic')).toBeNull();
  });
});
