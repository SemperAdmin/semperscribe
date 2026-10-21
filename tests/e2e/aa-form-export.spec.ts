/**
 * NAVMC 10274 official export, read back (acceptance items 1 and 2 of the
 * handoff of 2026-10-21): the datasets the fillable form carries hold the
 * date in the form's own picture and the typed name three blank lines
 * under the text, against the BUILT export in a real browser.
 *
 * The smoke test proves the AA path returns the fillable form; this one
 * opens the file the browser downloaded and reads what was written into
 * it. A shipped AA template is imported with a date and a name set, the
 * two fields the handoff found missing or wrong.
 */
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { enterApp, collectErrors } from './helpers';
import { readXfaPacket } from '../golden/helpers';

const TEMPLATE = join(__dirname, '..', '..', 'public', 'templates', 'global', 'aa-oconus-extension.nldp');

test('the official NAVMC 10274 carries the date picture and the typed name', async ({ page }, testInfo) => {
  const errors = collectErrors(page);

  const pkg = JSON.parse(readFileSync(TEMPLATE, 'utf-8'));
  pkg.data.formData.date = '19 Oct 26';
  pkg.data.formData.sig = 'F. M. LASTNAME';
  // The shipped subject carries a placeholder EDIPI, which the pre-export
  // sensitive-data scan stops on (a prompt, by design). This test is about
  // the datasets, so the subject goes in without one.
  pkg.data.formData.subj = 'REQUEST FOR 12-MONTH OVERSEAS TOUR EXTENSION';
  const fixture = testInfo.outputPath('aa-request.nldp');
  writeFileSync(fixture, JSON.stringify(pkg));

  await enterApp(page);
  await page.locator('input[type="file"][accept=".nldp,.json"]').setInputFiles(fixture);
  await expect(page.getByText('AA Form Details')).toBeVisible();

  const download = page.waitForEvent('download', {
    predicate: d => d.suggestedFilename().toLowerCase().endsWith('.pdf'),
  });
  await page.getByRole('button', { name: 'Export' }).click();
  await page.getByRole('menuitem', { name: 'PDF Document (.pdf)' }).click();
  const file = await download;
  const path = await file.path();
  expect(path, 'download must land on disk').toBeTruthy();
  const bytes = readFileSync(path as string);
  await expect(page.getByText('Official Form Exported', { exact: true })).toBeVisible();

  const datasets = await readXfaPacket(new Uint8Array(bytes), 'datasets');
  // The form's own picture, not the typed string.
  expect(datasets).toContain('<Date>2026-10-19</Date>');
  expect(datasets).not.toContain('19 Oct 26');
  // The name three blank lines under the text (four line breaks) with its
  // centring lead, in block 12 or, when block 12 is full, opening block 13.
  expect(datasets).toMatch(/&#xD;&#xD;&#xD;&#xD; {40,}F\. M\. LASTNAME<\/SuppInfo>|<ProcAct>&#xD;&#xD;&#xD; {40,}F\. M\. LASTNAME/);

  expect(errors, errors.join('\n')).toEqual([]);
});
