/**
 * PHASE 0 PARITY HARNESS — page-fill pagination parity.
 *
 * One fixture sized to spill onto page 2. Assert the PDF pipeline and
 * the DOCX pipeline (rendered via LibreOffice headless) break to page 2
 * at the same paragraph, located by a sentinel string.
 *
 * HONESTY CONTRACT, REVISED 2026-08-25. The DOCX half needs LibreOffice.
 * The original contract failed the test hard wherever soffice was missing,
 * on the principle that a parity claim nobody evaluated must never look
 * evaluated. That principle is right. The mechanism was too blunt.
 *
 * WHAT WENT WRONG WITH IT. On a developer machine without LibreOffice the
 * suite could never go green, so the developer learned to read past one
 * known red. On 2026-08-25 a Windows run carried this failure AND an
 * unrelated 30-second timeout, and the second one nearly went unremarked
 * behind the first. A permanently red test does not enforce honesty, it
 * spends the attention that enforcing honesty depends on.
 *
 * WHAT REPLACED IT, and the guarantee is unchanged where it counts:
 *
 *   - CI installs LibreOffice (.github/workflows/test.yml) and runs the
 *     parity assertion on every push and every pull request. If soffice is
 *     missing THERE, the test still fails hard. CI is not allowed to not
 *     know.
 *   - Locally, without soffice, the DOCX assertion is SKIPPED and its test
 *     NAME carries the reason, so the run prints what was not evaluated and
 *     where it still is. Visible, not silent.
 *   - The PDF half was split out and now runs everywhere. Under the old
 *     structure a machine without soffice lost those assertions too,
 *     because the combined test aborted at the soffice check before
 *     reaching them. Less LibreOffice, MORE local coverage.
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

/**
 * Resolved once, at collection time, because `it.skipIf` needs the answer
 * before the suite runs.
 */
const SOFFICE = sofficePath();

/**
 * GitHub Actions sets CI=true, as does every other runner worth naming. The
 * distinction this file turns on is not "is LibreOffice here" but "is this
 * the run that is ALLOWED to not know". CI is not allowed to not know.
 */
const IN_CI = process.env.CI === 'true' || process.env.CI === '1';

const SOFFICE_MISSING_MESSAGE =
  'soffice not found. The DOCX half of the pagination parity test cannot run. ' +
  'Install LibreOffice, or set SOFFICE_PATH to the soffice binary if it lives ' +
  'somewhere non-standard. This looks in the default install directories and on ' +
  'PATH first, so an ordinary install needs no environment variable (Windows ' +
  'default: C:\\Program Files\\LibreOffice\\program\\soffice.exe).';

const SKIPPING_DOCX_HALF = !SOFFICE && !IN_CI;

/**
 * THE REASON RIDES IN THE TEST NAME, and that is not decoration.
 *
 * The first version of this put the reason in a module-scope
 * `console.warn`. Vitest's default reporter swallowed it: the run printed
 * "1 passed | 1 skipped" and nothing else, so a developer learned that
 * something was skipped but never what, or why, or where it still runs.
 * That is the silent skip the honesty contract exists to forbid, wearing a
 * different hat. Verified swallowed on 2026-08-25 before switching to this.
 *
 * A test title cannot be swallowed. It prints on the skipped line, in every
 * reporter, and it survives being read six months from now by someone who
 * has never opened this file.
 */
const DOCX_TEST_NAME = SKIPPING_DOCX_HALF
  ? 'the DOCX pipeline breaks to page 2 at the same paragraph as the PDF ' +
    '[NOT EVALUATED HERE: LibreOffice is not installed. CI installs it and runs ' +
    'this same assertion on every push and pull request]'
  : 'the DOCX pipeline breaks to page 2 at the same paragraph as the PDF';

/**
 * Renders the PDF fixture once and memoizes it, so splitting the original
 * single test in two does not pay for the render twice.
 */
