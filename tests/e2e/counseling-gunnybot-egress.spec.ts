/**
 * Handoff of 22 Oct 26, D-10: GunnyBot on a counseling draft, with the
 * network log open. The acceptance line reads "zero requests leave the
 * app's origin, or the warning displays first". This test holds both:
 * every request the page makes while a worksheet is drafted, the panel
 * opened, a question sent and the proofread checklist opened stays on
 * the app's own origin, and the panel states what leaves before a send
 * is possible. With no API key the send is refused in the browser.
 */
import { test, expect } from '@playwright/test';
import { enterApp, collectErrors } from './helpers';

const ORIGIN = new URL(process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173/').origin;

test('GunnyBot on a counseling worksheet: the scope line shows, review is closed, nothing leaves the origin', async ({ page }) => {
  const errors = collectErrors(page);
  const offOrigin: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith(ORIGIN)) return;
    offOrigin.push(`${req.method()} ${url}`);
  });

  await enterApp(page);
  await page.getByRole('button', { name: 'Counseling Worksheets', exact: true }).first().click();
  await page.getByRole('button', { name: 'Counseling Worksheet', exact: true }).first().click();
  await expect(page.getByTestId('counseling-step-2')).toBeVisible();

  // Counseling content a tester would worry about: a name and an EDIPI.
  await page.getByLabel('Last name').first().fill('PLACEHOLDER');
  await page.getByLabel('EDIPI').first().fill('1234567890');

  // The panel, from the header button. The scope line is visible before
  // anything can be sent, and names the worksheet.
  await page.getByRole('button', { name: 'Open GunnyBot assistant' }).click();
  const panel = page.getByRole('dialog', { name: 'GunnyBot' });
  await expect(panel).toBeVisible();
  await expect(panel.getByTestId('gunnybot-scope')).toHaveText(/Counseling Worksheet is not sent/);
  await expect(panel.getByTestId('gunnybot-destination')).toHaveText(/^Sends to /);

  // A send with no key stops in the browser.
  await panel.getByPlaceholder('Ask a format or policy question...').fill('What goes in block 12?');
  await panel.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('Add your API key', { exact: true })).toBeVisible();
  await panel.getByRole('button', { name: 'Close' }).click();
  await expect(panel).toBeHidden();

  // The proofread checklist: the review is closed on a worksheet.
  await page.getByRole('button', { name: 'Review', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Proofread' }).click();
  const proofread = page.getByRole('dialog').filter({ hasText: 'GunnyBot review' });
  await expect(proofread).toBeVisible();
  await expect(proofread.getByTestId('gunnybot-review-closed')).toHaveText(/none of its fields are sent/);
  await expect(proofread.getByRole('button', { name: /Run GunnyBot review/ })).toHaveCount(0);

  expect(offOrigin, offOrigin.join('\n')).toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);
});
