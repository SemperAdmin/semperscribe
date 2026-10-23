/**
 * Handoff of 22 Oct 26, "Untested scope and next runs": the four retest
 * runs the tester asked for after the fixes landed, as deterministic
 * browser tests against the built export. Run 5 (GunnyBot on a counseling
 * draft) is tests/e2e/counseling-gunnybot-egress.spec.ts.
 *
 *   1. 30-day session for LCpl and below: the next-session date for a
 *      LCpl and a PFC, and the reservist's quarterly rule.
 *   2. Follow-on session: Section VII prints and carries the prior targets.
 *   3. Sgt and above on an ICS: the JEPES block hides, the 90-day
 *      post-ICS interval applies, and a follow-on moves to 6 months.
 *   4. PDF, DOCX and an encrypted share link with the network log open:
 *      no request leaves the application's origin.
 */
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { enterApp, collectErrors } from './helpers';
import { extractPdfTextLayout } from '../golden/helpers';

const ORIGIN = new URL(process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4173/').origin;
const SESSION_DATE = '22 Oct 26';

async function openCounseling(page: Page) {
  await enterApp(page);
  await page.getByRole('button', { name: 'Counseling Worksheets', exact: true }).first().click();
  await page.getByRole('button', { name: 'Counseling Worksheet', exact: true }).first().click();
  await expect(page.getByTestId('counseling-step-2')).toBeVisible();
}

/** Pick an option in a Radix select by the trigger's accessible name. */
async function pick(page: Page, trigger: string, option: string) {
  await page.getByRole('combobox', { name: trigger, exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

async function setDate(page: Page, value: string) {
  const date = page.getByLabel('Date of session');
  await date.fill(value);
  await date.blur();
}

/** The interval line under the next-session field. The same words also
 *  appear in the open-suggestions summary, so the match is this line only. */
function ruleLine(page: Page) {
  return page.getByText(/^The rule for this Marine: /);
}

/** The computed next-session date, read from the "Use <date>" button. */
function useButton(page: Page) {
  return page.getByRole('button', { name: /^Use \d{1,2} [A-Z][a-z]{2} \d{2}$/ });
}

async function pdfText(bytes: Buffer): Promise<string> {
  const items = await extractPdfTextLayout(new Blob([new Uint8Array(bytes)]));
  return items.map((i) => i.text).join(' ');
}

/**
 * The pre-export scan prompts on an SSN or EDIPI pattern before any
 * download or share link, and the drafter chooses. The prompt is part of
 * what the handoff's run 4 exercises, so it is asserted, not bypassed:
 * `gated` says whether this call met it.
 */
function scanGate(page: Page) {
  return page.getByRole('alertdialog').filter({ hasText: 'Sensitive data detected' });
}

async function acceptGate(page: Page, finding: string) {
  const gate = scanGate(page);
  await expect(gate).toBeVisible();
  await expect(gate).toContainText(finding);
  await gate.getByRole('button', { name: 'Export anyway' }).click();
  await expect(gate).toBeHidden();
}

async function exportVia(page: Page, itemName: string, ext: 'pdf' | 'docx', gated?: string) {
  const download = page.waitForEvent('download', { predicate: (d) => d.suggestedFilename().toLowerCase().endsWith(`.${ext}`) });
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: itemName }).click();
  if (gated) await acceptGate(page, gated);
  const file = await download;
  const path = await file.path();
  expect(path, 'download must land on disk').toBeTruthy();
  return readFileSync(path as string);
}

test('run 1: the 30-day rule sets the next session for a LCpl and a PFC, quarterly for a reservist', async ({ page }) => {
  const errors = collectErrors(page);
  await openCounseling(page);
  await pick(page, 'Occasion', '30-day session (LCpl and below)');
  await setDate(page, SESSION_DATE);

  await pick(page, 'Grade', 'LCpl (E-3)');
  await pick(page, 'Component', 'Active');
  await expect(ruleLine(page)).toHaveText(/every 30 days \(lance corporal and below\) \(NAVMC 2795 para 2001\.3\.a\)/);
  await expect(useButton(page)).toHaveText('Use 21 Nov 26');
  await useButton(page).click();
  await expect(page.getByLabel('Target date for next session')).toHaveValue('21 Nov 26');
  await expect(useButton(page)).toHaveCount(0);

  // A PFC gets the same rule. The button returns because the stored date
  // no longer matches the rule once the session date moves.
  await pick(page, 'Grade', 'PFC (E-2)');
  await setDate(page, '1 Nov 26');
  await expect(useButton(page)).toHaveText('Use 1 Dec 26');

  // A reservist LCpl is on the quarterly rule.
  await pick(page, 'Grade', 'LCpl (E-3)');
  await pick(page, 'Component', 'Reserve');
  await expect(ruleLine(page)).toHaveText(/every 3 months and once during annual training duty/);
  await expect(useButton(page)).toHaveText('Use 1 Feb 27');

  expect(errors, errors.join('\n')).toEqual([]);
});

test('run 2: a follow-on session prints Section VII with the prior targets and their results', async ({ page }) => {
  const errors = collectErrors(page);
  await openCounseling(page);
  await pick(page, 'Occasion', 'Follow-on session');
  await setDate(page, SESSION_DATE);
  await page.getByLabel('Last name').first().fill('PLACEHOLDER');
  await pick(page, 'Grade', 'Cpl (E-4)');
  await pick(page, 'Component', 'Active');
  await page.getByLabel('Last name').nth(1).fill('SENIORNAME');
  await pick(page, "Senior's grade", 'SSgt (E-6)');

  // Two prior targets with results. The follow-on block offers them only
  // on a non-initial, non-event occasion.
  await page.getByRole('button', { name: 'Add a prior target' }).click();
  await page.getByLabel('Prior target 1', { exact: true }).fill('Complete the MCI on land navigation');
  await pick(page, 'Prior target 1 status', 'Met');
  await page.getByRole('button', { name: 'Add a prior target' }).click();
  await page.getByLabel('Prior target 2', { exact: true }).fill('Score first class on the PFT');
  await pick(page, 'Prior target 2 status', 'Carried forward');

  // No identifier in this draft, so no scan prompt on the way out.
  const pdf = await exportVia(page, 'PDF Document (.pdf)', 'pdf');
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  await expect(scanGate(page)).toHaveCount(0);
  const text = await pdfText(pdf);
  expect(text).toContain('SECTION VII. REVIEW OF TARGETS FROM LAST SESSION');
  expect(text).toContain('Complete the MCI on land navigation');
  expect(text).toContain('Score first class on the PFT');
  expect(text).not.toContain('None. Initial session.');
  // Block 19 names the agenda of a follow-on.
  expect(text).toContain('Progress on the targets set last session (Section VII)');
  // The numbering after Section VII is unchanged: block 26 is still the
  // target table.
  expect(text).toContain('SECTION VIII. TARGETS FOR THE COMING PERIOD');

  expect(errors, errors.join('\n')).toEqual([]);
});

test('run 3: a Sgt on an ICS has no JEPES block and the 90-day interval; a follow-on moves to 6 months', async ({ page }) => {
  const errors = collectErrors(page);
  await openCounseling(page);
  await pick(page, 'Occasion', 'Initial counseling session (ICS)');
  await setDate(page, SESSION_DATE);
  await pick(page, 'Component', 'Active');

  // A Cpl sees the benchmark, marked optional on the ICS.
  await pick(page, 'Grade', 'Cpl (E-4)');
  await expect(page.getByTestId('counseling-benchmark')).toBeVisible();
  await expect(page.getByTestId('benchmark-optional')).toBeVisible();
  await expect(useButton(page)).toHaveText('Use 20 Jan 27');

  // A Sgt does not. The post-ICS rule is 90 days for corporal through colonel.
  await pick(page, 'Grade', 'Sgt (E-5)');
  await expect(page.getByTestId('counseling-benchmark')).toHaveCount(0);
  await expect(ruleLine(page)).toHaveText(/approximately 90 days after the initial counseling session \(corporal through colonel\) \(NAVMC 2795 para 2001\.2\.a\)/);
  await expect(useButton(page)).toHaveText('Use 20 Jan 27');

  // The same Sgt on a follow-on is on the 6-month rule, the fitness
  // report cycle's counseling interval.
  await pick(page, 'Occasion', 'Follow-on session');
  await expect(page.getByTestId('counseling-benchmark')).toHaveCount(0);
  await expect(ruleLine(page)).toHaveText(/at intervals of no more than 6 months \(corporal through colonel\)/);
  await expect(useButton(page)).toHaveText('Use 22 Apr 27');

  // A GySgt and a WO are the same: no JEPES block.
  await pick(page, 'Grade', 'GySgt (E-7)');
  await expect(page.getByTestId('counseling-benchmark')).toHaveCount(0);
  await pick(page, 'Grade', 'WO (W-1)');
  await expect(page.getByTestId('counseling-benchmark')).toHaveCount(0);

  expect(errors, errors.join('\n')).toEqual([]);
});

test('run 4: PDF, DOCX and an encrypted share link leave nothing but the app origin in the network log', async ({ page, context }) => {
  const errors = collectErrors(page);
  const offOrigin: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith(ORIGIN)) return;
    offOrigin.push(`${req.method()} ${url}`);
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  await openCounseling(page);
  await pick(page, 'Occasion', 'Initial counseling session (ICS)');
  await setDate(page, SESSION_DATE);
  await page.getByLabel('Last name').first().fill('PLACEHOLDER');
  await page.getByLabel('EDIPI').first().fill('1234567890');
  await pick(page, 'Grade', 'LCpl (E-3)');
  await pick(page, 'Component', 'Active');
  await page.getByLabel('Last name').nth(1).fill('SENIORNAME');
  await pick(page, "Senior's grade", 'Sgt (E-5)');

  // The EDIPI entered above meets the pre-export scan on each path.
  const pdf = await exportVia(page, 'PDF Document (.pdf)', 'pdf', 'Possible EDIPI detected');
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect(await pdfText(pdf)).toContain('PLACEHOLDER');

  const docx = await exportVia(page, 'Word Document (.docx)', 'docx', 'Possible EDIPI detected');
  // A DOCX is a zip: PK header.
  expect(docx.subarray(0, 2).toString()).toBe('PK');

  // An encrypted share link. The password rule wants 12 characters with
  // enough distinct ones.
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Copy Share Link' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('#share-password').fill('correct-horse-battery-7');
  await dialog.locator('#share-password-confirm').fill('correct-horse-battery-7');
  await dialog.getByRole('button', { name: 'Generate & Copy' }).click();
  await acceptGate(page, 'Possible EDIPI detected');
  await expect(page.getByText('Link Copied!', { exact: true })).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  // An encrypted link carries the ciphertext envelope, and nothing of the
  // draft in the clear.
  expect(link).toMatch(/#es=v1\./);
  expect(link).not.toContain('PLACEHOLDER');
  expect(link).not.toContain('1234567890');
  expect(new URL(link).origin).toBe(ORIGIN);

  expect(offOrigin, offOrigin.join('\n')).toEqual([]);
  expect(errors, errors.join('\n')).toEqual([]);
});