let pdfResultPromise: Promise<{ markerPage: number; pageCount: number }> | null = null;
function pdfResult() {
  pdfResultPromise ??= (async () => {
    const pdfBlob = await generateBasePDFBlob(
      FIXTURE_FORM_DATA,
      FIXTURE_VIAS,
      FIXTURE_REFERENCES,
      FIXTURE_ENCLOSURES,
      FIXTURE_COPY_TOS,
      PARITY_PARAGRAPHS,
      [],
    );
    const layout = await extractPdfTextLayout(pdfBlob);
    return {
      markerPage: pageOfMarker(layout, PARITY_MARKER),
      pageCount: Math.max(...layout.map((i) => i.page)),
    };
  })();
  return pdfResultPromise;
}

describe('Page-fill pagination parity (PDF vs DOCX)', () => {
  // Needs no LibreOffice, so it runs everywhere. It used to live inside the
  // combined test, which meant a machine without soffice lost these
  // assertions too: the test aborted at the soffice check before ever
  // reaching them. Splitting keeps half the coverage instead of none.
  it('the PDF pipeline spills to page 2 and carries the sentinel', async () => {
    // RAW STDERR, NOT console.warn, AND THAT IS THE WHOLE POINT OF THIS
    // LINE. Vitest 4's default reporter swallows console output from a
    // passing test AND from module scope: with console.warn here, a plain
    // `npm test` printed "1 passed | 1 skipped" and nothing else, so the
    // reason existed nowhere the developer would ever read it. A direct
    // process.stderr.write goes around the reporter's console interception
    // and prints. Both verified by running it three ways on 2026-08-25:
    // module-scope console.warn swallowed, in-test console.warn swallowed,
    // raw stderr printed.
    //
    // The skipped test's NAME carries the same reason, for the verbose
    // reporter, CI logs and IDE runners. Two channels because neither one
    // reaches every reader.
    if (SKIPPING_DOCX_HALF) {
      process.stderr.write(
        `\n[page-parity] DOCX pagination parity NOT EVALUATED in this run.\n` +
          `  ${SOFFICE_MISSING_MESSAGE}\n` +
          '  CI installs LibreOffice and runs this same assertion on every push and\n' +
          '  pull request, so the parity claim is still tested before anything merges.\n\n',
      );
    }

    const { markerPage, pageCount } = await pdfResult();

    expect(pageCount, 'PDF fixture must spill to page 2').toBeGreaterThanOrEqual(2);
    expect(markerPage, 'marker must be present in PDF text layer').toBeGreaterThan(0);
  }, 120000);

  // The parity assertion proper. In CI this ALWAYS runs and fails hard when
  // soffice is absent, because a CI run that quietly stops checking parity
  // is worse than no check at all. Locally, without soffice, it is SKIPPED
  // and vitest reports it as skipped, next to the console warning above.
  // That is a deliberate change from failing hard everywhere: a suite that
  // can never go green on a developer machine trains that developer to read
  // past red, which is how a SECOND red goes unnoticed. Observed exactly
  // that way on 2026-08-25, when a Windows run carried this failure plus an
  // unrelated timeout and the timeout nearly went unremarked.
  it.skipIf(SKIPPING_DOCX_HALF)(
    DOCX_TEST_NAME,
    async () => {
      const { markerPage: pdfMarkerPage } = await pdfResult();

      // Reachable only in CI, by the skipIf above. Kept as an assertion
      // rather than a throw so the failure reads as a test result.
      expect(SOFFICE, `${SOFFICE_MISSING_MESSAGE} This failure is intentional, not a skip.`).toBeTruthy();

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
      execFileSync(SOFFICE!, ['--headless', '--convert-to', 'pdf', '--outdir', dir, docxPath], {
        timeout: 60000,
      });
      const converted = readFileSync(path.join(dir, 'fixture.pdf'));
      const docxLayout = await extractPdfTextLayout(new Blob([converted]));
      const docxMarkerPage = pageOfMarker(docxLayout, PARITY_MARKER);
      const docxPageCount = Math.max(...docxLayout.map((i) => i.page));

      expect(docxPageCount, 'DOCX fixture must spill to page 2').toBeGreaterThanOrEqual(2);
      expect(docxMarkerPage, 'marker must be present in converted DOCX text').toBeGreaterThan(0);

      expect(
        docxMarkerPage,
        `Pagination divergence: marker lands on PDF page ${pdfMarkerPage} ` +
          `but DOCX (via LibreOffice) page ${docxMarkerPage}`,
      ).toBe(pdfMarkerPage);
    },
    120000,
  );
});
