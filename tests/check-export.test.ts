/**
 * Unit tests for scripts/check-export.mjs, the guard against the
 * Windows Next 16.3.4 export defect measured 2026-09-09 (a nested
 * route's RSC prefetch payload written as a directory instead of the
 * file the browser requests). See CHANGELOG.md "Fixed, 2026-09-09".
 */
import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkExport } from '../scripts/check-export.mjs';

describe('checkExport', () => {
  let dir = '';

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = '';
  });

  it('passes a correctly-shaped Linux export', () => {
    dir = mkdtempSync(join(tmpdir(), 'check-export-ok-'));
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    writeFileSync(join(dir, 'index.txt'), '1:{}');
    writeFileSync(join(dir, '__next.__PAGE__.txt'), '1:{}');

    mkdirSync(join(dir, 'privacy'), { recursive: true });
    writeFileSync(join(dir, 'privacy', 'index.html'), '<html></html>');
    writeFileSync(join(dir, 'privacy', 'index.txt'), '1:{}');
    writeFileSync(join(dir, 'privacy', '__next.privacy.__PAGE__.txt'), '1:{}');

    // The 404 alias page has index.html but no index.txt and no
    // __PAGE__ file on a real Linux build; it must not be flagged.
    mkdirSync(join(dir, '404'), { recursive: true });
    writeFileSync(join(dir, '404', 'index.html'), '<html></html>');

    mkdirSync(join(dir, '_next', 'static'), { recursive: true });
    writeFileSync(join(dir, '_next', 'static', 'x.js'), '// js');

    mkdirSync(join(dir, 'nginx', 'conf', 'includes'), { recursive: true });
    writeFileSync(join(dir, 'nginx', 'conf', 'includes', 'security-headers.conf'), '# headers');

    const result = checkExport(dir);
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
  });

  it('fails on the Windows RSC-payload-as-directory defect', () => {
    dir = mkdtempSync(join(tmpdir(), 'check-export-windows-'));
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    writeFileSync(join(dir, 'index.txt'), '1:{}');
    writeFileSync(join(dir, '__next.__PAGE__.txt'), '1:{}');

    mkdirSync(join(dir, 'privacy'), { recursive: true });
    writeFileSync(join(dir, 'privacy', 'index.html'), '<html></html>');
    writeFileSync(join(dir, 'privacy', 'index.txt'), '1:{}');
    // The defect: __next.privacy is a DIRECTORY holding __PAGE__.txt,
    // instead of a FILE named __next.privacy.__PAGE__.txt.
    mkdirSync(join(dir, 'privacy', '__next.privacy'), { recursive: true });
    writeFileSync(join(dir, 'privacy', '__next.privacy', '__PAGE__.txt'), '1:{}');

    const result = checkExport(dir);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.includes('__next.privacy'))).toBe(true);
  });

  it('fails when a route directory has no RSC prefetch payload file', () => {
    dir = mkdtempSync(join(tmpdir(), 'check-export-missing-payload-'));
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    writeFileSync(join(dir, 'index.txt'), '1:{}');
    writeFileSync(join(dir, '__next.__PAGE__.txt'), '1:{}');

    mkdirSync(join(dir, 'dynamic-forms'), { recursive: true });
    writeFileSync(join(dir, 'dynamic-forms', 'index.html'), '<html></html>');
    writeFileSync(join(dir, 'dynamic-forms', 'index.txt'), '1:{}');
    // No __next.dynamic-forms.__PAGE__.txt written at all.

    const result = checkExport(dir);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.includes('dynamic-forms'))).toBe(true);
  });

  it('fails when out/index.html is missing', () => {
    dir = mkdtempSync(join(tmpdir(), 'check-export-no-index-'));
    // Directory exists (the build ran) but produced no index.html.

    const result = checkExport(dir);
    expect(result.ok).toBe(false);
    expect(result.problems.some((p) => p.toLowerCase().includes('index.html'))).toBe(true);
  });
});
