/**
 * The AA Form preview is the official NAVMC 10274 being filled, laid out
 * by pdf.js's XFA engine (owner, 2026-10-21: "show the form itself being
 * completed like we do for NJPs, but use the flat when we add a
 * signature"). Placing a signature field switches the pane to the
 * flattened redraw in the blob iframe, as the export routes.
 */
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { enterApp, collectErrors } from './helpers';

const TEMPLATE = join(__dirname, '..', '..', 'public', 'templates', 'global', 'aa-oconus-extension.nldp');

test('the AA Form previews as the official form, then as the redraw once a signature field is placed', async ({ page }, testInfo) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1600, height: 1000 });

  const pkg = JSON.parse(readFileSync(TEMPLATE, 'utf-8'));
  pkg.data.formData.date = '19 Oct 26';
  pkg.data.formData.sig = 'F. M. LASTNAME';
  pkg.data.formData.subj = 'REQUEST FOR 12-MONTH OVERSEAS TOUR EXTENSION';
  const fixture = testInfo.outputPath('aa-request.nldp');
  writeFileSync(fixture, JSON.stringify(pkg));

  await enterApp(page);
  await page.locator('input[type="file"][accept=".nldp,.json"]').setInputFiles(fixture);
  await expect(page.getByText('AA Form Details')).toBeVisible();

  // The official form, filled: the date field carries the picture and
  // block 12 holds the first paragraph, as pdf.js lays them out.
  const official = page.getByTestId('official-form-preview');
  await expect(official).toBeVisible({ timeout: 30_000 });
  await expect(official.locator('.xfaPreviewPage')).toHaveCount(3, { timeout: 30_000 });
  await expect(official.locator('input[value="2026-10-19"]')).toHaveCount(1);
  await expect(official.locator('textarea').filter({ hasText: /^1\.\s+/ }).first()).toBeVisible();
  await expect(page.locator('iframe[title="PDF Preview"]')).toHaveCount(0);
  await official.screenshot({ path: testInfo.outputPath('official-form-preview.png') });

  // A placed signature field sends the preview to the flattened redraw.
  const configure = page.getByTestId('sig-configure');
  await configure.scrollIntoViewIfNeeded();
  await configure.click();
  const dialog = page.getByRole('dialog', { name: 'Configure Signature Fields' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Add signature field' }).click();
  await dialog.getByRole('button', { name: 'Save Fields' }).click();
  await expect(dialog).toBeHidden();

  await expect(page.locator('iframe[title="PDF Preview"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('official-form-preview')).toHaveCount(0);

  expect(errors, errors.join('\n')).toEqual([]);
});

test('a name that opens block 13 shows three lines down at the centre line, as the export writes it', async ({ page }, testInfo) => {
  // pdf.js trims a data value's leading whitespace; the pane restores it
  // from the values the app wrote (src/lib/xfa-preview-values.ts). The
  // committed fixture is the case: block 12 holds 29 lines, the name
  // alone spills.
  const { TLE_EXTENSION_FIXTURE: fx } = await import('../fixtures/navmc10274-tle-extension');
  const listed = (xs: readonly string[]) => xs.map((text, i) => ({ text, order: i + 1 }));
  const pkg = {
    format: 'NLDP', version: '1.1',
    metadata: { createdAt: new Date().toISOString(), formatVersion: '1.1', createdBy: 'test' },
    data: {
      formData: fx.formData, paragraphs: fx.paragraphs,
      references: listed(fx.references), enclosures: listed(fx.enclosures), vias: listed(fx.vias), copyTos: listed(fx.copyTos),
    },
  };
  const fixture = testInfo.outputPath('aa-spill.nldp');
  writeFileSync(fixture, JSON.stringify(pkg));

  await page.setViewportSize({ width: 1600, height: 1000 });
  await enterApp(page);
  await page.locator('input[type="file"][accept=".nldp,.json"]').setInputFiles(fixture);
  const official = page.getByTestId('official-form-preview');
  await expect(official.locator('.xfaPreviewPage')).toHaveCount(3, { timeout: 30_000 });
  const block13 = official.locator('.xfaPreviewPage[data-page="3"] textarea').first();
  await expect(block13).toHaveText(/F\. M\. LASTNAME/);
  const text = await block13.evaluate(el => el.textContent ?? '');
  expect(text.startsWith('\n\n\n')).toBe(true);
  expect(text.replace(/^\n+/, '').startsWith(' '.repeat(40))).toBe(true);
});
