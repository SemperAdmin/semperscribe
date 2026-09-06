/**
 * Browser test for the same-page endorsement chain (E.1 to E.4) against
 * the BUILT static export.
 *
 * The unit suites measure the composer against rendered geometry; this
 * is the guard for the seams they cannot reach: the picker option, the
 * templates filter, the file input, the pdfjs worker the composer loads
 * in the browser, the preview hook, and the export download.
 *
 * Path: pick Same-Page Endorsement, load Figure 9-1's first endorsement
 * from the templates picker (filtered to the option), attach a short
 * letter as the letter being endorsed, read the fit line, export the
 * PDF and read the composed page back off disk.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { extractPdfTextLayout } from '../golden/helpers';

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

async function enterApp(page: Page) {
  await page.goto('.');
  await page.getByRole('button', { name: 'I Understand' }).click();
  await expect(page.getByRole('button', { name: /Standard Naval Letter/ })).toBeVisible();
}

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

/**
 * A short signed letter for the endorsement to land on: a letter-size
 * page with a few lines at the top and nothing below, so 9-1's fit
 * test passes for the template's 276 pt block. Built here with pdf-lib
 * so the test needs no fixture file and no app pipeline.
 */
async function writeHostLetter(dir: string): Promise<string> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const lines = [
    'From:  Commanding Officer, Naval Air Station, Meridian',
    'To:    Commander, Fleet Forces Command',
    'Subj:  HOW TO PREPARE AN ENDORSEMENT',
    '1.  Request approval of the action described in enclosure (1).',
    'G. L. SLAUGHTER, JR',
  ];
  let y = 700;
  for (const line of lines) {
    page.drawText(line, { x: 72, y, size: 12, font });
    y -= 28;
  }
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'host-letter.pdf');
  writeFileSync(path, await doc.save());
  return path;
}

test.describe('same-page endorsement', () => {
  test('template loads under its own option, the letter attaches, and the export is the composed page', async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await enterApp(page);

    await page.getByRole('button', { name: /Standard Letter/ }).first().click();
    await page.getByRole('button', { name: 'Same-Page Endorsement' }).first().click();
    await expect(page.getByRole('heading', { name: 'Same-Page Endorsement' })).toBeVisible();

    // E.4: the templates picker is filtered to the option on screen.
    await page.getByRole('button', { name: 'Templates' }).click();
    const dialog = page.getByRole('dialog');
    await expect(page.getByTestId('template-filter-label')).toContainText('filtered to same-page-endorsement');
    await expect(dialog.getByText('New-Page Endorsement', { exact: true })).toHaveCount(0);
    await dialog.getByText('Same-Page Endorsement', { exact: true }).click();
    await expect(dialog).toBeHidden();

    // Figure 9-1's first endorsement is on the form.
    await expect(page.getByLabel(/^From\b/).first()).toHaveValue('Commander, Sea Based Anti-Submarine Warfare Wing, Atlantic');

    // E.3: attach the letter being endorsed and read where the block landed.
    const hostPath = await writeHostLetter(testInfo.outputDir);
    await page.locator('#same-page-host-file').setInputFiles(hostPath);
    await expect(page.getByTestId('same-page-host-label')).toHaveText('host-letter.pdf');
    await expect(page.getByTestId('same-page-host-status')).toContainText('Fits on the signature page', { timeout: 40_000 });

    // The export is the letter with the endorsement on it: one page,
    // the letter's own lines above, the endorsement line below.
    const pdf = await exportVia(page, /PDF/i, 'pdf');
    const items = await extractPdfTextLayout(new Blob([new Uint8Array(pdf.bytes)]));
    const pages = new Set(items.map(i => i.page));
    expect(pages.size, 'a fitting endorsement adds no page').toBe(1);
    const text = items.map(i => i.text).join(' ');
    expect(text).toContain('HOW TO PREPARE AN ENDORSEMENT');
    expect(text).toContain('FIRST ENDORSEMENT');
    expect(text).toContain('R. L. GABEL');
    const hostSig = items.find(i => i.text.includes('SLAUGHTER'));
    const endorsementLine = items.find(i => i.text.includes('FIRST ENDORSEMENT'));
    expect(hostSig && endorsementLine && endorsementLine.y < hostSig.y, 'the endorsement sits below the letter\'s signature').toBe(true);

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
