/**
 * Points the asset seam (src/lib/assets.ts) at this checkout's public
 * directory, so the export pipelines read fonts, seals, form blanks, and
 * NAVMC template pages from disk instead of fetching them from an origin
 * the companion does not have.
 *
 * This mirrors tests/node-assets.ts. It is a deliberate copy rather than
 * an import: the companion ships as its own entry point and must not
 * depend on the test tree.
 *
 * The directory is `<cwd>/public` by default, which is what the
 * `npm run companion` and `npm run companion:mcp` scripts give it. Set
 * COMPANION_PUBLIC_DIR to run the companion from somewhere else.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { registerAssetLoader, registerAssetPathResolver } from '@/lib/assets';

/** The public directory the companion reads assets from. */
export function companionPublicDir(): string {
  const override = process.env.COMPANION_PUBLIC_DIR;
  if (override && override.trim() !== '') {
    return path.resolve(override.trim());
  }
  return path.join(process.cwd(), 'public');
}

let registeredRoot: string | null = null;

/**
 * Every asset path the pipelines ask for is a constant in src/ (fonts,
 * seals, form blanks, template pages) and never comes from a request.
 * The check below keeps it so: a path which is absolute or which climbs
 * out of the public directory is refused before any read.
 */
export function confine(relativePath: string): string {
  // A leading slash means "relative to public/", the seam's own contract
  // (src/lib/assets.ts strips it the same way), so it is dropped before
  // the checks rather than treated as an absolute path.
  const normalised = path.posix.normalize(relativePath.replace(/\\/g, '/').replace(/^\/+/, ''));
  if (
    /^[A-Za-z]:/.test(normalised) ||
    normalised === '..' ||
    normalised.startsWith('../') ||
    normalised.includes('/../') ||
    normalised.includes('\0')
  ) {
    throw new Error(`Asset path ${JSON.stringify(relativePath)} is outside the public directory`);
  }
  return normalised;
}

/**
 * Registers the disk loader and path resolver. Idempotent: repeated
 * calls with the same root do nothing, so every entry point calls it
 * without coordinating.
 */
export function registerCompanionAssets(root: string = companionPublicDir()): string {
  if (registeredRoot === root) return registeredRoot;
  if (!existsSync(path.join(root, 'fonts'))) {
    throw new Error(
      `Companion asset directory ${root} has no fonts/ subdirectory. ` +
        'Run the companion from the repository root, or set COMPANION_PUBLIC_DIR ' +
        'to the public directory of a SemperScribe checkout.',
    );
  }
  registerAssetPathResolver((relativePath) => path.join(root, confine(relativePath)));
  registerAssetLoader(async (relativePath) => {
    const bytes = await readFile(path.join(root, confine(relativePath)));
    return new Uint8Array(bytes);
  });
  registeredRoot = root;
  return root;
}

/** Test seam. Drops the memo so the next call registers again. */
export function resetCompanionAssetsForTests(): void {
  registeredRoot = null;
}
