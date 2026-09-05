// @vitest-environment node
/**
 * The companion's asset registration reads only inside its public
 * directory. The pipelines pass constant paths, so this is a guard on
 * the guard: a traversal or an absolute path is refused before any read.
 */
import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import { confine, registerCompanionAssets, resetCompanionAssetsForTests } from '../../companion/assets';
import { loadAssetBytes, resolveAssetPath } from '@/lib/assets';
import { registerNodeAssets } from '../node-assets';

afterEach(() => {
  resetCompanionAssetsForTests();
  registerNodeAssets();
});

describe('companion asset confinement', () => {
  it('normalises ordinary relative paths and tolerates a leading slash', () => {
    expect(confine('fonts/LiberationSerif-Regular.ttf')).toBe('fonts/LiberationSerif-Regular.ttf');
    expect(confine('/seals/dod-seal.png')).toBe('seals/dod-seal.png');
    // A leading slash is public-relative, never a filesystem root.
    expect(confine('/etc/passwd')).toBe('etc/passwd');
    expect(confine('templates/./navmc10274/page1.pdf')).toBe('templates/navmc10274/page1.pdf');
  });

  it('refuses traversal, drive-absolute paths, and null bytes', () => {
    for (const bad of ['../package.json', 'fonts/../../package.json', '..', 'C:/Windows/win.ini', 'fonts/\0x']) {
      expect(() => confine(bad), bad).toThrow(/outside the public directory/);
    }
  });

  it('applies the guard to both the loader and the resolver once registered', async () => {
    const root = registerCompanionAssets(path.join(process.cwd(), 'public'));
    expect(resolveAssetPath('fonts/LiberationMono-Regular.ttf')).toBe(path.join(root, 'fonts', 'LiberationMono-Regular.ttf'));
    await expect(loadAssetBytes('../package.json')).rejects.toThrow(/outside the public directory/);
    expect(() => resolveAssetPath('../package.json')).toThrow(/outside the public directory/);
    const bytes = await loadAssetBytes('USMC.png');
    expect(bytes.length).toBeGreaterThan(0);
  });
});
