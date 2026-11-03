/**
 * Handoff of 3 Nov 26, round 2, end to end in the built app:
 * N-03 (one rank in the senior's grade), N-04 (library titles) and
 * N-07 (Clear Form). N-07 was reported through automation with the pane
 * hidden. Clear Form asks through window.confirm, which Playwright
 * dismisses by default, so a dismissed prompt keeps the form and an
 * accepted one empties it. Both are pinned here.
 */
import { test, expect, type Page } from '@playwright/test';
import { enterApp, collectErrors } from './helpers';

async function openCounseling(page: Page) {
  await enterApp(page);
  const group = page.getByRole('button', { name: 'Counseling Worksheets', exact: true }).first();
  if ((await group.getAttribute('aria-expanded')) !== 'true') await group.click();
  await page.getByRole('button', { name: 'Counseling Worksheet', exact: true }).first().click();
  await expect(page.getByTestId('counseling-step-2')).toBeVisible();
}

async function pick(page: Page, combobox: string, option: string) {
  await page.getByRole('combobox', { name: combobox, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(page.getByRole('combobox', { name: combobox, exact: true })).toHaveText(option);
}

async function fileMenu(page: Page, item: RegExp) {
  await page.getByRole('button', { name: /^File/ }).first().click();
  await page.getByRole('menuitem', { name: item }).click();
}

test('a 1stSgt senior, a titled library entry, and Clear Form that clears once confirmed', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openCounseling(page);

  await pick(page, 'Grade', 'LCpl (E-3)');
  await pick(page, "Senior's grade", '1stSgt (E-8)');
  await page.locator('#counselingMarineLastName').fill('CARPENTER');
  await page.locator('#counselingSeniorLastName').fill('SHORTER');

  // N-04: the save is titled by the Marine, and Open Saved shows it.
  await fileMenu(page, /Save Draft/);
  await expect(page.getByText(/"LCpl CARPENTER[^"]*" added to your document library/).first()).toBeVisible();
  await page.getByRole('button', { name: /^File/ }).first().click();
  await page.getByRole('menuitem', { name: /Open Saved/ }).hover();
  await expect(page.getByRole('menuitem', { name: /LCpl CARPENTER/ })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /^Untitled/ })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // N-07: a dismissed prompt keeps the work, which is what automation saw.
  page.once('dialog', (d) => d.dismiss());
  await fileMenu(page, /Clear Form/);
  await expect(page.locator('#counselingMarineLastName')).toHaveValue('CARPENTER');

  // An accepted prompt clears every field.
  page.once('dialog', (d) => d.accept());
  await fileMenu(page, /Clear Form/);
  await expect(page.locator('#counselingMarineLastName')).toHaveValue('');
  await expect(page.locator('#counselingSeniorLastName')).toHaveValue('');
  await expect(page.getByRole('combobox', { name: "Senior's grade", exact: true })).not.toHaveText('1stSgt (E-8)');

  expect(errors, errors.join('\n')).toEqual([]);
});
