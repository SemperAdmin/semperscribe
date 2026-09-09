/**
 * Automated accessibility scan against the BUILT static export.
 *
 * Phase D.8 of docs/UX_POLICY_PLAN_2026-09.md, closing the gap
 * docs/audits/2026-09-05/audit-roadmap.md Phase B recorded: "No
 * axe-core or AT script anywhere in src/, tests/, package.json".
 *
 * P8 (2026-09 remediation) widened it from two surfaces to the ones the
 * audit found violations on: the landing page, the basic letter, the
 * Counseling Worksheet, NAVMC 10132, the Same-Page Endorsement and the
 * DD 368 editors, the Settings and Share Link dialogs, the command
 * palette, and the basic letter in the dark theme. The narrow pass
 * (390 px) matters because the audit found surfaces which only exist
 * below the xl breakpoint (the mobile drawer, the preview sheet, the
 * floating preview button) and nothing had ever checked them.
 *
 * The header and footer are INCLUDED. The D.8 suite excluded both for
 * the theme-token contrast failures recorded in
 * docs/SECTION_508_FINDINGS.md; P8-7 and P8-11 moved those tokens, so
 * the whole page is gated now.
 *
 * The gate is serious and critical violations. Minor and moderate
 * findings are recorded in docs/SECTION_508_FINDINGS.md rather than
 * failing the suite, so the bar stays where a 508 review puts it.
 *
 * Run: `npm run build && npm run test:e2e`.
 */
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from '@playwright/test';

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

/** Load the app and clear the first-visit consent modal. */
async function enterApp(page: Page, theme: 'light' | 'dark' = 'light') {
  await page.goto('.');
  if (theme === 'dark') {
    // next-themes reads its storage key on hydration, so set it before
    // the app mounts and reload rather than clicking the toggle.
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  }
  await page.getByRole('button', { name: 'I Understand' }).click();
  await expect(page.getByRole('button', { name: /Standard Naval Letter/ })).toBeVisible();
}

/** Pick a document type from a sidebar group (desktop layout). */
async function openFromSidebar(page: Page, group: string, label: string) {
  const trigger = page.getByRole('button', { name: group, exact: true }).first();
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  await page.getByRole('button', { name: label, exact: true }).first().click();
}

/**
 * Runs axe and returns only the serious and critical violations, each
 * rendered as "rule-id [impact]: target - help", which is what a fix
 * needs.
 */
async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  return results.violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .flatMap(v => v.nodes.map(node => `${v.id} [${v.impact}]: ${node.target.join(' ')} - ${v.help}`));
}

/** Scan a surface at both viewports, waiting for `ready` at each. */
async function scanBothWidths(page: Page, name: string, ready: () => Promise<void>) {
  await page.setViewportSize(DESKTOP);
  await ready();
  expect(await seriousViolations(page), `${name} at 1280px`).toEqual([]);
  await page.setViewportSize(PHONE);
  await ready();
  expect(await seriousViolations(page), `${name} at 390px`).toEqual([]);
}

test.describe('axe accessibility scan', () => {
  test('landing page has no serious or critical violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await enterApp(page);
    await scanBothWidths(page, 'landing page', async () => {
      await expect(page.getByRole('button', { name: /Standard Naval Letter/ })).toBeVisible();
    });
  });

  test('basic letter editor has no serious or critical violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await enterApp(page);
    await page.getByRole('button', { name: /Standard Naval Letter/ }).click();
    await scanBothWidths(page, 'basic letter editor', async () => {
      await expect(page.getByRole('heading', { name: 'Header Information' })).toBeVisible();
    });
  });

  test('basic letter editor in the dark theme has no serious or critical violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await enterApp(page, 'dark');
    await page.getByRole('button', { name: /Standard Naval Letter/ }).click();
    await scanBothWidths(page, 'basic letter editor, dark', async () => {
      await expect(page.getByRole('heading', { name: 'Header Information' })).toBeVisible();
    });
  });

  test('counseling worksheet editor has no serious or critical violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await enterApp(page);
    await openFromSidebar(page, 'Counseling Worksheets', 'Counseling Worksheet');
    await scanBothWidths(page, 'counseling worksheet', async () => {
      await expect(page.getByRole('heading', { name: /Counseling Worksheet/ }).first()).toBeVisible();
    });
  });

  test('NAVMC 10132 editor has no serious or critical violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await enterApp(page);
    await openFromSidebar(page, 'Forms', 'Unit Punishment Book (NAVMC 10132)');
    await scanBothWidths(page, 'NAVMC 10132', async () => {
      await expect(page.getByRole('heading', { name: 'Rank and Pay Grade (Item 19)' })).toBeVisible();
    });
  });

  test('same-page endorsement editor has no serious or critical violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await enterApp(page);
    await openFromSidebar(page, 'Standard Letter', 'Same-Page Endorsement');
    await scanBothWidths(page, 'same-page endorsement', async () => {
      await expect(page.getByRole('heading', { name: 'Same-Page Endorsement' })).toBeVisible();
    });
  });

  test('DD 368 editor has no serious or critical violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await enterApp(page);
    await openFromSidebar(page, 'Forms', 'Conditional Release (DD 368)');
    await scanBothWidths(page, 'DD 368', async () => {
      await expect(page.getByRole('heading', { name: /Section I, Item 1/ })).toBeVisible();
    });
  });

  test('settings dialog has no serious or critical violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await enterApp(page);
    await page.getByRole('button', { name: 'Settings and feedback' }).click();
    await page.getByRole('menuitem', { name: 'Settings' }).click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    expect(await seriousViolations(page), 'settings dialog at 1280px').toEqual([]);
  });

  test('share link dialog has no serious or critical violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await enterApp(page);
    await page.getByRole('button', { name: /Standard Naval Letter/ }).click();
    await expect(page.getByRole('heading', { name: 'Header Information' })).toBeVisible();
    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('menuitem', { name: 'Copy Share Link' }).click();
    await expect(page.getByRole('dialog', { name: /Create Share Link/ })).toBeVisible();
    expect(await seriousViolations(page), 'share link dialog at 1280px').toEqual([]);
  });

  test('command palette has no serious or critical violations', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await enterApp(page);
    await page.getByRole('button', { name: /Standard Naval Letter/ }).click();
    await expect(page.getByRole('heading', { name: 'Header Information' })).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    expect(await seriousViolations(page), 'command palette at 1280px').toEqual([]);
  });
});
