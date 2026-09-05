// @vitest-environment node
/**
 * PHASE 0 PARITY HARNESS — page-fill pagination parity.
 *
 * One fixture sized to spill onto page 2. Assert the PDF pipeline and
 * the DOCX pipeline (rendered via LibreOffice headless) break to page 2
 * at the same paragraph, located by a sentinel string.
 *
 * Honesty contract: if LibreOffice (soffice) is unavailable the DOCX
 * half cannot be rendered. On CI (CI=true), or when SOFFICE_PATH is set,
 * the test FAILS so a broken runner can never pass by not evaluating.
 * Off CI it SKIPS with a message naming what was not evaluated, so a
 * contributor without LibreOffice sees a green suite plus one honest
 * skip rather than a red suite on first clone. CI installs LibreOffice.
 *
 * Baseline: commit 82a6c52. Result at baseline is recorded in
 * tests/golden/PARITY_STATUS.md, red or green, honestly.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

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

function sofficePath(): string | null {
  // Explicit override wins. Set SOFFICE_PATH to the full binary path,
  // e.g. on Windows: $env:SOFFICE_PATH="C:\Program Files\LibreOffice\program\soffice.exe"
  const override = process.env.SOFFICE_PATH;
  if (override) {
    if (existsSync(override)) return override;
    throw new Error(`SOFFICE_PATH is set but does not exist: ${override}`);
  }
  for (const candidate of ['/usr/bin/soffice', '/usr/local/bin/soffice']) {
    if (existsSync(candidate)) return candidate;
  }
  try {
    const found = execFileSync('which', ['soffice'], { encoding: 'utf8' }).trim();
    return found || null;
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
    const sofficeMissing =
      'soffice not found. The DOCX half of the parity test cannot run. ' +
      'Install LibreOffice and set SOFFICE_PATH to the soffice binary ' +
      '(Windows: C:\\Program Files\\LibreOffice\\program\\soffice.exe), ' +
      'or rely on CI.';
    if (!soffice) {
      // Mandatory where the binary is expected: CI, or an explicit path.
      if (process.env.CI || process.env.SOFFICE_PATH) {
        expect(soffice, sofficeMissing + ' This failure is intentional, not a skip.').toBeTruthy();
      }
      // Off CI: the PDF half above passed. Say what was not evaluated.
      console.warn('[page-parity] SKIPPED DOCX half: ' + sofficeMissing);
      return;
    }

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
    // soffice exits 0 even when it converts nothing (for example when the
    // Writer module is not installed: "source file could not be loaded").
    // Capture its output and check for the PDF, so a broken install fails
    // with the converter's own words rather than a bare ENOENT.
    const sofficeOutput = execFileSync(
      soffice,
      ['--headless', '--convert-to', 'pdf', '--outdir', dir, docxPath],
      { timeout: 60000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const convertedPath = path.join(dir, 'fixture.pdf');
    expect(
      existsSync(convertedPath),
      `soffice ran but wrote no PDF. LibreOffice Writer must be installed (Debian: libreoffice-writer). soffice output: ${sofficeOutput.trim() || '(none)'}`,
    ).toBe(true);
    const converted = readFileSync(convertedPath);
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
