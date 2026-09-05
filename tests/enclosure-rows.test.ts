/**
 * B.4 (HARDENING_PLAN_2026-09): the enclosure row model is importable
 * without pdf-lib. The page and the section import enclosure-rows, and
 * enclosure-rows itself reaches neither pdf-lib nor the merge engine.
 * A source-level contract, so the unit suite catches a regression before
 * the build-output check in the smoke test does.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { newRow, reconcileRows, computeMergeItems, fileToAttachment } from '@/lib/enclosure-rows';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const importsOf = (src: string) => [...src.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(m => m[1]);

describe('enclosure-rows module boundary', () => {
  it('exports the row helpers and the file reader', () => {
    expect(typeof newRow).toBe('function');
    expect(typeof reconcileRows).toBe('function');
    expect(typeof computeMergeItems).toBe('function');
    expect(typeof fileToAttachment).toBe('function');
  });

  it('imports neither pdf-lib nor the merge engine', () => {
    const imports = importsOf(read('src/lib/enclosure-rows.ts'));
    expect(imports).not.toContain('pdf-lib');
    expect(imports.some(i => i.includes('enclosure-attachments'))).toBe(false);
  });

  it('is what the page and the enclosures section import statically', () => {
    for (const file of ['src/app/page.tsx', 'src/components/letter/EnclosuresSection.tsx']) {
      const imports = importsOf(read(file));
      expect(imports, file).toContain('@/lib/enclosure-rows');
      expect(imports.filter(i => i.includes('enclosure-attachments')), file).toEqual([]);
    }
  });

  it('keeps jszip out of the batch hook\'s static imports', () => {
    expect(importsOf(read('src/hooks/useBatchGenerate.ts'))).not.toContain('jszip');
  });
});
