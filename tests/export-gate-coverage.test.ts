/**
 * Every path that writes a document out of the browser runs the
 * sensitive-data prompt first (owner's ruling of 2026-10-21: a warning on
 * every export, never a block, never a rewrite of the user's text).
 *
 * The check is static: each source file that mints a download URL must
 * call clearedForExport itself, or be named below with the reason it is
 * covered elsewhere. A new download site fails here until it is gated or
 * explained.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');

/** Files that mint a URL without calling the gate, and why that is right. */
const COVERED_ELSEWHERE: Record<string, string> = {
  'src/hooks/useLivePreview.ts': 'the blob URL feeds the preview iframe; nothing is written to disk',
  'src/lib/blob-utils.ts': 'helper that turns bytes into a URL; every caller is a gated path',
  'src/services/export/index.ts': 'downloadDocument runs under useDocumentExport, after its gate',
  'src/services/docx/i-type-docx.ts': 'called from downloadDocument, after the gate',
  'src/services/pdf/i-type-export.ts': 'called from downloadDocument, after the gate',
  'src/components/signature/SignatureCeremonyPanel.tsx': 'saves the signed PDF the gated sign-ready path produced',
  'src/components/layout/LivePreview.tsx': 'Download delegates to the gated export; the raw fallback runs only with no export handler wired',
};

describe('export gate coverage', () => {
  it('every file that mints a download URL calls clearedForExport or is accounted for', () => {
    const out = execFileSync('git', ['grep', '-l', 'createObjectURL', '--', 'src'], { cwd: ROOT, encoding: 'utf8' });
    const files = out.split('\n').filter(Boolean);
    expect(files.length).toBeGreaterThan(5);
    const ungated = files.filter((f) => {
      if (COVERED_ELSEWHERE[f]) return false;
      const text = readFileSync(join(ROOT, f), 'utf8');
      return !text.includes('clearedForExport(');
    });
    expect(ungated, `download sites without the sensitive-data prompt: ${ungated.join(', ')}`).toEqual([]);
  });

  it('the folder backup is gated too, though it writes through the File System Access API', () => {
    const text = readFileSync(join(ROOT, 'src/lib/auto-backup.ts'), 'utf8');
    expect(text).toContain('clearedForExport(letter)');
  });
});
