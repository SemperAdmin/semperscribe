/**
 * Browser smoke test against the BUILT static export.
 *
 * Phase 0.1 of docs/HARDENING_PLAN_2026-09.md. Unit tests import modules
 * directly and never exercise dynamic import() boundaries, chunk loading,
 * or the service worker. Every bundle change can pass the unit suite and
 * still fail in the browser; this is the guard for that class of break.
 *
 * Three paths, each ending in a real download read back off disk:
 *   1. App loads with zero console errors and the disclaimer flow works.
 *   2. Basic letter typed through the UI, exported as PDF and DOCX, and
 *      the subject text found in both files.
 *   3. AA Form (NAVMC 10274) exported through the official-form XFA
 *      branch, the path most likely to break under a chunk split.
 *
 * Run: `npm run build && npm run test:e2e`.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import mammoth from 'mammoth';
import { extractPdfTextLayout } from '../golden/helpers';
import { getTodaysDate } from '../../src/lib/date-utils';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const SUBJECT = 'SMOKE TEST REQUEST FOR RANGE TIME';
const PARAGRAPH = 'Request approval for additional range time during the third quarter.';

/** Console noise the app is known to emit and which is not a defect. */
const IGNORED_CONSOLE = [
  /Download the React DevTools/,
  /TT: undefined function/,
  /TT: ENDF bad stack/,
  /FormatError: Could not fix indexToLocFormat/,
  /Warning: .*fontkit/,
];

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  // A 4xx or 5xx on our own origin is a missing or mis-prefixed asset.
  page.on('response', res => {
    if (res.status() >= 400 && res.url().startsWith('http://127.0.0.1')) {
      errors.push(`http ${res.status()}: ${res.url()}`);
    }
  });
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE.some(re => re.test(text))) return;
    errors.push(`console.error: ${text}`);
  });
  return errors;
}

/** Load the app and clear the first-visit disclaimer. */
async function enterApp(page: Page) {
  await page.goto('.');
  await page.getByRole('button', { name: 'I Understand' }).click();
  await expect(page.getByRole('button', { name: /Standard Naval Letter/ })).toBeVisible();
}

/**
 * Export through the header menu and return the download with the
 * expected extension. Matched by extension, not "next download": on a
 * slow runner the previous export's download event has been observed
 * arriving after the next export's wait was armed, which handed a PDF
 * to the DOCX assertions.
 */
async function exportVia(page: Page, itemName: string | RegExp, ext: 'pdf' | 'docx') {
  const download = page.waitForEvent('download', {
    predicate: d => d.suggestedFilename().toLowerCase().endsWith(`.${ext}`),
  });
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: itemName }).click();
  const file = await download;
  const path = await file.path();
  expect(path, 'download must land on disk').toBeTruthy();
  return { bytes: readFileSync(path as string), name: file.suggestedFilename() };
}

/** Every download the page emits, for the failure message. */
function collectDownloads(page: Page): string[] {
  const names: string[] = [];
  page.on('download', d => names.push(d.suggestedFilename()));
  return names;
}

function pdfTextOf(items: Awaited<ReturnType<typeof extractPdfTextLayout>>): string {
  return items.map(i => i.text).join(' ').replace(/\s+/g, ' ');
}

test('app loads from the static export with no console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await enterApp(page);
  // The disclaimer must not come back on reload once acknowledged.
  await page.reload();
  await expect(page.getByRole('button', { name: /Standard Naval Letter/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'I Understand' })).toHaveCount(0);
  expect(errors, errors.join('\n')).toEqual([]);
});

