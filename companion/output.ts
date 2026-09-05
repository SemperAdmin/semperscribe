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
 *   4. An existing target is inspected with lstat and refused when it is
 *      a symlink, so a planted link is never followed by the write.
 *
 * Absolute paths and traversal both fail rule 2 or rule 3. Directories
 * are never created: the caller writes into a directory it prepared.
 */
import { lstat, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CompanionError } from './errors';

/** The configured output directory, or null when writes are disabled. */
export function outputDir(): string | null {
  const raw = process.env.COMPANION_OUT_DIR;
  if (raw === undefined || raw.trim() === '') return null;
  return path.resolve(raw.trim());
}

/** True when `child` is the base itself or sits under it. */
function isInside(base: string, child: string): boolean {
  if (child === base) return true;
  return child.startsWith(base.endsWith(path.sep) ? base : base + path.sep);
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
  try {
    const existing = await lstat(finalPath);
    if (existing.isSymbolicLink()) {
      reject('Output path is a symbolic link', { outDir: base });
    }
    if (existing.isDirectory()) {
      reject('Output path is a directory', { outDir: base });
    }
  } catch (error) {
    // ENOENT is the ordinary case: the file does not exist yet.
    if (error instanceof CompanionError) throw error;
  }

  await writeFile(finalPath, bytes);
  return finalPath;
}
