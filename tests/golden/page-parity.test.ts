/**
 * PHASE 0 PARITY HARNESS — page-fill pagination parity.
 *
 * One fixture sized to spill onto page 2. Assert the PDF pipeline and
 * the DOCX pipeline (rendered via LibreOffice headless) break to page 2
 * at the same paragraph, located by a sentinel string.
 *
 * Honesty contract: if LibreOffice (soffice) is unavailable the DOCX
 * half cannot be rendered and the test FAILS — it does not silently
 * skip. CI installs LibreOffice; run locally on a machine that has it, or
 * accept the failure as "not evaluated here".
 *
 * THE COST OF THAT CONTRACT IS REAL and worth stating beside it: on a
 * developer machine without LibreOffice the suite can never be green, and
 * a permanently red test is how a SECOND red test goes unnoticed. That is
 * an argued tradeoff, not an oversight, and it is why `sofficePath` below
 * works hard to find an existing install before giving up.
 *
 * Baseline: commit 82a6c52. Result at baseline is recorded in
 * tests/golden/PARITY_STATUS.md, red or green, honestly.
 */
import { describe, it, expect, vi } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

vi.mock('@/lib/pdf-fonts', () => import('./pdf-fonts-mock'));

import { generateBasePDFBlob } from '@/lib/pdf-generator';
import { generateDocxBlob } from '@/lib/docx-generator';
import { extractPdfTextLayout, pageOfMarker } from './helpers';
import {
  FIXTURE_FORM_DATA,
  FIXTURE_VIAS,
  FIXTURE_REFERENCES,
  FIXTURE_ENCLOSURES,
  FIXTURE_COPY_TOS,
  PARITY_PARAGRAPHS,
  PARITY_MARKER,
} from './fixture';

/**
 * Locate the LibreOffice binary, on any of the three platforms this repo is
 * developed and built on.
 *
 * THE PATH FALLBACK USED TO BE UNIX-ONLY, and that made this test
 * unpassable on Windows even with LibreOffice installed and on PATH.
 * `which` is not a Windows command: the shell equivalent is `where`, and
 * execFileSync('which', ...) throws ENOENT, which the catch below turned
 * into "soffice not found". The repo's primary development machine is
 * Windows, so the practical effect was that SOFFICE_PATH was the ONLY way
 * to pass, and an install that any other tool would find looked missing.
 *
 * The default install directories are probed too, for the same reason: a
 * normal Windows LibreOffice install does not put soffice on PATH at all,
 * so `where` alone would still miss it.
 */
function sofficePath(): string | null {
  // Explicit override wins. Set SOFFICE_PATH to the full binary path,
  // e.g. on Windows: $env:SOFFICE_PATH="C:\Program Files\LibreOffice\program\soffice.exe"
  const override = process.env.SOFFICE_PATH;
  if (override) {
    if (existsSync(override)) return override;
    throw new Error(`SOFFICE_PATH is set but does not exist: ${override}`);
  }

  const windows = process.platform === 'win32';
  const candidates = windows
    ? [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      ]
    : ['/usr/bin/soffice', '/usr/local/bin/soffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice'];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  // `which` does not exist on Windows. `where` prints one match per line.
  try {
    const found = execFileSync(windows ? 'where' : 'which', ['soffice'], {
      encoding: 'utf8',
    }).trim();
    const first = found.split(/\r?\n/)[0]?.trim() ?? '';
    return first === '' ? null : first;
  } catch {
    return null;
  }
}

describe('Page-fill pagination parity (PDF vs DOCX)', () => {
  it('both pipelines paginate, and break to page 2 at the same paragraph', async () => {
    // --- PDF pipeline ---
    const pdfBlob = await generateBasePDFBlob(
      FIXTURE_FORM_DATA,
      FIXTURE_VIAS,
      FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES,
      FIXTURE_COPY_TOS,
      PARITY_PARAGRAPHS,
      [],
    );
    const pdfLayout = await extractPdfTextLayout(pdfBlob);
    const pdfMarkerPage = pageOfMarker(pdfLayout, PARITY_MARKER);
    const pdfPageCount = Math.max(...pdfLayout.map((i) => i.page));

    expect(pdfPageCount, 'PDF fixture must spill to page 2').toBeGreaterThanOrEqual(2);
    expect(pdfMarkerPage, 'marker must be present in PDF text layer').toBeGreaterThan(0);

    // --- DOCX pipeline, rendered through LibreOffice ---
    const soffice = sofficePath();
    expect(
      soffice,
      'soffice not found. The DOCX half of the parity test cannot run. ' +
        'Install LibreOffice, or set SOFFICE_PATH to the soffice binary if it ' +
        'lives somewhere non-standard. This looks in the default install ' +
        'directories and on PATH first, so an ordinary install needs no ' +
        'environment variable (Windows default: ' +
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe). ' +
        'Or rely on CI. This failure is intentional, not a skip.',
    ).toBeTruthy();

    const docxBlob = await generateDocxBlob(
      FIXTURE_FORM_DATA,
      FIXTURE_VIAS,
      FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES,
      FIXTURE_COPY_TOS,
      PARITY_PARAGRAPHS,
      [],
    );
    const dir = mkdtempSync(path.join(tmpdir(), 'parity-'));
    const docxPath = path.join(dir, 'fixture.docx');
    writeFileSync(docxPath, Buffer.from(await docxBlob.arrayBuffer()));
    execFileSync(soffice!, ['--headless', '--convert-to', 'pdf', '--outdir', dir, docxPath], {
      timeout: 60000,
    });
    const converted = readFileSync(path.join(dir, 'fixture.pdf'));
    const docxLayout = await extractPdfTextLayout(new Blob([converted]));
    const docxMarkerPage = pageOfMarker(docxLayout, PARITY_MARKER);
    const docxPageCount = Math.max(...docxLayout.map((i) => i.page));

    expect(docxPageCount, 'DOCX fixture must spill to page 2').toBeGreaterThanOrEqual(2);
    expect(docxMarkerPage, 'marker must be present in converted DOCX text').toBeGreaterThan(0);

    // --- Parity assertion ---
    expect(
      docxMarkerPage,
      `Pagination divergence: marker lands on PDF page ${pdfMarkerPage} ` +
        `but DOCX (via LibreOffice) page ${docxMarkerPage}`,
    ).toBe(pdfMarkerPage);
  }, 120000);
});
