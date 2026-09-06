/**
 * Points the asset seam at public/ on disk. Used by tests/setup.ts and
 * by the Node-environment render test; the headless companion performs
 * the same registration against its own public directory.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { registerAssetLoader, registerAssetPathResolver } from '@/lib/assets';

export function publicDir(): string {
  return path.join(process.cwd(), 'public');
}

export function registerNodeAssets(root: string = publicDir()): void {
  registerAssetPathResolver((relativePath) => path.join(root, relativePath));
  registerAssetLoader(async (relativePath) => {
    const bytes = await readFile(path.join(root, relativePath));
    return new Uint8Array(bytes);
  });
}
