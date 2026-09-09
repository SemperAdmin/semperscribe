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
 *   4. The bytes go to a temp file beside the target, opened with
 *      O_CREAT|O_EXCL|O_NOFOLLOW so a name collision or a planted link
 *      at the temp name fails at the open. Once every byte is written
 *      and fsynced the temp file is renamed over the target. rename never
 *      follows a symbolic link at the destination and never replaces a
 *      directory, and the target is lstat-checked first so both refusals
 *      keep their own error rather than surfacing as a rename failure.
 *
 * The rename is the atomicity guarantee (AUDIT P6-14): a failure at any
 * point before it leaves the target exactly as it was, and the temp file
 * is unlinked on the way out. A caller told about a path finds a whole
 * file there, never a truncated one.
 *
 * Absolute paths and traversal both fail rule 2 or rule 3. Directories
 * are never created: the caller writes into a directory it prepared.
 *
 * Refusals name the rule, not the directory (AUDIT P6-20). The real
 * paths go to the companion's own log; the response body carries the
 * code and a generic line, so the filesystem layout of the host never
 * leaves the process.
 */
import { randomBytes } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { lstat, open, realpath, rename, unlink, type FileHandle } from 'node:fs/promises';
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

/**
 * Logs the real reason, with the paths, and throws the caller-facing
 * refusal without them.
 */
function reject(message: string, logDetail: Record<string, unknown> = {}): never {
  console.error(`[companion] output path rejected: ${message}`, logDetail);
  throw new CompanionError('output_path_rejected', 400, message);
}

/** The part of a FileHandle the write needs. A test seam for injecting a mid-write failure. */
export type OutputWriter = (
  handle: Pick<FileHandle, 'write'>,
  bytes: Uint8Array,
) => Promise<void>;

const defaultWriter: OutputWriter = async (handle, bytes) => {
  let offset = 0;
  while (offset < bytes.byteLength) {
    const { bytesWritten } = await handle.write(bytes, offset, bytes.byteLength - offset);
    offset += bytesWritten;
  }
};

export interface WriteOutputOptions {
  /** Replaces the byte-level write. Tests use it to fail part way through. */
  writer?: OutputWriter;
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
  options: WriteOutputOptions = {},
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
    console.error(`[companion] COMPANION_OUT_DIR does not exist: ${configuredDir}`);
    throw new CompanionError(
      'output_not_configured',
      400,
      'COMPANION_OUT_DIR does not exist. See the companion log for the directory.',
    );
  }

  const target = path.resolve(base, requested);
  if (!isInside(base, target) || target === base) {
    reject('Output path resolves outside COMPANION_OUT_DIR', { requested, outDir: base });
  }

  let parentReal: string;
  try {
    parentReal = await realpath(path.dirname(target));
  } catch {
    reject('Output directory for that path does not exist', { requested, outDir: base });
  }
  if (!isInside(base, parentReal)) {
    reject('Output path resolves outside COMPANION_OUT_DIR through a link', {
      requested,
      outDir: base,
      resolved: parentReal,
    });
  }

  const finalPath = path.join(parentReal, path.basename(target));
  // What sits at the target now decides whether the rename may happen.
  // rename would not follow a link or replace a directory anyway; the
  // check is here so each refusal keeps its own message.
  try {
    const existing = await lstat(finalPath);
    if (existing.isSymbolicLink()) reject('Output path is a symbolic link', { finalPath });
    if (existing.isDirectory()) reject('Output path is a directory', { finalPath });
    if (!existing.isFile()) reject('Output path is not a regular file', { finalPath });
  } catch (error) {
    if (error instanceof CompanionError) throw error;
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    // Nothing there yet: the rename creates it.
  }

  const tempPath = `${finalPath}.tmp-${process.pid}-${randomBytes(6).toString('hex')}`;
  const { O_WRONLY, O_CREAT, O_EXCL, O_NOFOLLOW } = fsConstants;
  const handle = await open(tempPath, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, 0o644);
  const writer = options.writer ?? defaultWriter;
  try {
    await writer(handle, bytes);
    await handle.sync();
    await handle.close();
    await rename(tempPath, finalPath);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
  return finalPath;
}
