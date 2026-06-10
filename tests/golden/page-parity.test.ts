/**
 * PHASE 0 PARITY HARNESS — page-fill pagination parity.
 *
 * One fixture sized to spill onto page 2. Assert the PDF pipeline and
 * the DOCX pipeline (rendered via LibreOffice headless) break to page 2
 * at the same paragraph, located by a sentinel string.
 *
 * Honesty contract: if LibreOffice (soffice) is unavailable the DOCX
 * half cannot be rendered and the test FAILS — it does not silently
 * skip. CI installs LibreOffice; run locally inside an environment that
 * has soffice on PATH, or accept the failure as "not evaluated here".
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
    expect(
      soffice,
      'soffice not found. The DOCX half of the parity test cannot run. ' +
        'Install LibreOffice and set SOFFICE_PATH to the soffice binary ' +
        '(Windows: C:\\Program Files\\LibreOffice\\program\\soffice.exe), ' +
        'or rely on CI. This failure is intentional, not a skip.',
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
