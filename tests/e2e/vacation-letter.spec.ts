/**
 * NAVMC 10132 to Figure 14-1: the notice of intent to vacate a suspended
 * punishment, opened from the vacation record (owner, 2026-09-26: "Let's
 * wire the vacation letter"), against the BUILT export.
 *
 * The hand-off's contract is an ORDER: save the UPB to the library, then
 * replace the open document with the letter. A unit test can prove the
 * package; only the browser proves the order landed, so this imports a
 * closed-out UPB with one suspension and one pending vacation record,
 * clicks through the confirmation, and checks both halves: the letter on
 * screen as Figure 14-1 prints it, and the UPB in the library under its
 * Marine's name.
 */
import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { enterApp, collectErrors } from './helpers';

const TEMPLATE = join(__dirname, '..', '..', 'public', 'templates', 'global', 'navmc10132-combined-punishment.nldp');

test('the vacation record saves the UPB, then opens the Figure 14-1 notice seeded from it', async ({ page }, testInfo) => {
  const errors = collectErrors(page);

  // A shipped UPB, closed out, with one item 7 suspension and a pending
  // vacation record against it: the state in which the section offers the letter.
  const pkg = JSON.parse(readFileSync(TEMPLATE, 'utf-8'));
  pkg.data.formData.stage = 'complete';
  pkg.data.formData.suspensions = [{ punishmentIndex: 0, months: '3' }];
  pkg.data.formData.vacations = [{ suspensionIndex: 0, noticeServedDate: '', status: 'pending' }];
  const unit = String(pkg.data.formData.unit);
  const fixture = testInfo.outputPath('closed-out-upb.nldp');
  writeFileSync(fixture, JSON.stringify(pkg));

  await enterApp(page);
  await page.locator('input[type="file"][accept=".nldp,.json"]').setInputFiles(fixture);
  await expect(page.getByRole('heading', { name: 'Vacation of Suspended Punishment' })).toBeVisible();

  // Asks before it acts.
  await page.getByRole('button', { name: 'Draft the Figure 14-1 notice letter' }).click();
  await expect(page.getByText(/saves the NAVMC 10132 to your document library/)).toBeVisible();
  await page.getByRole('button', { name: 'Save the UPB and open the letter' }).click();

  // The letter, as Figure 14-1 prints it.
  await expect(page.getByText('Notice of intent to vacate opened', { exact: true })).toBeVisible();
  await expect(page.getByLabel(/^Subject/).first()).toHaveValue('INTENT TO VACATE PREVIOUSLY SUSPENDED PUNISHMENT');
  await expect(page.getByLabel(/^From\b/).first()).toHaveValue(`Commanding Officer, ${unit}`);
  await expect(page.getByPlaceholder(/Enter reference information/).first()).toHaveValue('MCO 5800.16');
  for (const n of [1, 2, 3]) {
    await expect(page.getByRole('button', { name: `Paragraph ${n} body` })).toHaveCount(1);
  }
  await expect(page.getByText(/It is my intent to vacate your previously suspended punishment in: FULL\/PART/)).toBeVisible();

  // The UPB survived the swap, in the library under its Marine's name.
  await page.getByRole('button', { name: /^File/ }).click();
  await page.getByRole('menuitem', { name: /Document Library/ }).click();
  const library = page.getByRole('dialog');
  await expect(library.getByText(/^NAVMC 10132 - /)).toBeVisible();

  expect(errors).toEqual([]);
});