test('basic letter exports to PDF and DOCX with the typed subject', async ({ page }) => {
  const errors = collectErrors(page);
  const downloads = collectDownloads(page);
  await enterApp(page);

  await page.getByRole('button', { name: /Standard Naval Letter/ }).click();
  await page.getByLabel(/^From\b/).first().fill('Commanding Officer, 1st Battalion, 6th Marines');
  await page.getByLabel(/^To\b/).first().fill('Commanding General, 2d Marine Division');
  await page.getByLabel(/^Subject\b/).first().fill(SUBJECT);
  // D.2 (WCAG 2.1.1): the body is reachable without a mouse. Tab out of
  // the Subject field, which flushes the header form's debounced commit,
  // until the paragraph body takes focus, open it with Enter, and type.
  // No pointer touches the editor on this path.
  const body = page.getByRole('button', { name: 'Paragraph 1 body' });
  await expect(body).toBeVisible();
  let bodyFocused = false;
  for (let stop = 0; stop < 40 && !bodyFocused; stop++) {
    await page.keyboard.press('Tab');
    bodyFocused = await body.evaluate((el) => el === document.activeElement);
  }
  expect(bodyFocused, 'the paragraph body must be reachable by Tab').toBe(true);
  await page.keyboard.press('Enter');
  const paragraphBox = page.getByPlaceholder('Enter paragraph content...').first();
  await expect(paragraphBox).toBeFocused();
  await page.keyboard.type(PARAGRAPH);
  // Blur commits the paragraph draft at once. Both editors debounce while
  // typing (500 ms) and flush on blur, so nothing here waits on a timer:
  // a fast runner once exported before the debounce fired (run #149).
  await paragraphBox.blur();

  // PDF: real bytes, one page, subject present in the text layer.
  const pdf = await exportVia(page, 'PDF Document (.pdf)', 'pdf');
  expect(pdf.bytes.subarray(0, 5).toString(), `downloads: ${downloads.join(', ')}`).toBe('%PDF-');
  const layout = await extractPdfTextLayout(new Blob([new Uint8Array(pdf.bytes)]));
  expect(Math.max(...layout.map(i => i.page))).toBe(1);
  expect(pdfTextOf(layout)).toContain(SUBJECT);
  expect(pdfTextOf(layout)).toContain('range time');
  // Today's date is applied on the first client render (A.4), not baked
  // in at build time: the export must carry the run date, navy format.
  expect(pdfTextOf(layout)).toContain(getTodaysDate());
  // The letterhead seal is an image XObject. Its bytes come from
  // public/seals/ at runtime (B.1), so a broken seal fetch shows up here
  // as a missing image, and above as a same-origin 4xx.
  expect(pdf.bytes.toString('latin1')).toMatch(/\/Subtype\s*\/Image/);

  // DOCX: a zip Word can open, with the subject in the body text.
  const docx = await exportVia(page, 'Word Document (.docx)', 'docx');
  expect(docx.bytes.subarray(0, 2).toString(), `downloads: ${downloads.join(', ')}`).toBe('PK');
  const { value: text } = await mammoth.extractRawText({ buffer: docx.bytes });
  expect(text).toContain(SUBJECT);
  expect(text).toContain('range time');

  expect(errors, errors.join('\n')).toEqual([]);
});

test('AA Form exports through the official NAVMC 10274 form path', async ({ page }) => {
  const errors = collectErrors(page);
  await enterApp(page);

  // The form types sit in a collapsed sidebar group.
  await page.getByRole('button', { name: 'Forms' }).click();
  await page.getByRole('button', { name: 'AA Form (NAVMC 10274)' }).click();

  const pdf = await exportVia(page, 'PDF Document (.pdf)', 'pdf');
  expect(pdf.bytes.subarray(0, 5).toString()).toBe('%PDF-');
  // The official-form branch returns the fillable NAVMC itself, which
  // carries an AcroForm dictionary. The flattened redraw does not.
  expect(pdf.bytes.toString('latin1')).toContain('/AcroForm');
  // exact: the toast also renders an aria-live copy prefixed "Notification".
  await expect(page.getByText('Official Form Exported', { exact: true })).toBeVisible();

  expect(errors, errors.join('\n')).toEqual([]);
});

test('compliance failures are visible at laptop width', async ({ page }) => {
  // D.2: the banner used to live in the preview aside, which is hidden
  // below 1280 px, so a drafter on a laptop or a phone validated
  // nothing. A fresh basic letter is missing every required header
  // element, and must say so at this width.
  await page.setViewportSize({ width: 1024, height: 768 });
  await enterApp(page);
  await page.getByRole('button', { name: /Standard Naval Letter/ }).click();

  const compliance = page.getByRole('alert').filter({ hasText: /EXPORT BLOCKED|Compliance:/ });
  await expect(compliance).toHaveCount(1);
  await expect(compliance).toBeVisible();
  await expect(compliance).toContainText(/SSIC/);
});

/**
 * B.4 and B.5 (HARDENING_PLAN_2026-09): pdf-lib and jszip load with the
 * first export or batch run, the military dictionary with the first
 * body text, never with the page. Each marker is a string the
 * minifier keeps (an option name, an error message), checked against the
 * chunks index.html references on first load. The marker must still be
 * found in some lazy chunk, so a renamed or removed library fails loudly
 * instead of passing by absence.
 */
test('initial load carries no pdf-lib, jszip, or dictionary code', () => {
  const out = join(__dirname, '..', '..', 'out');
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  const chunksDir = join(out, '_next', 'static', 'chunks');
  const initial = new Set([...html.matchAll(/_next\/static\/chunks\/([^"'\s]+\.js)/g)].map(m => m[1]));
  const chunks = readdirSync(chunksDir).filter(f => f.endsWith('.js'))
    .map(f => ({ name: f, code: readFileSync(join(chunksDir, f), 'utf8'), initial: initial.has(f) }));
  const markers: Record<string, string> = {
    'pdf-lib': 'ignoreEncryption',
    jszip: 'central directory',
    'military-dictionary': 'Admini/LegsvcScol',
  };
  for (const [lib, marker] of Object.entries(markers)) {
    const carriers = chunks.filter(c => c.code.includes(marker));
    expect(carriers.map(c => c.name), `${lib} marker "${marker}" must exist in a lazy chunk`).not.toEqual([]);
    expect(carriers.filter(c => c.initial).map(c => c.name), `${lib} must not be on the initial load`).toEqual([]);
  }
});
