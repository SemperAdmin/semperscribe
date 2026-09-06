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
  // The appointment letter addresses the Marine with an EDIPI, so the
  // sensitive-data scan asks before exporting. Confirm it, as a drafter
  // exporting a letter they wrote would.
  const exportAnyway = page.getByRole('button', { name: 'Export anyway' });
  if (await exportAnyway.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await exportAnyway.click();
  }
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
  test('the template is one page with two signers, and a received PDF becomes the top half', async ({ page }, testInfo) => {
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

    // E.5: the appointment letter as one document. The main sections
    // are the letter from the commander, signed by the commander; the
    // endorsement card is the Marine's acknowledgement back to the
    // commander, the reversal the no-Via case derives, signed by the Marine.
    await expect(page.getByLabel(/^From\b/).first()).toHaveValue('Commanding Officer, (Unit)');
    await expect(page.locator('#same-page-from')).toHaveValue('Staff Sergeant John T. Smith 1234567890/0111 USMC');
    await expect(page.locator('#same-page-to')).toHaveValue('Commanding Officer, (Unit)');
    await expect(page.locator('#same-page-sig')).toHaveValue('J. T. SMITH');
    // Two body editors: the letter's and the endorsement's.
    await expect(page.getByRole('button', { name: 'Paragraph 1 body' })).toHaveCount(2);
    await expect(page.getByTestId('same-page-composite-status')).toContainText('Fits on the signature page', { timeout: 40_000 });

    // The export is the letter with the endorsement composed below its
    // signature: one page, two signers, the rule between them.
    const composed = await exportVia(page, /PDF/i, 'pdf');
    const items = await extractPdfTextLayout(new Blob([new Uint8Array(composed.bytes)]));
    expect(new Set(items.map(i => i.page)).size, 'a fitting endorsement adds no page').toBe(1);
    const text = items.map(i => i.text).join(' ');
    expect(text).toContain('APPOINTMENT AS COMMAND DESIGNATED DIRECTIVES MANAGER');
    expect(text).toContain('you are appointed as the Command Designated Directives Manager');
    expect(text).toContain('FIRST ENDORSEMENT');
    expect(text).not.toContain('FIRST ENDORSEMENT on');
    expect(text).toContain('J. T. SMITH');
    const letterSig = items.find(i => i.text.includes('I. M. COMMANDER'));
    const endorsementLine = items.find(i => i.text.includes('FIRST ENDORSEMENT'));
    expect(letterSig && endorsementLine && endorsementLine.y < letterSig.y, 'the endorsement sits below the letter\'s signature').toBe(true);

    // E.3 still: a letter that arrived as a PDF becomes the top half,
    // and the letter sections hide.
    const hostPath = await writeHostLetter(testInfo.outputDir);
    await page.locator('#same-page-host-file').setInputFiles(hostPath);
    await expect(page.getByTestId('same-page-host-label')).toHaveText('host-letter.pdf');
    await expect(page.getByTestId('same-page-host-status')).toContainText('Fits on the signature page', { timeout: 40_000 });
    // The letter sections hide; the endorsement's editor is the one left.
    await expect(page.getByRole('button', { name: 'Paragraph 1 body' })).toHaveCount(1);
    const attached = await exportVia(page, /PDF/i, 'pdf');
    const attachedText = (await extractPdfTextLayout(new Blob([new Uint8Array(attached.bytes)]))).map(i => i.text).join(' ');
    expect(attachedText).toContain('Request approval of the action described in enclosure (1).');
    expect(attachedText).not.toContain('you are appointed as the Command Designated Directives Manager');
    expect(attachedText).toContain('J. T. SMITH');

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
