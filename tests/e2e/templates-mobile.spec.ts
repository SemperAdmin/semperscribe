/**
 * The Templates browser at phone width, against the BUILT export.
 *
 * Owner's report, 2026-09-26 (iPhone Safari screenshot): the list in
 * Browse Templates could not be scrolled, and the header's Templates
 * button is hidden under md so the dialog was hard to reach at all.
 * Chromium cannot stand in for Safari's touch handling, so this pins
 * what it can: the dialog opens from the File menu at 390px, fits the
 * viewport, and is itself the scroll region that reaches the last card.
 */
import { test, expect } from '@playwright/test';
import { collectErrors } from './helpers';

test.use({ viewport: { width: 390, height: 664 }, hasTouch: true, isMobile: true });

test('phone: Browse Templates opens from File and scrolls to the last template', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('.');
  await page.getByRole('button', { name: 'I Understand' }).click();

  // No document type yet, so every template is listed: the longest list.
  await page.getByRole('button', { name: /^File/ }).click();
  await page.getByRole('menuitem', { name: 'Browse Templates...' }).click();
  const dialog = page.getByTestId('templates-dialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByTestId('template-filter-label')).toContainText('every document type');

  // Fits the visible viewport, top and bottom.
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(664 + 1);

  // The dialog is the scroll region on a phone, and the list region is not.
  const metrics = await dialog.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    overflowY: getComputedStyle(el).overflowY,
  }));
  expect(metrics.overflowY).toBe('auto');
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  const region = page.getByTestId('template-list-region');
  expect(await region.evaluate((el) => getComputedStyle(el).overflowY)).toBe('visible');

  // Scrolling the dialog brings the last card fully into view.
  const cards = dialog.getByRole('button').filter({ hasText: /./ });
  const last = dialog.locator('[data-testid="template-list-region"] button').last();
  await dialog.evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await expect(last).toBeInViewport({ ratio: 0.9 });
  expect(await cards.count()).toBeGreaterThan(5);

  // Picking one closes the dialog.
  await last.click();
  await expect(dialog).toBeHidden();
  expect(errors).toEqual([]);
});
