/**
 * Optional write of a rendered file to disk.
 *
 * The companion writes nothing unless COMPANION_OUT_DIR is set, and when
 * it is set the write is confined to that directory. Confinement is
 * checked against real paths, not the text of the request:
 *
 *   1. The output directory itself is resolved through realpath, so a
 *      symlinked out-dir is compared by where it truly lands.
 *   2. The requested name is resolved against that real base, which
 *      collapses `..` segments before any check runs.
 *   3. The parent directory of the target is resolved through realpath
 *      and must still sit inside the base. A symlinked subdirectory
 *      pointing out of the base fails here.
 *   4. The file is opened with O_NOFOLLOW, so a planted symbolic link at
 *      the target fails at the open itself rather than in a check the
 *      link could be swapped in after. A directory fails the same way.
 *
 * Absolute paths and traversal both fail rule 2 or rule 3. Directories
 * are never created: the caller writes into a directory it prepared.
 */
import { constants as fsConstants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { CompanionError } from './errors';

/** The configured output directory, or null when writes are disabled. */
export function outputDir(): string | null {
  const raw = process.env.COMPANION_OUT_DIR;
  if (raw === undefined || raw.trim() === '') return null;
  return path.resolve(raw.trim());
}

/**
 * True when `child` is the base itself or sits under it. Decided through
 * path.relative rather than a string prefix, so a base which is a prefix
 * of a sibling name (`/out` against `/out2`) and platform case rules are
 * handled by the path module, not by this code.
 */
function isInside(base: string, child: string): boolean {
  if (child === base) return true;
  const relative = path.relative(base, child);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function reject(message: string, details: Record<string, unknown> = {}): never {
  throw new CompanionError('output_path_rejected', 400, message, details);
}

/**
 * Writes `bytes` to `requested` under the configured output directory and
 * returns the absolute path written. Throws a CompanionError when writes
 * are not configured or the path escapes the directory.
 */
export async function writeOutput(
  requested: string,
  bytes: Uint8Array,
  configuredDir: string | null = outputDir(),
): Promise<string> {
  if (configuredDir === null) {
    throw new CompanionError(
      'output_not_configured',
      400,
      'Writing output files is off. Set COMPANION_OUT_DIR to turn it on.',
    );
  }
  if (typeof requested !== 'string' || requested.trim() === '') {
    reject('Output path is empty');
  }
  if (requested.includes('\0')) {
    reject('Output path contains a null byte');
  }

  let base: string;
  try {
    base = await realpath(configuredDir);
  } catch {
    throw new CompanionError(
      'output_not_configured',
      400,
      `COMPANION_OUT_DIR ${configuredDir} does not exist`,
    );
  }

  const target = path.resolve(base, requested);
  if (!isInside(base, target) || target === base) {
    reject('Output path resolves outside COMPANION_OUT_DIR', { outDir: base });
  }

  let parentReal: string;
  try {
    parentReal = await realpath(path.dirname(target));
  } catch {
    reject('Output directory for that path does not exist', { outDir: base });
  }
  if (!isInside(base, parentReal)) {
    reject('Output path resolves outside COMPANION_OUT_DIR through a link', { outDir: base });
  }

  const finalPath = path.join(parentReal, path.basename(target));
  // One open decides everything about the target: O_NOFOLLOW refuses a
  // symbolic link (ELOOP), a directory refuses O_WRONLY (EISDIR), and a
  // regular file is created or truncated. There is no check-then-write
  // window for a link to be swapped into.
  const { O_WRONLY, O_CREAT, O_TRUNC, O_NOFOLLOW } = fsConstants;
  let handle;
  try {
    handle = await open(finalPath, O_WRONLY | O_CREAT | O_TRUNC | O_NOFOLLOW, 0o644);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ELOOP') reject('Output path is a symbolic link', { outDir: base });
    if (code === 'EISDIR') reject('Output path is a directory', { outDir: base });
    throw error;
  }
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
  return finalPath;
}
