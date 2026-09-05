// @vitest-environment node
/**
 * Output confinement. The companion writes a rendered file only under
 * COMPANION_OUT_DIR, and only where the real path still lands inside it.
 * Traversal, an absolute path, a planted symlink, and a symlinked
 * subdirectory are each refused.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CompanionError } from '../../companion/errors';
import { outputDir, writeOutput } from '../../companion/output';

const BYTES = new Uint8Array([1, 2, 3, 4]);

let base: string;
let outside: string;

beforeEach(async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'companion-out-'));
  base = path.join(root, 'allowed');
  outside = path.join(root, 'forbidden');
  await mkdir(base);
  await mkdir(outside);
});

afterEach(async () => {
  delete process.env.COMPANION_OUT_DIR;
  await rm(path.dirname(base), { recursive: true, force: true });
});

async function expectRejected(requested: string): Promise<CompanionError> {
  try {
    await writeOutput(requested, BYTES, base);
    throw new Error(`expected ${requested} to be refused`);
  } catch (error) {
    expect(error).toBeInstanceOf(CompanionError);
    return error as CompanionError;
  }
}

describe('outputDir', () => {
  it('is null until COMPANION_OUT_DIR is set', () => {
    expect(outputDir()).toBeNull();
  });

  it('resolves the configured directory to an absolute path', () => {
    process.env.COMPANION_OUT_DIR = base;
    expect(outputDir()).toBe(path.resolve(base));
  });

  it('refuses to write at all when nothing is configured', async () => {
    try {
      await writeOutput('letter.pdf', BYTES, null);
      throw new Error('expected the write to be refused');
    } catch (error) {
      expect((error as CompanionError).code).toBe('output_not_configured');
    }
  });
});

describe('writeOutput', () => {
  it('writes a plain name into the directory', async () => {
    const written = await writeOutput('letter.pdf', BYTES, base);
    expect(path.dirname(written)).toBe(path.resolve(base));
    expect(new Uint8Array(await readFile(written))).toEqual(BYTES);
  });

  it('writes into a subdirectory the caller prepared', async () => {
    await mkdir(path.join(base, 'batch'));
    const written = await writeOutput('batch/letter.pdf', BYTES, base);
    expect(written).toBe(path.join(path.resolve(base), 'batch', 'letter.pdf'));
  });

  it('refuses a traversal out of the directory', async () => {
    const error = await expectRejected('../escape.pdf');
    expect(error.code).toBe('output_path_rejected');
    expect(error.status).toBe(400);
  });

  it('refuses a deeper traversal which lands back inside a sibling', async () => {
    const error = await expectRejected('a/../../forbidden/escape.pdf');
    expect(error.code).toBe('output_path_rejected');
  });

  it('refuses an absolute path outside the directory', async () => {
    const error = await expectRejected(path.join(outside, 'escape.pdf'));
    expect(error.code).toBe('output_path_rejected');
  });

  it('refuses a symbolic link planted in the directory', async () => {
    const victim = path.join(outside, 'victim.pdf');
    await writeFile(victim, 'original');
    await symlink(victim, path.join(base, 'link.pdf'));
    const error = await expectRejected('link.pdf');
    expect(error.code).toBe('output_path_rejected');
    expect(await readFile(victim, 'utf8')).toBe('original');
  });

  it('refuses a path through a symlinked subdirectory', async () => {
    await symlink(outside, path.join(base, 'elsewhere'));
    const error = await expectRejected('elsewhere/escape.pdf');
    expect(error.code).toBe('output_path_rejected');
  });

  it('refuses a directory which does not exist rather than creating it', async () => {
    const error = await expectRejected('missing/letter.pdf');
    expect(error.code).toBe('output_path_rejected');
  });

  it('refuses an empty path and a null byte', async () => {
    expect((await expectRejected('   ')).code).toBe('output_path_rejected');
    expect((await expectRejected('bad\0name.pdf')).code).toBe('output_path_rejected');
  });
});
