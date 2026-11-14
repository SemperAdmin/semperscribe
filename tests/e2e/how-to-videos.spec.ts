/**
 * Browser test for the how-to video links (spec 2026-11-13 section 8.3)
 * against the BUILT static export, served with the production headers.
 *
 * Covers: the contextual header row (endorsement, same-page
 * endorsement, NAVMC 10132), the library dialog from the Review menu
 * (11 groups in order, 32 anchors), the offline state, and a clean
 * console (which includes CSP violations) for the whole run.
 * The sidebar-unchanged claim is proved by
 * `git diff --exit-code src/components/layout/Sidebar.tsx`, not here.
 */
import { test, expect, type Page } from '@playwright/test';
import { enterApp, collectErrors } from './helpers';

const ENDORSEMENTS_URL = 'https://portal.mcele.usmc.mil/content/mcele-portal/en/media/detail.html?Id=101429EA6E04';

async function openFromSidebar(page: Page, group: string, label: string) {
  const trigger = page.getByRole('button', { name: group, exact: true }).first();
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  await page.getByRole('button', { name: label, exact: true }).first().click();
}

async function openLibrary(page: Page) {
  await page.getByLabel('Review', { exact: true }).click();
  await page.getByRole('menuitem', { name: 'How-To Videos' }).click();
  const dialog = page.getByRole('dialog', { name: 'How-To Videos' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('how-to videos', () => {
  test('endorsement and same-page endorsement headers link the Endorsements video', async ({ page }) => {
    const errors = collectErrors(page);
    await enterApp(page);

    for (const label of ['Endorsement', 'Same-Page Endorsement']) {
      await openFromSidebar(page, 'Standard Letter', label);
      await expect(page.getByRole('heading', { name: label, exact: true }).first()).toBeVisible();
      const link = page.locator('[data-testid="howto-video-links"] a');
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('href', ENDORSEMENTS_URL);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('NAVMC 10132 header links the Unit Punishment Book video', async ({ page }) => {
    const errors = collectErrors(page);
    await enterApp(page);
    await openFromSidebar(page, 'Forms', 'Unit Punishment Book (NAVMC 10132)');
    const link = page.locator('[data-testid="howto-video-links"] a');
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('href', /Id=101614637C29$/);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('library: 11 groups in order, 32 anchors; offline turns every row to text', async ({ page, context }) => {
    const errors = collectErrors(page);
    await enterApp(page);
    await openFromSidebar(page, 'Standard Letter', 'Basic Letter');
    const dialog = await openLibrary(page);

    const groups = dialog.locator('[data-testid="howto-video-group"]');
    await expect(groups).toHaveCount(11);
    expect(await groups.evaluateAll(els => els.map(e => e.getAttribute('data-group')))).toEqual([
      'getting-started', 'standard-letter', 'memorandums', 'staffing-papers', 'external-executive',
      'directives', 'forms', 'counseling-worksheets', 'amhs', 'check-export-share', 'power-tools',
    ]);
    await expect(dialog.locator('a[data-state="link"]')).toHaveCount(32);
    await expect(dialog.locator('a[target="_blank"][rel="noopener noreferrer"]')).toHaveCount(32);

    await context.setOffline(true);
    await expect(dialog.locator('a')).toHaveCount(0);
    await expect(dialog.getByText('Needs a network connection')).toHaveCount(32);
    await context.setOffline(false);
    await expect(dialog.locator('a[data-state="link"]')).toHaveCount(32);

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
